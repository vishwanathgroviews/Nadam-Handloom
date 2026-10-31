import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { appearanceFor, normalizeThemePref, resolveScheme, THEME_CHOICES } from './themePref';

// Saved phone settings live in memory during the tests (Jest moves this above the imports).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const fresh = () => {
  let mod;
  jest.isolateModules(() => { mod = require('./themePref'); });
  return mod.themePref;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('the three choices', () => {
  it('offers Auto, Light and Dark, in that order', () => {
    expect(THEME_CHOICES.map(([k]) => k)).toEqual(['auto', 'light', 'dark']);
  });

  it('Auto follows the phone; Light and Dark ignore it', () => {
    expect(resolveScheme('auto', 'dark')).toBe('dark');
    expect(resolveScheme('auto', 'light')).toBe('light');
    expect(resolveScheme('auto', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('tells React Native to hand back to the phone on Auto', () => {
    expect(appearanceFor('auto')).toBe('unspecified');
    expect(appearanceFor('dark')).toBe('dark');
    expect(appearanceFor('light')).toBe('light');
  });

  it('treats anything unknown as Auto', () => {
    expect(normalizeThemePref(null)).toBe('auto');
    expect(normalizeThemePref('purple')).toBe('auto');
  });
});

describe('kept on this phone', () => {
  it('starts on Auto and leaves the system alone', async () => {
    const set = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    const t = fresh();
    await t.load();
    expect(t.getState().pref).toBe('auto');
    expect(set).not.toHaveBeenCalled();
  });

  it('saves a choice, applies it at once, and brings it back after a restart', async () => {
    const set = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    const t = fresh();
    await t.load();
    t.set('dark');
    expect(t.getState().pref).toBe('dark');
    expect(set).toHaveBeenLastCalledWith('dark');
    await new Promise((r) => setImmediate(r));
    expect(await AsyncStorage.getItem('nandam.theme.v1')).toBe('dark');

    set.mockClear();
    const restarted = fresh();
    await restarted.load();
    expect(restarted.getState().pref).toBe('dark');
    expect(set).toHaveBeenCalledWith('dark');
  });

  it('going back to Auto hands the theme back to the phone', async () => {
    const set = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    const t = fresh();
    await t.load();
    t.set('light');
    t.set('auto');
    expect(set).toHaveBeenLastCalledWith('unspecified');
    expect(t.getState().pref).toBe('auto');
  });

  it('keeps working if the phone refuses the system override', async () => {
    jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => { throw new Error('not supported'); });
    const t = fresh();
    await t.load();
    expect(() => t.set('dark')).not.toThrow();
    expect(t.getState().pref).toBe('dark');
  });
});
