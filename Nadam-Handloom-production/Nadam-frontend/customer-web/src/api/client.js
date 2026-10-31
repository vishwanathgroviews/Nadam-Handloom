// The website's only way to call the server (/api/v2/shop). It:
// - sends the website header (X-Requested-With) and the short sign-in key when needed;
// - renews the key quietly when it has expired and retries the call once;
// - turns every failure (offline, timeout, server, refusal) into an ApiError;
// - tells the rest of the website when the sign-in has ended or the shop is closed.
import { ApiError, SESSION_ENDED, networkError, offlineError, serverError, timeoutError } from './errors.js';

export const API_BASE = import.meta.env.VITE_API_BASE || '/api/v2/shop';
const CLIENT_HEADER = 'nandam-web';
const TIMEOUT_MS = 20000;

/* ---------- The short sign-in key: in memory only, never in browser storage ---------- */
let access = { token: null, expiresAt: 0 };
export const accessKey = {
  get: () => access.token,
  set(token, expiresInSeconds) { access = { token, expiresAt: Date.now() + expiresInSeconds * 1000 }; },
  clear() { access = { token: null, expiresAt: 0 }; },
  // Still good for at least `marginMs`?
  fresh: (marginMs = 30000) => !!access.token && access.expiresAt - Date.now() > marginMs,
};

/* ---------- Events for the rest of the website ---------- */
const listeners = { sessionEnded: new Set(), maintenance: new Set() };
export function on(event, fn) {
  listeners[event].add(fn);
  return () => listeners[event].delete(fn);
}
const emit = (event, value) => listeners[event].forEach((fn) => fn(value));

// Set by the sign-in store: renews the short key (returns true when it did).
let renewer = null;
export const setRenewer = (fn) => { renewer = fn; };

async function readBody(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined; // not JSON: an HTML error page from a proxy
  }
}

// One HTTP call, no renewal. Throws ApiError. as: 'json' (default) | 'file' (a download:
// { blob, filename }; a refusal still comes as JSON).
export async function send(method, path, { body, form, token, signal, timeoutMs = TIMEOUT_MS, as = 'json' } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw offlineError();
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const headers = { 'X-Requested-With': CLIENT_HEADER, Accept: as === 'file' ? 'application/pdf, application/json' : 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, headers, credentials: 'include', cache: 'no-store', signal: ctrl.signal,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    if (signal?.aborted) throw err; // the page cancelled it: not an error to show
    if (timedOut) throw timeoutError();
    throw navigator.onLine === false ? offlineError() : networkError();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (res.ok && as === 'file') {
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || 'download';
    return { blob: await res.blob(), filename: name };
  }
  const data = await readBody(res);
  if (res.ok) return data;
  const reference = (data?.error?.details?.reference || res.headers.get('x-request-id') || '').slice(0, 8).toUpperCase() || null;
  if (!data?.error) throw serverError(res.status, reference);
  const e = data.error;
  const retryAfter = Number(e.details?.retryAfterSeconds ?? res.headers.get('retry-after')) || null;
  const err = new ApiError({ status: res.status, code: e.code, message: e.message, details: e.details || null, retryAfterSeconds: retryAfter, reference: res.status >= 500 ? reference : null });
  if (err.code === 'MAINTENANCE') emit('maintenance', { on: true, message: e.details?.message || e.message });
  throw err;
}

// A call to the server. auth: false (anyone), true (signed-in customers), 'optional'.
export async function request(method, path, opts = {}) {
  const { auth = false } = opts;
  if (auth && !accessKey.fresh() && renewer) await renewer().catch(() => {});
  const token = auth ? accessKey.get() : undefined;
  if (auth === true && !token) {
    const err = new ApiError({ status: 401, code: 'NOT_SIGNED_IN', message: 'Please sign in.' });
    emit('sessionEnded', err);
    throw err;
  }
  try {
    return await send(method, path, { ...opts, token });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !auth) throw err;
    if (err.code === 'ACCESS_TOKEN_EXPIRED' && renewer) {
      // The key ran out (or was renewed in another tab): renew once and try again.
      const renewed = await renewer().catch(() => false);
      if (renewed) return send(method, path, { ...opts, token: accessKey.get() });
    }
    if (SESSION_ENDED.has(err.code) || err.code === 'ACCESS_TOKEN_EXPIRED') emit('sessionEnded', err);
    throw err;
  }
}

export const sessionEnded = (err) => emit('sessionEnded', err);
