// Design tokens chosen on 2026-10-11 (docs/modules/module-01-sign-in.md, section 13):
// Peacock palette, Plus Jakarta Sans, soft corners, theme follows the phone.
// Same values as the approved mock-up (assets/mock.css, palette B). onDanger (text on a
// solid red, added 2026-10-12): white on the light theme's red, dark on the dark theme's
// lighter red, like onPrimary, so the text stays readable (white on #FF7D70 was 2.5:1).
export const palettes = {
  light: {
    bg: '#F3F6F4', surface: '#FFFFFF', surface2: '#EBF0ED', surface3: '#DFE7E3',
    text: '#121B1A', text2: '#3C4A48', muted: '#62716F', border: '#D9E2DE', borderStrong: '#BCCBC5',
    primary: '#0D5C61', primaryStrong: '#073F43', primarySoft: '#E0F0EE', onPrimary: '#FFFFFF',
    accent: '#C46A35', accentSoft: '#F8E8DD', onAccent: '#2B1204',
    weaveA: '#073F43', weaveB: '#12707A', weaveThread: '#D98450',
    success: '#177A47', successSoft: '#E2F4EA', warning: '#A35F0A', warningSoft: '#FCEFD9',
    danger: '#BF3328', dangerSoft: '#FBE6E3', onDanger: '#FFFFFF', info: '#2160A3', infoSoft: '#E3EEFA',
    overlay: 'rgba(14,14,22,0.48)', shadow: '#000000',
  },
  dark: {
    bg: '#091514', surface: '#0F201F', surface2: '#152B29', surface3: '#1C3734',
    text: '#E8F3F1', text2: '#B3C9C5', muted: '#84A09B', border: '#213B38', borderStrong: '#2E504C',
    primary: '#5FC6BE', primaryStrong: '#8FDDD6', primarySoft: '#133935', onPrimary: '#03201E',
    accent: '#E8996A', accentSoft: '#3B2416', onAccent: '#2B1204',
    weaveA: '#062826', weaveB: '#0E4441', weaveThread: '#C47C50',
    success: '#4CC88A', successSoft: '#12301F', warning: '#F0B04E', warningSoft: '#36270C',
    danger: '#FF7D70', dangerSoft: '#3A1614', onDanger: '#2B0A07', info: '#6FAEF2', infoSoft: '#122A44',
    overlay: 'rgba(0,0,0,0.62)', shadow: '#000000',
  },
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 }; // "soft" corners

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 27, letterSpacing: -0.3 },
  barTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  mono: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: 2 },
};

export const TABLET_MIN_WIDTH = 700;
