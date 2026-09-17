import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The client pulls in three Expo/RN modules at import time purely for
// configuration (which host to call, where the refresh token lives). Stubbing
// them keeps this a real test of the request/refresh logic rather than of the
// native runtime.
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { hostUri: '10.0.0.5:8081' } } }));

const store = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => store.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void store.set(k, v),
  deleteItemAsync: async (k: string) => void store.delete(k),
}));

import { apiRequest, isAuthFailure, registerAuthHandlers, REFRESH_TOKEN_KEY } from './client';

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const networkDown = () => Promise.reject(Object.assign(new Error('Network request failed')));

let onAuthExpired: ReturnType<typeof vi.fn>;
let onTokenRefreshed: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store.clear();
  store.set(REFRESH_TOKEN_KEY, 'stored-refresh-token');
  onAuthExpired = vi.fn();
  onTokenRefreshed = vi.fn();
  registerAuthHandlers({ onTokenRefreshed, onAuthExpired });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isAuthFailure', () => {
  it('is true only for a rejected session, not a failed connection', () => {
    expect(isAuthFailure({ status: 401 })).toBe(true);
    expect(isAuthFailure({ status: 403 })).toBe(true);
    expect(isAuthFailure({ status: 0 })).toBe(false); // network error / timeout
    expect(isAuthFailure({ status: 500 })).toBe(false);
    expect(isAuthFailure(undefined)).toBe(false);
  });
});

describe('apiRequest session handling', () => {
  it('refreshes once and retries when the access token has expired', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { message: 'Invalid or expired access token' }))
      .mockResolvedValueOnce(json(200, { data: { tokens: { accessToken: 'fresh', refreshToken: 'rotated' } } }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await apiRequest('/admin/dashboard', { token: 'stale' });

    expect(res).toEqual({ data: { ok: true } });
    expect(onTokenRefreshed).toHaveBeenCalledWith('fresh');
    expect(onAuthExpired).not.toHaveBeenCalled();
    // The rotated refresh token has to be persisted, or the next refresh
    // would present the used one and trip the server's reuse detection.
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('rotated');
  });

  it('signs the user out when the server actually rejects the refresh token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { message: 'Invalid or expired access token' }))
      .mockResolvedValueOnce(json(401, { message: 'Refresh token is invalid' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/admin/dashboard', { token: 'stale' })).rejects.toThrow();
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  // The "it logged me out on its own" report: the phone lost signal for a
  // moment while the access token happened to be expired. That is a failed
  // request, not a rejected session, and must not end the session.
  it('keeps the session when the refresh cannot reach the server', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { message: 'Invalid or expired access token' }))
      .mockImplementationOnce(networkDown);
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/admin/dashboard', { token: 'stale' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(onAuthExpired).not.toHaveBeenCalled();
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('stored-refresh-token');
  });

  it('signs the user out when there is no refresh token left to try', async () => {
    store.delete(REFRESH_TOKEN_KEY);
    const fetchMock = vi.fn().mockResolvedValueOnce(json(401, { message: 'Invalid or expired access token' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/admin/dashboard', { token: 'stale' })).rejects.toThrow();
    expect(onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it('does not blame the backend when the request simply did not get through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(networkDown));

    await expect(apiRequest('/admin/dashboard', { token: 'live' })).rejects.toThrow(
      /check your internet connection/i
    );
  });

  it('never tries to refresh on the auth endpoints themselves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { message: 'Incorrect MPIN. Please try again.' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest('/auth/app/login', { method: 'POST', body: { mobile: '9000000000', mpin: '000000' }, token: 'x' })
    ).rejects.toThrow(/incorrect mpin/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onAuthExpired).not.toHaveBeenCalled();
  });
});
