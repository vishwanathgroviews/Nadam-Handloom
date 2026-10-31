// Pieces shared by the Analytics pages (Module 9): a card, the figures with their
// change, a thin bar, a design row.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { T } from '../T';
import { Thumb } from '../catalog/Thumb';
import { rupees } from '../../utils/catalog';
import { plural } from '../../utils/sales';
import { share } from '../../utils/analytics';

export function Panel({ title, note, children, style }) {
  const { c, radius } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, padding: 14, gap: 10 }, style]}>
      {title ? <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}><T variant="smallStrong">{title}</T>{note ? <T variant="caption" color="muted">{note}</T> : null}</View> : null}
      {children}
    </View>
  );
}
export function Kpis({ items }) {
  const { c } = useTheme();
  const tones = { up: c.success, down: c.warning, same: c.muted, none: c.muted };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
      {items.map((k) => (
        <View key={k.label} style={{ width: '50%', paddingRight: 8, gap: 1 }}>
          <T variant="caption" color="muted">{k.label}</T>
          <T variant="heading" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{k.value}</T>
          {k.change ? <T variant="caption" style={{ color: tones[k.change.tone], fontFamily: k.change.tone === 'none' ? undefined : 'PlusJakartaSans_700Bold' }}>{k.change.text}</T> : null}
        </View>
      ))}
    </View>
  );
}
export function Meter({ value, max, colour }) {
  const { c } = useTheme();
  return <View style={{ height: 5, borderRadius: 3, backgroundColor: c.surface3, overflow: 'hidden' }}><View style={{ width: `${share(value, max)}%`, height: '100%', borderRadius: 3, backgroundColor: colour || c.primary }} /></View>;
}
export function DesignRow({ d, rank, max, by, last }) {
  const { c } = useTheme();
  const v = by === 'amount' ? d.amount : d.sarees;
  return (
    <Pressable accessibilityRole="button" disabled={!d.id} onPress={() => router.push(`/products/sub/${d.id}?back=${encodeURIComponent('/more/analytics')}`)} android_ripple={{ color: c.surface2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
        {rank ? <T variant="smallStrong" color="muted" style={{ width: 20, textAlign: 'center' }}>{rank}</T> : null}
        <Thumb uri={d.imageUrl} width={36} height={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="smallStrong" numberOfLines={2}>{d.name}</T>
          <T variant="caption" color="muted">{plural(d.sarees, 'saree')} · {rupees(d.amount)}</T>
          <Meter value={v} max={max} />
        </View>
      </View>
    </Pressable>
  );
}
