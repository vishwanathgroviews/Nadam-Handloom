// A small cache of server replies (home, catalogue, lists, saree pages). Going back to a page
// shows it at once; a reply older than a minute is fetched again in the background.
import { useCallback, useEffect, useSyncExternalStore } from 'react';

const FRESH_MS = 60000;
const entries = new Map(); // key -> { status, data, error, at, promise }
const listeners = new Set();
const EMPTY = { status: 'idle', data: null, error: null };
let version = 0;

function set(key, patch) {
  entries.set(key, { ...(entries.get(key) || EMPTY), ...patch });
  version += 1;
  listeners.forEach((fn) => fn());
}

// Starts (or reuses) a load. Never throws: the error lands in the entry.
export function ensure(key, loader, { force = false } = {}) {
  const e = entries.get(key);
  if (e?.promise) return e.promise;
  if (!force && e?.status === 'ready' && Date.now() - e.at < FRESH_MS) return Promise.resolve(e.data);
  const ctrl = new AbortController();
  const promise = loader({ signal: ctrl.signal })
    .then((data) => { set(key, { status: 'ready', data, error: null, at: Date.now(), promise: null }); return data; })
    .catch((error) => { set(key, { status: e?.data ? 'ready' : 'error', error, promise: null }); return null; });
  set(key, { status: e?.data ? 'ready' : 'loading', promise });
  return promise;
}

export const peek = (key) => entries.get(key)?.data ?? null;

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// { status: loading | ready | error, data, error, reload }. key null = nothing to load yet.
export function useResource(key, loader) {
  const entry = useSyncExternalStore(subscribe, () => (key ? entries.get(key) : undefined) || EMPTY, () => EMPTY);
  useEffect(() => {
    if (key) ensure(key, loader);
    // The loader is tied to the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const reload = useCallback(() => (key ? ensure(key, loader, { force: true }) : null), [key, loader]);
  const status = !key ? 'idle' : entry.status === 'idle' ? 'loading' : entry.status;
  return { status, data: entry.data, error: entry.error, reload };
}

// Several keys at once (the pages of a list): { list: their entries in order, retry }.
// Missing ones load; retry loads again the ones that failed.
export function useResources(keys, loaderFor) {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const joined = keys.join('|');
  useEffect(() => {
    keys.forEach((k) => ensure(k, loaderFor(k)));
    // The keys are fully described by `joined`; the loader is tied to the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  const list = keys.map((k) => entries.get(k) || { ...EMPTY, status: 'loading' });
  const retry = () => keys.forEach((k) => { if (!entries.get(k)?.data) ensure(k, loaderFor(k), { force: true }); });
  return { list, retry };
}
