import type { TextStyle } from 'react-native';

// Font family names as registered by useFonts() in App.tsx (from
// @expo-google-fonts/outfit) — the customer web's existing body font
// (frontend/customer-web/index.html), used exclusively across every screen
// and weight so the app reads as one consistent typeface, not a mix.
export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
};

// One typeface (Outfit) throughout, varying only by weight/size for
// hierarchy — headings and money figures lean on `bold`, everything else on
// lighter weights.
export const typography: Record<string, TextStyle> = {
  heroAmount: { fontFamily: fonts.bold, fontSize: 48, lineHeight: 52 },
  display: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 44 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 31 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24 },
  amount: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32 },
  price: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 23 },

  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20 },
  bodySemibold: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20 },
  bodySm: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  bodySmSemibold: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },

  // Uppercase section/field labels — letterSpacing approximates the
  // source's 0.06-0.08em tracking at these sizes.
  caption: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.9, textTransform: 'uppercase' },
  micro: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase' },

  button: { fontFamily: fonts.semibold, fontSize: 16 },
};
