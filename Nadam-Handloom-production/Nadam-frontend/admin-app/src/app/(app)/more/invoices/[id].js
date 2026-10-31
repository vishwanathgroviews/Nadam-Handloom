// One invoice (Module 6, 5.2): every saree with its price, the GST, the customer;
// Share on WhatsApp, Print, Share another way (Module 5's buttons). Open the sale
// (cancel is there, owners, same day). Owners correct the customer (6.11).
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, TopBar } from '../../../../components/Screen';
import { Banner } from '../../../../components/Banner';
import { Card, Row, SectionLabel } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { useFeedback } from '../../../../components/Feedback';
import { Thumb } from '../../../../components/catalog/Thumb';
import { TagChip } from '../../../../components/products/TagChip';
import { InvoiceActions } from '../../../../components/sales/InvoiceActions';
import { LockNote } from '../../../../components/sales/SaleParts';
import { CorrectCustomerModal } from '../../../../components/invoices/CorrectCustomerModal';
import { useTheme } from '../../../../theme/ThemeProvider';
import * as invoices from '../../../../api/invoices';
import { rupees } from '../../../../utils/catalog';
import { formatMobile } from '../../../../utils/phone';
import { CHANNEL_TEXT, dayLabel, todayIst } from '../../../../utils/invoices';

const money2 = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BLOCKED = {
  NOT_THIS_MONTH: 'The customer can be corrected only in the invoice\'s own month.',
  ONLINE: 'An online order\'s customer comes from the website account.',
};

function Fact({ label, value, strong, last }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <T variant={strong ? 'smallStrong' : 'small'} color={strong ? 'text' : 'muted'}>{label}</T>
      <T variant="smallStrong" style={{ flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{value}</T>
    </View>
  );
}

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setData(await invoices.getInvoice(id)); setError(null); } catch (e) { setError(e.message); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save(v) {
    setSaving(true);
    try {
      setData(await invoices.correctCustomer(id, v));
      setCorrecting(false);
      showToast(`Saved. ${data.invoice.number} was made again with the same number.`, 'success');
    } catch (e) {
      showToast(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'No internet. Saving needs internet.' : e.message);
    } finally {
      setSaving(false);
    }
  }

  const inv = data?.invoice;
  const a = data?.actions;
  const when = inv ? `${inv.day === todayIst() ? 'Today' : dayLabel(inv.day)}, ${inv.time}` : '';
  return (
    <Screen top={<TopBar title={inv ? inv.number : 'Invoice'} onBack={() => router.back()} right={inv ? <T variant="small" color="muted" style={{ marginRight: 14 }}>{CHANNEL_TEXT[inv.channel]}</T> : null} />} contentStyle={{ paddingBottom: insets.bottom + 32 }}>
      {error ? <Banner tone="error" title="Couldn't open this invoice" text={error} /> : null}
      {!inv && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      {inv ? (
        <>
          <T variant="small" color="muted" style={{ marginBottom: 10 }}>{when}{inv.soldBy ? ` · sold by ${inv.soldBy.name}` : ''}</T>
          {inv.cancelled ? <Banner tone="error" title="Cancelled" text={`${inv.cancelledReason ? `${inv.cancelledReason}. ` : ''}Kept with its number, stamped CANCELLED; never counted in totals.`} style={{ marginBottom: 12 }} /> : null}
          {inv.saleDate ? <Banner tone="info" title="Made later" text={`For a sale on ${inv.saleDate} recorded without an invoice.`} style={{ marginBottom: 12 }} /> : null}
          <View style={{ alignItems: 'center', marginBottom: 6 }}>
            <T variant="display" color={inv.cancelled ? 'muted' : 'text'} style={{ fontVariant: ['tabular-nums'], textDecorationLine: inv.cancelled ? 'line-through' : 'none' }}>{rupees(inv.total)}</T>
            <T color="text2">{inv.lines.length} saree{inv.lines.length === 1 ? '' : 's'}{inv.savings > 0 ? ` · ${rupees(inv.savings)} off the store price` : ''}</T>
          </View>

          <SectionLabel>Customer</SectionLabel>
          <Card>
            <Row icon="user" title={inv.customer} subtitle={[inv.mobile ? `+91 ${formatMobile(inv.mobile)}` : 'No mobile', inv.address].filter(Boolean).join('\n')} last />
          </Card>

          <SectionLabel>Sarees</SectionLabel>
          <Card>
            {inv.lines.map((l, i) => (
              <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: i === inv.lines.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                <Thumb uri={l.imageUrl} width={38} height={50} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="smallStrong" numberOfLines={1}>{l.name}</T>
                  {l.code ? <TagChip code={l.code} tone={inv.cancelled ? 'plain' : 'sold'} /> : null}
                  <T variant="caption" color="muted">{l.price !== l.storePrice ? `Store ${rupees(l.storePrice)} · agreed ${rupees(l.price)}` : 'At the store price'}</T>
                </View>
                <T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(l.price * l.quantity)}</T>
              </View>
            ))}
          </Card>

          <SectionLabel>GST and payment</SectionLabel>
          <Card>
            <Fact label="Taxable value" value={money2(inv.gst.taxableValue)} />
            <Fact label={`CGST @ ${(inv.gst.ratePercent / 2).toFixed(1)}%`} value={money2(inv.gst.cgst)} />
            <Fact label={`SGST @ ${(inv.gst.ratePercent / 2).toFixed(1)}%`} value={money2(inv.gst.sgst)} />
            <Fact label="Total (GST included)" value={money2(inv.total)} strong />
            <Fact label="Paid by" value={inv.paidBy || (inv.channel === 'online' ? 'Online payment' : 'Not recorded (old app)')} />
            <Fact label="Order" value={inv.orderNumber} last />
          </Card>

          <SectionLabel>{inv.cancelled ? 'Keep a copy' : 'Send or print'}</SectionLabel>
          <InvoiceActions invoice={inv} mobile={inv.mobile} whatsapp={!inv.cancelled} />

          {a.openSale || a.correct || inv.channel === 'online' ? <Card style={{ marginTop: 16 }}>
            {a.openSale ? <Row icon="receipt" title="Open the sale" subtitle="Cancel is there (owners, the same day)" onPress={() => router.push(`/scan/sale/${inv.orderId}`)} last={!a.correct} /> : null}
            {inv.channel === 'online' ? <Row icon="orders" title="Online order" subtitle="Shipping and tracking are in Orders (Module 7)" last={!a.correct} /> : null}
            {a.correct ? <Row icon="edit" title="Correct the customer" subtitle="Name or mobile; same number and amounts" onPress={() => setCorrecting(true)} last /> : null}
          </Card> : null}
          {BLOCKED[a.correctBlocked] ? <LockNote icon="clock" text={BLOCKED[a.correctBlocked]} style={{ marginTop: 12 }} /> : null}
          {correcting ? <CorrectCustomerModal visible invoice={inv} busy={saving} onClose={() => setCorrecting(false)} onSave={save} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
