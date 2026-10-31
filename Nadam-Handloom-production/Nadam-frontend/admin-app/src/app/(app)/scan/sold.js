// After the sale (5.4): sold, with the order and invoice; share the invoice on
// WhatsApp, print it, or make it again if it failed. A WhatsApp order goes to Orders
// → To ship (Module 7). "Next customer" starts a new bill.
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../components/Screen';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { SectionLabel } from '../../../components/Bits';
import { SuccessMark } from '../../../components/SuccessMark';
import { T } from '../../../components/T';
import { useFeedback } from '../../../components/Feedback';
import { InvoiceActions } from '../../../components/sales/InvoiceActions';
import { useLastSale } from '../../../sales/bill';
import * as sales from '../../../api/sales';
import { PAY, plural, rupees } from '../../../utils/sales';

export default function Sold() {
  const { id } = useLocalSearchParams();
  const { showToast } = useFeedback();
  const last = useLastSale();
  const [data, setData] = useState(last?.sale?.id === id ? last : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Opened again later (the app was closed): read the sale from the server.
  useEffect(() => {
    if (data || !id) return;
    sales.getSale(id).then(setData, (e) => setError(e.message));
  }, [data, id]);

  const next = useCallback(() => { router.dismissAll(); }, []);
  // Android back goes to the camera for the next customer, never to the empty bill.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { next(); return true; });
    return () => sub.remove();
  }, [next]));

  async function remake() {
    setBusy(true);
    try {
      const r = await sales.makeInvoice(id);
      setData((d) => ({ ...d, ...r, invoiceFailed: false }));
      showToast(`Invoice ${r.sale.invoice.number} made`, 'success');
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  const s = data?.sale;
  const wa = s?.channel === 'whatsapp';
  const inv = s?.invoice;
  return (
    <Screen
      top={<TopBar title={wa ? 'WhatsApp order created' : 'Sold'} onBack={next} right={s ? <T variant="small" color="muted" style={{ marginRight: 14 }}>{s.orderNumber}</T> : null} />}
      footer={<Button title="Next customer" onPress={next} />}
    >
      {!s ? (
        error ? <Banner tone="error" title="Couldn't load this sale" text={`${error} The sale itself is saved; see Today's sales.`} style={{ marginTop: 20 }} /> : <T color="muted" style={{ marginTop: 40, textAlign: 'center' }}>Loading…</T>
      ) : (
        <>
          <SuccessMark />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <T variant="display" style={{ fontVariant: ['tabular-nums'] }}>{rupees(s.total)}</T>
            <T color="text2">{plural(s.lines.length, 'saree')} · {PAY[s.paymentMethod] || 'Paid'} · Order {s.orderNumber}</T>
            {s.savings > 0 ? <T variant="small" color="success">{rupees(s.savings)} off the store price</T> : null}
            <T color="text2">{!inv.required ? 'Recorded without an invoice' : inv.ready ? `Invoice ${inv.number}` : ''}</T>
          </View>
          {data.repeated ? <Banner tone="info" title="Already saved" text="Complete sale was sent twice (a slow network or a double tap). It's the same sale: nothing was sold twice." style={{ marginTop: 16 }} /> : null}
          {inv.required && !inv.ready ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Banner tone="warning" title="The invoice couldn't be made just now" text="The sale is saved. Make the invoice again now, or later from Today's sales." />
              <Button title="Make the invoice again" icon="refresh" loading={busy} onPress={remake} />
            </View>
          ) : null}
          {wa ? <Banner tone="info" icon="orders" title="It's in Orders → To ship" text="Add the courier details there when it's packed." style={{ marginTop: 16 }} /> : null}
          {inv.ready ? (
            <>
              <SectionLabel>Invoice {inv.number}</SectionLabel>
              <InvoiceActions invoice={inv} mobile={s.customer?.mobile} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
