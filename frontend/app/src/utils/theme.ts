// Design tokens for the "Nandam Soft Premium" design — matches
// Images/Nandam Soft Premium (standalone).html exactly: warm ivory ground,
// maroon accent, Instrument Serif display type + Public Sans body type,
// soft warm-tinted shadows instead of borders, 22-28px card radii.
export const colors = {
  primary: '#7A1F2B',
  primaryDark: '#5c141e',
  secondary: '#B07C2A',

  background: '#FAF6F1',
  surface: '#FFFFFF',

  text: '#241E1B',
  // Two near-identical warm greys from the source design: textMuted for
  // body/meta copy, textLabel for uppercase section labels.
  textMuted: '#7C716A',
  textLabel: '#756A63',
  textFaint: '#8a827c',
  iconMuted: '#c4b8ae',

  divider: '#F4EEE7',
  dividerLight: '#F0E9E1',

  // Soft surfaces used as row/tile backgrounds instead of borders.
  placeholderBg: '#F4EEE7',
  primaryBg: '#F6EDEE',
  segmentTrack: '#F1E9E0',
  inputBg: '#F6F1EB',

  success: '#4F7A63',
  successBg: '#EDF3EF',
  warning: '#B07C2A',
  warningBg: '#FBF0E4',
  error: '#A33127',
  errorBg: '#FAEBEA',

  // Alias so any file still styling a hairline border reads the divider tone.
  border: '#F4EEE7',
};

export { spacing } from './spacing';
export { typography } from './typography';
export { radius, shadow } from './radii';
