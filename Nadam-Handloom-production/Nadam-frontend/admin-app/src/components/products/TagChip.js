// A tag number in a small box: NH3136. Tones: plain, ok (green), bad (red), wait (amber), sold (struck through).
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';
import { T } from '../T';

export function TagChip({ code, tone = 'plain', big = false }) {
  const { c } = useTheme();
  const [bg, fg, border] = {
    plain: [c.surface2, c.text2, c.border], ok: [c.successSoft, c.success, 'transparent'], bad: [c.dangerSoft, c.danger, 'transparent'],
    wait: [c.warningSoft, c.warning, 'transparent'], sold: [c.surface2, c.muted, c.border],
  }[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: big ? 10 : 6, paddingVertical: big ? 5 : 2, borderRadius: 6, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Icon name="barcode" size={big ? 16 : 12} color={fg} />
      <T variant={big ? 'bodyStrong' : 'caption'} color={fg} style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.3, textDecorationLine: tone === 'sold' ? 'line-through' : 'none' }}>{code}</T>
    </View>
  );
}
