// Home settings kept on this phone (Module 8): hide amounts (6.2) and the month whose
// summary reminder was already opened (6.6). Also the last Home reply, per person, so
// Home shows straight away and stays readable offline (6.10). Kept in memory only.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nandam.home.v1';
let state = { hide: false, summarySeen: null, loaded: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
function set(patch) {
  state = { ...state, ...patch };
  AsyncStorage.setItem(KEY, JSON.stringify({ hide: state.hide, summarySeen: state.summarySeen })).catch(() => {});
  emit();
}

export const homePrefs = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,
  async load() {
    if (state.loaded) return;
    let saved = null;
    try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); } catch { saved = null; }
    state = { hide: !!saved?.hide, summarySeen: saved?.summarySeen ?? null, loaded: true };
    emit();
  },
  setHide(hide) { set({ hide }); },
  markSummarySeen(key) { set({ summarySeen: key }); },
};

export const useHomePrefs = () => useSyncExternalStore(homePrefs.subscribe, homePrefs.getState);

// The last reply for the signed-in person (not saved to the phone).
let last = { userId: null, data: null, at: 0 };
export const lastHome = (userId) => (last.userId === userId ? last : null);
export const keepHome = (userId, data, at) => { last = { userId, data, at }; };
