jest.mock('./http', () => {
  class ApiError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; this.details = {}; } }
  return { ApiError, http: jest.fn() };
});
jest.mock('../auth/session', () => ({
  SESSION_END_CODES: new Set(['SESSION_INVALID', 'SIGNED_OUT_REMOTELY']),
  session: { getAccessToken: jest.fn(async () => 'old'), refresh: jest.fn(async () => 'new'), end: jest.fn(async () => {}) },
}));
jest.mock('../gate/store', () => ({ gate: { pausedByServer: jest.fn() } }));
const { http, ApiError } = require('./http');
const { gate } = require('../gate/store');
const { session } = require('../auth/session');
const { api } = require('./client');

beforeEach(() => { http.mockReset(); session.refresh.mockClear(); session.end.mockClear(); });

test('an expired access key is renewed once and the request repeated', async () => {
  http.mockRejectedValueOnce(new ApiError(401, 'ACCESS_TOKEN_EXPIRED', 'x')).mockResolvedValueOnce({ ok: true });
  await expect(api('/me')).resolves.toEqual({ ok: true });
  expect(session.refresh).toHaveBeenCalledWith('old');
  expect(http.mock.calls[1][1].token).toBe('new');
});

test('a code that ends the sign-in is handed to the session', async () => {
  http.mockRejectedValue(new ApiError(401, 'SIGNED_OUT_REMOTELY', 'x'));
  await expect(api('/me')).rejects.toMatchObject({ code: 'SIGNED_OUT_REMOTELY' });
  expect(session.end).toHaveBeenCalledWith('SIGNED_OUT_REMOTELY');
});

test('network problems are passed back without signing out', async () => {
  http.mockRejectedValue(new ApiError(0, 'NETWORK', 'x'));
  await expect(api('/me')).rejects.toMatchObject({ code: 'NETWORK' });
  expect(session.end).not.toHaveBeenCalled();
});

test('a staff request refused because the staff app is paused shows the maintenance screen (Module 11)', async () => {
  const err = new ApiError(503, 'MAINTENANCE', 'Back at 6');
  err.details = { message: 'Back at 6' };
  http.mockRejectedValue(err);
  await expect(api('/home')).rejects.toMatchObject({ code: 'MAINTENANCE' });
  expect(gate.pausedByServer).toHaveBeenCalledWith('Back at 6');
  expect(session.end).not.toHaveBeenCalled();
});
