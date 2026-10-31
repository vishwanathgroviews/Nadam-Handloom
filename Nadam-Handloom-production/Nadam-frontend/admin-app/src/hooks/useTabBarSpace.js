// Room to leave for the floating tab bar on phones, worked out from the same
// numbers AppTabBar uses (it floats max(bottom inset, 10) + 4 above the screen
// edge and is 68 tall), so buttons never sit under it on any phone, with or
// without the phone's own navigation bar. Tablets use the side menu instead.
// Only the five main pages show the bar: every other page opens on top of it
// (app/(app)/_layout.js), so those just keep clear of the phone's bottom edge.
//   footer: bottom padding for a Screen footer (which has 16 of its own): 12 above the bar.
//   scroll: bottom padding for scrolling content: the last item clears the bar by 24.
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsTablet } from '../theme/ThemeProvider';
import { useKeyboardVisible } from './useKeyboardVisible';

export const TAB_BAR_HEIGHT = 68;
export const tabBarBottom = (insetBottom) => Math.max(insetBottom, 10) + 4;

export function tabBarSpace({ onMainPage, tablet, keyboardOpen, insetBottom }) {
  const bar = onMainPage && !tablet;
  const barTop = tabBarBottom(insetBottom) + TAB_BAR_HEIGHT;
  return {
    // the bar hides while the keyboard is open, and the keyboard covers the bottom edge
    footer: keyboardOpen ? 0 : bar ? barTop + 12 - 16 : Math.max(insetBottom, 16) - 16,
    scroll: bar ? barTop + 24 : 24 + insetBottom,
  };
}

export function useTabBarSpace() {
  const tablet = useIsTablet();
  const keyboardOpen = useKeyboardVisible();
  const insets = useSafeAreaInsets();
  // A main page sits in the tabs; any other page sits in the stack above them.
  const onMainPage = useNavigation().getState()?.type === 'tab';
  return tabBarSpace({ onMainPage, tablet, keyboardOpen, insetBottom: insets.bottom });
}
