// The "old → new" rows in the price check before saving (decision 5.4).
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../Icon';
import { T } from '../T';
import { discountPercent, rupees } from '../../utils/catalog';

export function PriceCheck({ changes, websitePrice, mrp }) {
  const { c, radius } = useTheme();
  const off = discountPercent(mrp, websitePrice);
  return (
    <View style={{ gap: 8, marginTop: 12 }}>
      {changes.map((ch) => (
        <View key={ch.key} style={{ padding: 11, borderRadius: radius.md, backgroundColor: ch.warning ? c.warningSoft : c.surface2, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="caption" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{ch.label}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <T variant="small" color="muted" style={{ textDecorationLine: 'line-through' }}>{rupees(ch.from)}</T>
              <Icon name="right" size={14} color={c.muted} />
              <T variant="bodyStrong">{rupees(ch.to)}</T>
            </View>
          </View>
          {ch.warning ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
              <Icon name="alert" size={15} color={c.warning} />
              <T variant="caption" color={c.warning} style={{ flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold' }}>{ch.warning}</T>
            </View>
          ) : null}
        </View>
      ))}
      <T variant="small" color="text2">Customers will see <T variant="smallStrong">{rupees(websitePrice)}</T>{off ? `, MRP ${rupees(mrp)} (${off}% off)` : ''}.</T>
    </View>
  );
}
