// One order in the Orders tab: number, Online / WhatsApp, customer and town, sarees,
// total, and how long it has waited (amber after a day) or where it is.
import { View } from 'react-native';
import { Badge, Row } from '../Bits';
import { T } from '../T';
import { Thumb } from '../catalog/Thumb';
import { rupees } from '../../utils/catalog';
import { rowStatus } from '../../utils/orders';

export function OrderRow({ o, onPress, last }) {
  const st = rowStatus(o);
  return (
    <Row last={last} onPress={onPress}
      accessibilityLabel={`${o.orderNumber}, ${o.channel === 'online' ? 'Online' : 'WhatsApp'}, ${o.customer}, ${o.sarees} saree${o.sarees === 1 ? '' : 's'}, ${rupees(o.total)}, ${st.text}`}
      leading={<Thumb uri={o.imageUrl} width={42} height={56} />}
      title={(
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{o.orderNumber}</T>
            <Badge text={o.channel === 'online' ? 'Online' : 'WhatsApp'} tone={o.channel === 'online' ? 'neutral' : 'success'} />
            {o.status === 'cancelled' ? <Badge text="Cancelled" tone="danger" /> : null}
          </View>
          <T variant="small" color="muted" numberOfLines={1}>{o.customer}{o.town ? ` · ${o.town}` : ''} · {o.sarees} saree{o.sarees === 1 ? '' : 's'}</T>
          <T variant="caption" color={st.warn ? 'warning' : 'muted'} style={st.warn ? { fontFamily: 'PlusJakartaSans_700Bold' } : null}>{st.text}</T>
        </View>
      )}
      right={<T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(o.total)}</T>}
    />
  );
}
