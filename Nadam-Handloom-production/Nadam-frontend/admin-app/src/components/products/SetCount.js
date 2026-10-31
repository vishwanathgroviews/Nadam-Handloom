// Sets (client's request, 15 Oct 2026; owner's pick A): several identical sarees share
// one photo, one tag each. "Sarees in this photo − 1 +" says how many tags to scan;
// 1 is a normal saree. SetTags lists a photo's tags, each with ✕ to take it off.
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { MAX_SET } from '../../utils/products';
import { Icon } from '../Icon';
import { T } from '../T';

export function SetCount({ value, scanned, onChange, dark = false }) {
  const { c, radius } = useTheme();
  const fg = dark ? '#fff' : c.text;
  const sub = dark ? 'rgba(255,255,255,0.75)' : c.muted;
  const btn = (label, sign, disabled) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => onChange(value + sign)} hitSlop={4}
      style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.35)' : c.borderStrong, backgroundColor: dark ? 'rgba(255,255,255,0.16)' : c.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <T variant="barTitle" color={fg}>{sign < 0 ? '−' : '+'}</T>
    </Pressable>
  );
  const note = value > 1 ? (scanned >= value ? `All ${value} tags scanned` : `Tag ${scanned + 1} of ${value}`) : 'More of this design in the photo? Tap +';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 12, paddingRight: 6, borderRadius: radius.md, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.22)' : c.border, backgroundColor: dark ? 'rgba(255,255,255,0.12)' : c.surface2 }}>
      <View style={{ flex: 1 }}>
        <T variant="smallStrong" color={fg}>Sarees in this photo</T>
        <T variant="caption" color={sub}>{note}</T>
      </View>
      {btn('One fewer saree in this photo', -1, value <= 1)}
      <T variant="barTitle" color={fg} style={{ minWidth: 30, textAlign: 'center' }} accessibilityLiveRegion="polite">{value}</T>
      {btn('One more saree in this photo', 1, value >= MAX_SET)}
    </View>
  );
}

export function SetTags({ codes, onRemove, dark = false, center = true, unchecked = false }) {
  const { c } = useTheme();
  const [bg, fg] = unchecked ? [c.warningSoft, c.warning] : [c.successSoft, c.success];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: center ? 'center' : 'flex-start' }}>
      {codes.map((code) => (
        <View key={code} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, borderRadius: 6, backgroundColor: dark ? 'rgba(23,122,71,0.9)' : bg }}>
          <Icon name="barcode" size={13} color={dark ? '#fff' : fg} />
          <T variant="caption" color={dark ? '#fff' : fg} style={{ fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 0.3 }}>{code}</T>
          <Pressable accessibilityRole="button" accessibilityLabel={`Take ${code} off this photo`} onPress={() => onRemove(code)} hitSlop={6}
            style={{ width: 30, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={13} color={dark ? '#fff' : fg} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
