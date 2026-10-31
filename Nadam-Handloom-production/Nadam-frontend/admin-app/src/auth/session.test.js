// The sign-in state: restore, silent renewal, and what each server code does.
const mockStore = new Map();
jest.mock('./storage', () => ({
  KEYS: { session: 'session', remembered: 'remembered', deviceId: 'deviceId' },
  readJSON: jest.fn(async (k) => (mockStore.has(k) ? JSON.parse(mockStore.get(k)) : null)),
  writeJSON: jest.fn(async (k, v) => { mockStore.set(k, JSON.stringify(v)); }),
  remove: jest.fn(async (k) => { mockStore.delete(k); }),
}));
jest.mock('./biometricKeys', () => ({ deleteLocalBiometricKey: jest.fn(async () => {}) }));
jest.mock('./drafts', () => ({ onSignedIn: jest.fn(async () => {}) }));
jest.mock('../api/http', () => {
  class ApiError extends Error { constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details || {}; } }
  return { ApiError, http: jest.fn() };
});


const payload = (n = 1) => ({
  status: 'signed_in', accessToken: `access-${n}`, accessTokenExpiresIn: 900, refreshToken: `refresh-${n}`,
  sessionExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  user: { id: 'acc-1', name: 'Lakshmi (test)', role: 'owner', mobile: '9000000001' },
  device: { id: 'dev-row', deviceId: 'd1', name: 'iPhone 15', platform: 'ios', biometricEnabled: false },
});

// A fresh copy of the session module (and its fakes) for every test.
let session;
let http;
let ApiError;
let deleteLocalBiometricKey;
let drafts;
beforeEach(() => {
  jest.resetModules();
  mockStore.clear();
  ({ http, ApiError } = require('../api/http'));
  ({ deleteLocalBiometricKey } = require('./biometricKeys'));
  drafts = require('./drafts');
  ({ session } = require('./session'));
});

test('no saved sign-in: signed out', async () => {
  await session.restore();
  expect(session.getState().status).toBe('signedOut');
});

test('a sign-in older than 7 days: signed out with the "expired" message', async () => {
  mockStore.set('session', JSON.stringify({ ...payload(), sessionExpiresAt: new Date(Date.now() - 1000).toISOString() }));
  await session.restore();
  expect(session.getState()).toMatchObject({ status: 'signedOut', notice: 'expired' });
});

test('restore signs in straight away and stays signed in when offline', async () => {
  mockStore.set('session', JSON.stringify(payload()));
  http.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
  await session.restore();
  expect(session.getState().status).toBe('signedIn');
  await new Promise((r) => setTimeout(r, 0));
  expect(session.getState().status).toBe('signedIn');
});

test('renewal stores the new refresh key', async () => {
  await session.applySignIn(payload(1));
  http.mockResolvedValue(payload(2));
  const token = await session.refresh('access-1');
  expect(token).toBe('access-2');
  expect(JSON.parse(mockStore.get('session')).refreshToken).toBe('refresh-2');
});

test('only one renewal runs at a time', async () => {
  await session.applySignIn(payload(1));
  http.mockImplementation(() => new Promise((r) => setTimeout(() => r(payload(2)), 20)));
  const [a, b, c] = await Promise.all([session.refresh('access-1'), session.refresh('access-1'), session.refresh('access-1')]);
  expect(http).toHaveBeenCalledTimes(1);
  expect([a, b, c]).toEqual(['access-2', 'access-2', 'access-2']);
});

test('a renewal race retries once with the newest stored key', async () => {
  await session.applySignIn(payload(1));
  mockStore.set('session', JSON.stringify({ ...payload(1), refreshToken: 'refresh-from-other-run' }));
  http.mockRejectedValueOnce(new ApiError(409, 'REFRESH_RACE', 'race')).mockResolvedValueOnce(payload(3));
  await expect(session.refresh('access-1')).resolves.toBe('access-3');
  expect(http.mock.calls[1][1].body.refreshToken).toBe('refresh-from-other-run');
});

test.each([
  ['SIGNED_OUT_FOR_SAFETY', 'safety', true],
  ['SIGNED_OUT_REMOTELY', 'remote', true],
  ['PIN_CHANGED', 'pinchanged', true],
  ['ACCESS_REMOVED', 'removed', true],
  ['SESSION_EXPIRED', 'expired', false],
  ['SESSION_INVALID', null, false],
])('%s ends the sign-in with the "%s" message', async (code, notice, dropsBiometric) => {
  await session.applySignIn(payload(1));
  http.mockRejectedValue(new ApiError(401, code, 'ended'));
  await expect(session.refresh('access-1')).rejects.toMatchObject({ code });
  expect(session.getState()).toMatchObject({ status: 'signedOut', notice });
  expect(mockStore.has('session')).toBe(false);
  expect(deleteLocalBiometricKey).toHaveBeenCalledTimes(dropsBiometric ? 1 : 0);
  expect(mockStore.has('remembered')).toBe(code !== 'ACCESS_REMOVED');
});

test('a caller holding an older key gets the current one without a new renewal', async () => {
  await session.applySignIn(payload(1));
  await expect(session.refresh('access-0')).resolves.toBe('access-1');
  expect(http).not.toHaveBeenCalled();
});

test('sign-in remembers the person and checks whose drafts are kept', async () => {
  await session.applySignIn(payload(1));
  expect(JSON.parse(mockStore.get('remembered'))).toMatchObject({ accountId: 'acc-1', mobile: '9000000001' });
  expect(drafts.onSignedIn).toHaveBeenCalledWith('acc-1');
});

test('log out works even when the server can\'t be reached', async () => {
  await session.applySignIn(payload(1));
  http.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
  await session.logout();
  expect(session.getState()).toMatchObject({ status: 'signedOut', notice: null });
  expect(mockStore.has('session')).toBe(false);
  expect(mockStore.has('remembered')).toBe(true);
});

test('a role change from the server is noticed once and saved, without signing out (Module 2)', async () => {
  await session.applySignIn({ ...payload(1), user: { ...payload(1).user, role: 'staff', permissions: ['sell.use'] } });
  await session.updateUser({ ...payload(1).user, role: 'owner', permissions: ['team.manage', 'sell.use'] });
  const st = session.getState();
  expect(st.status).toBe('signedIn');
  expect(st.user.role).toBe('owner');
  expect(st.roleChange).toEqual({ from: 'staff', to: 'owner' });
  expect(JSON.parse(mockStore.get('session')).user.permissions).toContain('team.manage');
  session.clearRoleChange();
  await session.updateUser({ ...payload(1).user, role: 'owner', permissions: ['team.manage', 'sell.use'] });
  expect(session.getState().roleChange).toBeNull();
});

test('a renewal carrying a new role also counts as a role change', async () => {
  await session.applySignIn({ ...payload(1), user: { ...payload(1).user, role: 'owner' } });
  http.mockResolvedValueOnce({ ...payload(2), user: { ...payload(2).user, role: 'staff' } });
  await session.refresh();
  expect(session.getState().roleChange).toEqual({ from: 'owner', to: 'staff' });
});
