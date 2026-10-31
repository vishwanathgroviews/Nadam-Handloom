// One online payment (owners): the amount and state, what needs doing (a refund stuck, a
// paid order cancelled), the customer, the sarees, each payment try, refunds, Razorpay's
// notices and ids, and the order itself. Opened from the list or from a notification.
import { useCallback, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../../hooks/useBack';
import { Screen, TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Badge, Card, Row, SectionLabel } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { Thumb } from '../../../../components/catalog/Thumb';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useOnResume } from '../../../../gate/store';
import * as payments from '../../../../api/payments';
import { rupees } from '../../../../utils/catalog';
import { formatMobile } from '../../../../utils/phone';
import { STATUS_TONE, noticeText, refundText } from '../../../../utils/payments';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function PaymentDetail() {
  const goBack = useBack();
  const { number } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setData(await payments.getPayment(number)); setError(null); } catch (e) { setError(e); }
  }, [number]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnResume(load);

  const p = data?.payment;
  const share = (text) => Share.share({ message: text });
  return (
    <Screen top={<><StatusBanner /><TopBar title={String(number || 'Payment')} onBack={goBack} /></>} maxWidth={680}>
      {error ? (
        <View style={{ gap: 10 }}>
          <Banner tone="error" title={error.code === 'PAYMENT_NOT_FOUND' ? 'Payment not found' : 'Couldn\'t load this payment'} text={error.message} />
          {error.code !== 'PAYMENT_NOT_FOUND' ? <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} /> : null}
        </View>
      ) : null}
      {!p && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      {p ? (
        <>
          <View style={{ padding: 18, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 6 }}
            accessibilityLabel={`${p.statusText}, ${rupees(p.total)}, order ${p.number}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge text={p.statusText} tone={STATUS_TONE[p.status]} />
              <Badge text={`Order: ${p.orderStatusText}`} tone="neutral" />
            </View>
            <T variant="display" style={{ fontVariant: ['tabular-nums'] }}>{rupees(p.total)}</T>
            <T variant="small" color="muted">{[p.methodText ? `By ${p.methodText}` : null, `Ordered ${p.when}`, plural(p.sarees, 'saree')].filter(Boolean).join(' · ')}</T>
          </View>

          {p.status === 'refund_stuck' ? (
            <Banner tone="error" title="Refund stuck: please refund by hand" style={{ marginTop: 12 }}
              text={`Razorpay refused to refund ${rupees(p.refund?.amount ?? p.total)}${p.refund?.error ? ` (${p.refund.error})` : ''}. Open the payment in the Razorpay dashboard and refund it there.`} />
          ) : null}
          {p.status === 'refund_by_hand' ? (
            <Banner tone="warning" title="Cancelled after paying" style={{ marginTop: 12 }}
              text={`${p.cancelReason ? `${p.cancelReason}. ` : ''}Refund ${rupees(p.total)} in the Razorpay dashboard if it isn't done yet.`} />
          ) : null}
          {p.status === 'confirming' ? <Banner tone="info" title="Confirming with the bank" text="The customer paid; Razorpay hasn't confirmed it yet. The server checks every minute and completes the order by itself." style={{ marginTop: 12 }} /> : null}
          {p.status === 'refunded' && p.refund ? <Banner tone="info" title={refundText(p.refund, rupees)} text={`${p.refund.reason || 'The payment couldn\'t be used'}. Razorpay returns it to the customer in 5 to 7 working days.`} style={{ marginTop: 12 }} /> : null}
          {p.status === 'not_paid' && p.hold?.held ? <Banner tone="info" title={`Sarees held until ${p.hold.untilText}`} text="The customer hasn't paid yet. If they don't, the sarees go back on sale by themselves." style={{ marginTop: 12 }} /> : null}

          <SectionLabel>Customer</SectionLabel>
          <Card>
            <Row icon="user" title={p.customer.name} subtitle={p.customer.lines.join(', ') || null} />
            {p.customer.mobile ? <Row icon="phone" title={`+91 ${formatMobile(p.customer.mobile)}`} subtitle="Call" onPress={() => Linking.openURL(`tel:+91${p.customer.mobile}`)} last={!p.customer.email} /> : null}
            {p.customer.email ? <Row icon="message" title={p.customer.email} subtitle="Email" last /> : null}
          </Card>

          <SectionLabel>Sarees</SectionLabel>
          <Card>
            {p.items.map((it, i) => (
              <Row key={`${it.sku}-${i}`} last={i === p.items.length - 1}
                leading={<Thumb uri={it.imageUrl} width={40} height={52} />}
                title={it.name} subtitle={[it.sku, it.quantity > 1 ? `${it.quantity} × ${rupees(it.price)}` : null].filter(Boolean).join(' · ')}
                right={<T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(it.price * it.quantity)}</T>} />
            ))}
          </Card>

          <SectionLabel>Payment tries</SectionLabel>
          <Card>
            {p.tries.length ? p.tries.map((t, i) => (
              <Row key={t.razorpayOrderId} last={i === p.tries.length - 1} icon={t.status === 'paid' ? 'check' : t.status === 'failed' ? 'xcircle' : t.refund ? 'refresh' : 'clock'}
                title={t.statusText}
                subtitle={[`${rupees(t.amount)}${t.methodText ? ` · ${t.methodText}` : ''}`, t.paidWhen ? `Paid ${t.paidWhen}` : `Opened ${t.when}`,
                  t.refund ? `${refundText(t.refund, rupees)}${t.refund.tries ? ` · ${plural(t.refund.tries, 'refusal')}` : ''}${t.refund.when ? ` · ${t.refund.when}` : ''}` : null,
                  t.paymentId].filter(Boolean).join('\n')} />
            )) : <Row icon="info" title="Made on the old website" subtitle="Its tries weren't recorded" last />}
          </Card>

          {p.notices.length ? (
            <>
              <SectionLabel>Razorpay&apos;s notices</SectionLabel>
              <Card>
                {p.notices.map((n, i) => <Row key={`${n.type}-${i}`} icon="cloud" title={noticeText(n.type)} subtitle={`${n.when} · ${n.result}`} last={i === p.notices.length - 1} />)}
              </Card>
            </>
          ) : null}

          <SectionLabel>Razorpay</SectionLabel>
          <Card>
            {p.razorpayPaymentId ? <Row icon="card" title={p.razorpayPaymentId} subtitle="Payment id · tap to share" onPress={() => share(p.razorpayPaymentId)} /> : null}
            {p.razorpayOrderId ? <Row icon="receipt" title={p.razorpayOrderId} subtitle="Razorpay order id · tap to share" onPress={() => share(p.razorpayOrderId)} last={!p.invoiceNumber} /> : null}
            {p.invoiceNumber ? <Row icon="receipt" title={p.invoiceNumber} subtitle="GST invoice" last /> : null}
          </Card>

          {p.canOpenOrder ? <Button title="Open the order" icon="orders" kind="secondary" onPress={() => router.push(`/orders/order/${p.id}`)} style={{ marginTop: 20 }} /> : null}
          <View style={{ height: 30 }} />
        </>
      ) : null}
    </Screen>
  );
}
