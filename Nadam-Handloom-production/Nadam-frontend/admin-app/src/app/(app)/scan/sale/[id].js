// One sale (5.6): its sarees and prices, payment, invoice. Owners can cancel it on
// the day of the sale (6.2); Staff are told to ask an owner. A sale recorded without
// an invoice can get one later in its own month (Module 6, 6.5).
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../../hooks/useBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, TopBar } from '../../../../components/Screen';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card, SectionLabel } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { useFeedback } from '../../../../components/Feedback';
import { Thumb } from '../../../../components/catalog/Thumb';
import { TagChip } from '../../../../components/products/TagChip';
import { InvoiceActions } from '../../../../components/sales/InvoiceActions';
import { CancelSaleModal } from '../../../../components/sales/CancelSaleModal';
import { LockNote } from '../../../../components/sales/SaleParts';
import { useTheme } from '../../../../theme/ThemeProvider';
import * as sales from '../../../../api/sales';
import * as invoicesApi from '../../../../api/invoices';
import { PAY, plural, rupees } from '../../../../utils/sales';
import { formatMobile } from '../../../../utils/phone';

const BLOCKED = {
  OWNERS_ONLY: ['lock', 'Ask an owner to cancel this sale.'],
  NOT_TODAY: ['clock', 'Sales can be cancelled only on the day they were made.'],
  SHIPPED: ['orders', 'This WhatsApp order has been shipped, so it can\'t be cancelled here.'],
};

function Fact({ label, value, last }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <T variant="small" color="muted">{label}</T>
      <T variant="smallStrong" style={{ flex: 1, textAlign: 'right' }}>{value}</T>
    </View>
  );
}

export default function SaleDetail() {
  const goBack = useBack();
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { confirm, showToast } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try { setData(await sales.getSale(id)); setError(null); } catch (e) { setError(e.message); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function cancel(reason) {
    setBusy('cancel');
    try {
      const r = await sales.cancelSale(id, reason);
      setData(r);
      setCancelling(false);
      showToast(`Sale cancelled · ${plural(r.backInStock.length, 'saree')} back in stock`, 'success');
    } catch (e) {
      setCancelling(false);
      showToast(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'No internet. Cancelling needs internet.' : e.message);
      load();
    } finally {
      setBusy(null);
    }
  }
  // Module 6 (6.5): a customer comes back for an invoice for a sale recorded without one.
  function askLater() {
    confirm({
      icon: 'receipt', title: 'Make an invoice for this sale?',
      text: `It gets the next invoice number and today's date; the sale's date (${data.sale.date}) is printed on it too.`,
      actions: [{ label: 'Make the invoice', kind: 'primary', onPress: later }, { label: 'Cancel' }],
    });
  }
  async function later() {
    setBusy('later');
    try {
      const r = await invoicesApi.makeInvoiceLater(id);
      setData(r);
      showToast(`Invoice ${r.sale.invoice.number} made`, 'success');
    } catch (e) {
      showToast(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'No internet. Making an invoice needs internet.' : e.message);
    } finally {
      setBusy(null);
    }
  }
  async function remake() {
    setBusy('invoice');
    try { setData(await sales.makeInvoice(id)); showToast('Invoice ready', 'success'); } catch (e) { showToast(e.message); } finally { setBusy(null); }
  }

  const s = data?.sale;
  const a = data?.actions;
  const inv = s?.invoice;
  return (
    <Screen top={<TopBar title={s ? `Sale ${s.orderNumber}` : 'Sale'} onBack={goBack} />} contentStyle={{ paddingBottom: insets.bottom + 32 }}>
      {error ? <Banner tone="error" title="Couldn't open this sale" text={error} /> : null}
      {!s && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      {s ? (
        <>
          <T variant="small" color="muted" style={{ marginBottom: 12 }}>{s.date}, {s.time} · {s.soldBy?.name || 'Unknown'}</T>
          {s.cancelled ? (
            <Banner tone="error" title="Cancelled" style={{ marginBottom: 12 }}
              text={`${s.cancelled.reason || 'No reason given'} · ${s.cancelled.by?.name || 'An owner'}. The sarees are back in stock${inv?.number ? `; invoice ${inv.number} is marked CANCELLED.` : '.'}`} />
          ) : null}
          <Card>
            {s.lines.map((l, i) => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: i === s.lines.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                <Thumb uri={l.imageUrl} width={38} height={50} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="smallStrong" numberOfLines={1}>{l.name}</T>
                  {l.code ? <TagChip code={l.code} tone={s.cancelled ? 'plain' : 'sold'} /> : null}
                  <T variant="caption" color="muted">Store {rupees(l.storePrice)}{l.price !== l.storePrice ? ` · agreed ${rupees(l.price)}` : ''}</T>
                </View>
                <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(l.price * l.quantity)}</T>
              </View>
            ))}
          </Card>
          <Card style={{ marginTop: 12 }}>
            <Fact label="Total" value={`${rupees(s.total)}${s.savings > 0 ? ` (${rupees(s.savings)} off)` : ''}`} />
            <Fact label="Paid by" value={PAY[s.paymentMethod] || 'Not recorded'} />
            <Fact label="Where" value={s.channel === 'whatsapp' ? 'WhatsApp order' : 'At the counter'} />
            <Fact label="Invoice" value={!inv.required ? 'Not wanted' : inv.ready ? inv.number : 'Not made yet'} />
            {s.customer?.name ? <Fact label="Customer" value={s.customer.name} /> : null}
            {s.customer?.mobile ? <Fact label="Mobile" value={`+91 ${formatMobile(s.customer.mobile)}`} /> : null}
            {s.customer?.address ? <Fact label="Address" value={s.customer.address} /> : null}
            {s.shipping ? <Fact label="Shipping" value={s.shipping.status === 'not_shipped' ? 'To ship' : s.shipping.status} last /> : <Fact label="Order" value={s.orderNumber} last />}
          </Card>
          {a.makeInvoice ? <Button title={inv.ready ? 'Stamp the invoice CANCELLED' : 'Make the invoice again'} icon="refresh" loading={busy === 'invoice'} onPress={remake} style={{ marginTop: 14 }} /> : null}
          {a.makeInvoiceLater ? <Button title="Make an invoice" icon="plus" loading={busy === 'later'} onPress={askLater} style={{ marginTop: 14 }} /> : null}
          {a.makeInvoiceLaterBlocked === 'NOT_THIS_MONTH' ? <LockNote icon="clock" text="An invoice can be made only in the month of the sale, so a month that may be filed for GST never changes." style={{ marginTop: 14 }} /> : null}
          {inv.ready ? (
            <>
              <SectionLabel>Invoice {inv.number}{inv.cancelled ? ' · cancelled' : ''}</SectionLabel>
              <InvoiceActions invoice={inv} mobile={s.customer?.mobile} />
            </>
          ) : null}
          {a.cancel ? <Button title="Cancel sale" icon="xcircle" kind="danger" onPress={() => setCancelling(true)} style={{ marginTop: 24 }} /> : null}
          {!s.cancelled && BLOCKED[a.cancelBlocked] ? <LockNote icon={BLOCKED[a.cancelBlocked][0]} text={BLOCKED[a.cancelBlocked][1]} style={{ marginTop: 20 }} /> : null}
          <CancelSaleModal visible={cancelling} sale={s} busy={busy === 'cancel'} onClose={() => setCancelling(false)} onCancel={cancel} />
        </>
      ) : null}
    </Screen>
  );
}
