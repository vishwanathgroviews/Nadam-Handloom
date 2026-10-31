// One invoice in the list: number, channel, customer, date and time, total; a
// cancelled one is marked and its total struck through (never counted).
import { View } from 'react-native';
import { Badge, Row } from '../Bits';
import { Icon } from '../Icon';
import { T } from '../T';
import { useTheme } from '../../theme/ThemeProvider';
import { rupees } from '../../utils/catalog';
import { CHANNEL_ICON, CHANNEL_TEXT, dayLabel, todayIst } from '../../utils/invoices';

export function InvoiceRow({ inv, onPress, last }) {
  const { c, radius } = useTheme();
  const when = inv.day === todayIst() ? 'Today' : dayLabel(inv.day);
  return (
    <Row last={last} onPress={onPress}
      accessibilityLabel={`${inv.number}, ${CHANNEL_TEXT[inv.channel]}, ${inv.customer}, ${when} ${inv.time}, ${rupees(inv.total)}${inv.cancelled ? ', cancelled' : ''}`}
      leading={<View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={CHANNEL_ICON[inv.channel]} size={20} color={c.text2} /></View>}
      title={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{inv.number}</T>
          <Badge text={CHANNEL_TEXT[inv.channel]} tone={inv.channel === 'whatsapp' ? 'success' : 'neutral'} />
          {inv.cancelled ? <Badge text="Cancelled" tone="danger" /> : null}
        </View>
      )}
      subtitle={`${inv.customer} · ${when}, ${inv.time}`}
      right={<T variant="bodyStrong" color={inv.cancelled ? 'muted' : 'text'} style={{ fontVariant: ['tabular-nums'], textDecorationLine: inv.cancelled ? 'line-through' : 'none' }}>{rupees(inv.total)}</T>}
    />
  );
}
