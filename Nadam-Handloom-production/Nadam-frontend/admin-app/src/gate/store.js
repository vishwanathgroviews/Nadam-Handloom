// The start-up check (Module 11, section 8): maintenance and update info from the server,
// read on start, when the app comes back to the front, every 5 minutes, and every minute
// while the maintenance screen shows. A request refused with MAINTENANCE shows the
// screen at once. "Later" on the new-version banner hides it for a day.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { http } from '../api/http';
import { getItem, setItem } from '../auth/storage';

export const PLATFORM = Platform.OS === 'ios' ? 'ios' : 'android';
export const BUILD = Number(Application.nativeBuildVersion) || null;
export const APP_NAME = Application.applicationName || 'Nandam Admin';
export const VERSION = `${Application.nativeApplicationVersion || '2.0.0'} (${Application.nativeBuildVersion || 'dev'})`;
const LATER_KEY = 'nandam.updateLater';
const DAY = 24 * 60 * 60 * 1000;

let state = { status: null, paused: null, laterUntil: 0, later: false, resumes: 0, changes: 0 };
const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const gate = {
  getState: () => state,
  subscribe(l) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  async load() {
    const until = Number(await getItem(LATER_KEY).catch(() => null)) || 0;
    if (until > Date.now()) set({ laterUntil: until, later: true });
  },
  // Offline: keeps what it knew (nobody is blocked or let in by a failed check).
  async check() {
    try {
      const status = await http('/app-status', { timeoutMs: 10000 });
      const wasOn = !!state.paused || !!state.status?.maintenance?.staff?.on;
      const on = !!status.maintenance?.staff?.on;
      const changed = !!state.status && JSON.stringify(status) !== JSON.stringify(state.status);
      set({ status, paused: on ? state.paused : null, later: state.laterUntil > Date.now(), resumes: wasOn && !on ? state.resumes + 1 : state.resumes, changes: changed ? state.changes + 1 : state.changes });
      return status;
    } catch {
      return null;
    }
  },
  pausedByServer(message) {
    set({ paused: message || 'The staff app is paused for a short while.' });
    gate.check();
  },
  async later() {
    const until = Date.now() + DAY;
    set({ laterUntil: until, later: true });
    await setItem(LATER_KEY, String(until)).catch(() => {});
  },
};

export const useGate = () => useSyncExternalStore(gate.subscribe, gate.getState);

// Runs `load` again each time the counter `key` moves on.
function useOnCount(key, load) {
  const count = useSyncExternalStore(gate.subscribe, () => state[key]);
  const seen = useRef(count);
  useEffect(() => {
    if (count === seen.current) return;
    seen.current = count;
    load();
  }, [count, load]);
}
// A list reloads by itself when the staff app opens again after maintenance (what it
// tried to load meanwhile was refused).
export const useOnResume = (load) => useOnCount('resumes', load);
// Settings reloads when maintenance or the update numbers change (from another phone).
export const useOnStatusChange = (load) => useOnCount('changes', load);
