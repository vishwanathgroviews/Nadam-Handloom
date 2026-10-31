// Remembers whether the last request reached the server, for the "can't reach the
// server" banner. A network problem never signs anyone out.
import { useSyncExternalStore } from 'react';

let unreachable = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const connectivity = {
  reachedServer() {
    if (unreachable) { unreachable = false; emit(); }
  },
  serverUnreachable() {
    if (!unreachable) { unreachable = true; emit(); }
  },
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  get: () => unreachable,
};

export const useServerUnreachable = () => useSyncExternalStore(connectivity.subscribe, connectivity.get);
