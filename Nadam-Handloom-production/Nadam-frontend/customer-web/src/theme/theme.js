// The visitor's colour choice: Auto (follows the device), Light or Dark. Kept in this
// browser; index.html applies it before the page draws.
import { useSyncExternalStore } from 'react';

const KEY = 'nh-theme';
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const subscribers = new Set();

export function themePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function apply() {
  const pref = themePref();
  const dark = pref === 'dark' || (pref === 'auto' && !!media?.matches);
  document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
  subscribers.forEach((fn) => fn());
}

export function setThemePref(pref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* private mode: this visit only */ }
  apply();
}

media?.addEventListener?.('change', () => { if (themePref() === 'auto') apply(); });

const subscribe = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };
export const useThemePref = () => useSyncExternalStore(subscribe, themePref, () => 'auto');
