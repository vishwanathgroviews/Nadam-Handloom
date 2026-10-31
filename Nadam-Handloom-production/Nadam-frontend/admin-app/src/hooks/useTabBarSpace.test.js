import { tabBarSpace, TAB_BAR_HEIGHT } from './useTabBarSpace';

// The hook's module reaches the saved theme setting; keep saved settings in memory (Jest moves this above the imports).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// iPhone with the home indicator (34) and an Android phone with buttons (0).
const IPHONE = 34;
const ANDROID = 0;

describe('room left at the bottom of a page', () => {
  it('main pages on a phone keep clear of the floating bar', () => {
    const s = tabBarSpace({ onMainPage: true, tablet: false, keyboardOpen: false, insetBottom: IPHONE });
    const barTop = IPHONE + 4 + TAB_BAR_HEIGHT;
    expect(s.footer).toBe(barTop + 12 - 16);
    expect(s.scroll).toBe(barTop + 24);
  });

  it('pages opened on top have no bar: they only keep clear of the phone\'s bottom edge', () => {
    expect(tabBarSpace({ onMainPage: false, tablet: false, keyboardOpen: false, insetBottom: IPHONE })).toEqual({ footer: IPHONE - 16, scroll: 24 + IPHONE });
    expect(tabBarSpace({ onMainPage: false, tablet: false, keyboardOpen: false, insetBottom: ANDROID })).toEqual({ footer: 0, scroll: 24 });
  });

  it('tablets use the side menu, so no page leaves room for a bottom bar', () => {
    expect(tabBarSpace({ onMainPage: true, tablet: true, keyboardOpen: false, insetBottom: 20 })).toEqual({ footer: 4, scroll: 44 });
  });

  it('nothing under a footer while the keyboard is open', () => {
    expect(tabBarSpace({ onMainPage: true, tablet: false, keyboardOpen: true, insetBottom: IPHONE }).footer).toBe(0);
    expect(tabBarSpace({ onMainPage: false, tablet: false, keyboardOpen: true, insetBottom: IPHONE }).footer).toBe(0);
  });
});
