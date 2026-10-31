// The sign-in state of the app (docs section 4.4 and 8.1).
// - Access key (15 min) lives in memory only; it is renewed silently.
// - Refresh key (7 days, renewed on every use) lives in the Keychain/Keystore.
// - A network problem NEVER signs anyone out: the app keeps working and retries later.
// - Only the server ending the sign-in (or 7 days unused) leads to a sign-in screen,
//   with a message saying why.
import { useSyncExternalStore } from 'react';
import { http, ApiError } from '../api/http';
import { KEYS, readJSON, writeJSON, remove } from './storage';
import * as drafts from './drafts';
import { deleteLocalBiometricKey } from './biometricKeys';
import { sleep } from '../utils/time';

// Server codes that mean "this sign-in is over", and the message screen for each.
export const NOTICE_FOR = {
  SESSION_EXPIRED: 'expired',
  SIGNED_OUT_REMOTELY: 'remote',
  PIN_CHANGED: 'pinchanged',
  SIGNED_OUT_FOR_SAFETY: 'safety',
  ACCESS_REMOVED: 'removed',
  SESSION_INVALID: null,
};
export const SESSION_END_CODES = new Set(Object.keys(NOTICE_FOR));
// After these the server has also dropped this phone's Face ID key, so drop ours.
const DROPS_BIOMETRIC = new Set(['SIGNED_OUT_REMOTELY', 'PIN_CHANGED', 'SIGNED_OUT_FOR_SAFETY', 'ACCESS_REMOVED']);

let state = { status: 'loading', user: null, device: null, notice: null, sessionExpiresAt: null, roleChange: null };
let accessToken = null;
let accessExpiresAt = 0;
let refreshToken = null;
let refreshing = null;
const listeners = new Set();

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function saveSession(payload) {
  accessToken = payload.accessToken;
  accessExpiresAt = Date.now() + payload.accessTokenExpiresIn * 1000;
  refreshToken = payload.refreshToken;
  await writeJSON(KEYS.session, { refreshToken, sessionExpiresAt: payload.sessionExpiresAt, user: payload.user, device: payload.device });
}

async function doRefresh(attempt = 0) {
  if (!refreshToken) throw new ApiError(401, 'SESSION_INVALID', 'Please sign in again.');
  try {
    const payload = await http('/auth/refresh', { method: 'POST', body: { refreshToken } });
    await saveSession(payload);
    set({ device: payload.device, sessionExpiresAt: payload.sessionExpiresAt });
    await session.updateUser(payload.user);
    return accessToken;
  } catch (err) {
    if (err.code === 'REFRESH_RACE' && attempt === 0) {
      // Another renewal finished a moment ago (e.g. the app was closed mid-renewal): use the newest stored key.
      const saved = await readJSON(KEYS.session);
      if (saved?.refreshToken) refreshToken = saved.refreshToken;
      await sleep(400);
      return doRefresh(1);
    }
    if (SESSION_END_CODES.has(err.code)) await session.end(err.code);
    throw err; // NETWORK / TIMEOUT: stay signed in
  }
}

export const session = {
  getState: () => state,
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  // On app start: signed in straight away from what is stored (works offline),
  // then renewed in the background.
  async restore() {
    const saved = await readJSON(KEYS.session);
    if (!saved?.refreshToken) return set({ status: 'signedOut' });
    if (new Date(saved.sessionExpiresAt) <= new Date()) {
      await remove(KEYS.session);
      return set({ status: 'signedOut', notice: 'expired' });
    }
    refreshToken = saved.refreshToken;
    set({ status: 'signedIn', user: saved.user, device: saved.device, sessionExpiresAt: saved.sessionExpiresAt, notice: null });
    session.refresh().catch(() => {});
    return undefined;
  },

  async applySignIn(payload) {
    await saveSession(payload);
    const prev = await readJSON(KEYS.remembered);
    await writeJSON(KEYS.remembered, {
      accountId: payload.user.id,
      mobile: payload.user.mobile,
      name: payload.user.name,
      faceChanged: prev?.accountId === payload.user.id ? !!prev.faceChanged : false,
    });
    await drafts.onSignedIn(payload.user.id);
    set({ status: 'signedIn', user: payload.user, device: payload.device, sessionExpiresAt: payload.sessionExpiresAt, notice: null });
  },

  // The latest profile from the server (renewal, /me). An owner may have changed
  // this person's role: the app then shows the new role's screens, says so once
  // (roleChange), and keeps them signed in. Docs Module 2, section 5.4.
  async updateUser(user) {
    if (!user || state.status !== 'signedIn') return;
    const before = state.user;
    const saved = await readJSON(KEYS.session);
    if (saved) await writeJSON(KEYS.session, { ...saved, user });
    const changed = before && before.id === user.id && before.role !== user.role;
    set({ user, ...(changed ? { roleChange: { from: before.role, to: user.role } } : {}) });
  },
  clearRoleChange: () => set({ roleChange: null }),

  // A valid access key, renewing it first if it is about to run out.
  async getAccessToken() {
    if (accessToken && Date.now() < accessExpiresAt - 30_000) return accessToken;
    return session.refresh(accessToken);
  },

  // Single renewal at a time; callers holding an old key get the new one.
  refresh(usedToken) {
    if (usedToken && accessToken && usedToken !== accessToken && Date.now() < accessExpiresAt - 30_000) return Promise.resolve(accessToken);
    if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
    return refreshing;
  },

  // The server ended the sign-in. Show why; keep the remembered number and drafts.
  async end(code) {
    const remembered = await readJSON(KEYS.remembered);
    accessToken = null;
    refreshToken = null;
    await remove(KEYS.session);
    if (DROPS_BIOMETRIC.has(code) && remembered?.accountId) await deleteLocalBiometricKey(remembered.accountId);
    if (code === 'ACCESS_REMOVED') await remove(KEYS.remembered);
    set({ status: 'signedOut', user: null, device: null, notice: NOTICE_FOR[code] ?? null });
  },

  // Log out on this phone. Works offline too: the keys are wiped here either way.
  async logout() {
    const token = refreshToken;
    accessToken = null;
    refreshToken = null;
    await remove(KEYS.session);
    set({ status: 'signedOut', user: null, device: null, notice: null });
    if (token) http('/auth/logout', { method: 'POST', body: { refreshToken: token }, timeoutMs: 8000 }).catch(() => {});
  },

  clearNotice: () => set({ notice: null }),
};

export const useSession = () => useSyncExternalStore(session.subscribe, session.getState);

export const getRemembered = () => readJSON(KEYS.remembered);
export const forgetRemembered = () => remove(KEYS.remembered);
export async function markFaceChanged(value) {
  const r = await readJSON(KEYS.remembered);
  if (r) await writeJSON(KEYS.remembered, { ...r, faceChanged: value });
}
