// One online payment in the list: order number and state, the customer and town, when,
// the amount (struck through when no money stayed), and a refund line when there is one.
import { View } from 'react-native';
import { Badge, Row } from '../Bits';
import { Icon } from '../Icon';
import { T } from '../T';
import { useTheme } from '../../theme/ThemeProvider';
import { rupees } from '../../utils/catalog';
import { METHOD_ICON, STATUS_TONE, refundText } from '../../utils/payments';

export function PaymentRow({ p, onPress, last }) {
  const { c, radius } = useTheme();
  const kept = p.status === 'paid' || p.status === 'confirming';
  const refund = refundText(p.refund, rupees);
  const who = [p.customer, p.town].filter(Boolean).join(', ');
  return (
    <Row last={last} onPress={onPress}
      accessibilityLabel={`${p.number}, ${p.statusText}, ${who}, ${p.when}, ${rupees(p.total)}${p.methodText ? `, ${p.methodText}` : ''}${refund ? `, ${refund}` : ''}`}
      leading={<View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: p.status === 'refund_stuck' ? c.dangerSoft : c.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.status === 'refund_stuck' ? 'alert' : METHOD_ICON[p.method] || 'card'} size={20} color={p.status === 'refund_stuck' ? c.danger : c.text2} /></View>}
      title={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{p.number}</T>
          <Badge text={p.statusText} tone={STATUS_TONE[p.status]} />
        </View>
      )}
      subtitle={[who, p.when, p.methodText].filter(Boolean).join(' · ') + (refund && p.status !== 'refunded' ? `\n${refund}` : '')}
      right={<T variant="bodyStrong" color={kept ? 'text' : 'muted'} style={{ fontVariant: ['tabular-nums'], textDecorationLine: kept ? 'none' : 'line-through' }}>{rupees(p.total)}</T>}
    />
  );
}
