// Light or dark: the phone's own setting (userInterfaceStyle: automatic) unless this
// phone chose Light or Dark in More → This phone (theme/themePref.js).
import { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { palettes, radius, space, type, fonts, TABLET_MIN_WIDTH } from './tokens';
import { useAppScheme } from './themePref';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const scheme = useAppScheme();
  const value = useMemo(() => ({ scheme, c: palettes[scheme], radius, space, type, fonts }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Tablets (and big phones in landscape) get the two-column layouts and side menu.
export function useIsTablet() {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN_WIDTH;
}
