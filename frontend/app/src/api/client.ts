import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Shared with AuthContext.tsx, which persists/reads the same key at login,
// mpin-setup, and logout.
export const REFRESH_TOKEN_KEY = 'nandam_staff_refresh_token';

// A physical device can't reach "localhost" (that's the device itself) or
// the Android-emulator loopback alias 10.0.2.2 — it needs the dev machine's
// real LAN address. Expo already knows that address (it's how the phone
// found the Metro bundler in the first place), exposed as hostUri, e.g.
// "192.168.1.102:8081" — reuse its host for the API, which runs on the same
// machine. Falls back to the emulator/simulator loopback aliases when
// hostUri isn't available (e.g. web preview).
function resolveDevApiHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any).manifest?.debuggerHost;
  const lanHost = hostUri?.split(':')[0];
  if (lanHost) return lanHost;
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

// Production/EAS builds should point at the real API instead of guessing a
// dev-machine LAN address — set EXPO_PUBLIC_API_URL (e.g. via eas.json env)
// to override, no code changes needed.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
export const API_BASE_URL = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/$/, '')}/api/v1`
  : `http://${resolveDevApiHost()}:4000/api/v1`;

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

/**
 * True when a failure means "this session is no longer valid", as opposed to
 * "the request did not get through".
 *
 * The distinction is the whole reason staff were being logged out at random:
 * a refresh that failed because the phone lost signal for a moment was
 * treated exactly like a refresh the server had rejected, and the session was
 * thrown away. status 0 is what rawRequest uses for every transport failure
 * (network error or timeout) — those must never end a session.
 */
export const isAuthFailure = (err: unknown): boolean => {
  const status = (err as ApiError | undefined)?.status;
  return status === 401 || status === 403;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string;
}

// Plain fetch() never times out on its own — a dropped/one-way WiFi
// connection (common on phone hotspots and flaky routers) leaves the
// caller hanging indefinitely instead of failing with a message the user
// can act on. Image uploads get a longer budget than JSON calls since a
// compressed photo over real WiFi legitimately takes longer than a small
// JSON body.
const DEFAULT_TIMEOUT_MS = 20000;
export const UPLOAD_TIMEOUT_MS = 45000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error(
        'The server took too long to respond. Check your connection and try again.'
      ) as ApiError;
      timeoutError.status = 0;
      timeoutError.code = 'NETWORK_TIMEOUT';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function rawRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err: any) {
    if (err?.code === 'NETWORK_TIMEOUT') throw err;
    // Deliberately does not say "the backend isn't running": from the phone's
    // side an unreachable server and a dropped mobile signal look identical,
    // and in production it is nearly always the latter. Telling staff the
    // server is down when their signal dipped sent them chasing the wrong
    // problem.
    const error = new Error(
      'Could not reach the server. Check your internet connection and try again.'
    ) as ApiError;
    error.status = 0;
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong') as ApiError;
    error.status = response.status;
    error.code = data.code;
    error.details = data.details;
    throw error;
  }

  return data as T;
}

// Access tokens expire in 15 minutes (JWT_ACCESS_EXPIRES_IN) — any screen left
// open longer than that used to hit a bare "Invalid or expired access token"
// on its next call with no way to recover short of restarting the app. These
// handlers let AuthContext plug in without every one of the ~40 api/*.ts
// functions (each already takes an explicit `token` param from its caller)
// needing to change: apiRequest transparently refreshes and retries once
// instead of surfacing the 401.
let onTokenRefreshed: ((accessToken: string) => void) | null = null;
let onAuthExpired: (() => void) | null = null;
let refreshPromise: Promise<string> | null = null;

export function registerAuthHandlers(handlers: {
  onTokenRefreshed: (accessToken: string) => void;
  onAuthExpired: () => void;
}) {
  onTokenRefreshed = handlers.onTokenRefreshed;
  onAuthExpired = handlers.onAuthExpired;
}

// Concurrent 401s (e.g. a screen firing several authenticated calls on focus)
// must share one in-flight refresh — the backend's refresh token is
// single-use and rotates on every call, so a second independent call with the
// now-already-rotated token would be flagged as reuse and revoke every
// session for the account instead of just quietly refreshing.
export async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        const error = new Error('No refresh token stored') as ApiError;
        error.status = 401;
        error.code = 'NO_REFRESH_TOKEN';
        throw error;
      }

      const res = await rawRequest<{ data: { tokens: { accessToken: string; refreshToken?: string } } }>(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: storedRefreshToken } }
      );
      const { accessToken, refreshToken } = res.data.tokens;
      if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      onTokenRefreshed?.(accessToken);
      return accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const apiError = err as ApiError;
    const isAuthEndpoint = path.startsWith('/auth/');
    if (apiError.status === 401 && options.token && !isAuthEndpoint) {
      try {
        const newToken = await refreshAccessToken();
        return await rawRequest<T>(path, { ...options, token: newToken });
      } catch (refreshErr) {
        // Session genuinely rejected (or no refresh token to try): sign out.
        if (isAuthFailure(refreshErr) || (refreshErr as ApiError)?.code === 'NO_REFRESH_TOKEN') {
          onAuthExpired?.();
          throw apiError;
        }
        // Couldn't reach the server to find out. Leave the session alone and
        // report the transport problem — the call is retryable, and throwing
        // the user back to the login screen over one dropped request is what
        // the "it logged me out by itself" reports were.
        throw refreshErr;
      }
    }
    throw err;
  }
}
