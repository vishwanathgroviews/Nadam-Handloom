// App theme, chosen per phone in More → This phone (added 15 Oct 2026): Auto follows the
// phone's own light/dark setting (the default, as before), or always Light, or always Dark.
// Kept on this phone, not per person: it is about the screen in your hand, and it also
// applies on the sign-in screens before anyone is signed in.
//
// The choice is also handed to React Native (Appearance.setColorScheme), so the parts
// the system draws (status bar, keyboard, pop-ups) match the app.
import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nandam.theme.v1';
export const THEME_CHOICES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];

export const normalizeThemePref = (v) => (v === 'light' || v === 'dark' ? v : 'auto');
// What React Native is told: 'unspecified' hands the choice back to the phone.
export const appearanceFor = (pref) => (pref === 'auto' ? 'unspecified' : pref);
// The theme the app draws: the fixed choice, or the phone's own setting on Auto.
export const resolveScheme = (pref, phoneScheme) => (pref === 'auto' ? (phoneScheme === 'dark' ? 'dark' : 'light') : pref);

let state = { pref: 'auto', loaded: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const apply = (pref) => { try { Appearance.setColorScheme(appearanceFor(pref)); } catch { /* older phones: the app colours still follow the choice */ } };

export const themePref = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,
  async load() {
    if (state.loaded) return;
    let saved = null;
    try { saved = await AsyncStorage.getItem(KEY); } catch { saved = null; }
    state = { pref: normalizeThemePref(saved), loaded: true };
    if (state.pref !== 'auto') apply(state.pref);
    emit();
  },
  set(pref) {
    const next = normalizeThemePref(pref);
    if (next === state.pref) return;
    state = { ...state, pref: next };
    apply(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
    emit();
  },
};

export const useThemePref = () => useSyncExternalStore(themePref.subscribe, themePref.getState).pref;

// 'light' or 'dark' for the whole app.
export function useAppScheme() {
  const pref = useThemePref();
  return resolveScheme(pref, useColorScheme());
}
