// Complete sale, on one page (owner's pick A): Where · Paid by · Invoice · Customer,
// then one tap sells every saree together, or none (5.3). Safe to tap twice or on a
// slow network: the bill's id makes a repeat return the same sale. No internet: the
// bill waits on the phone (6.4). A saree that became unavailable is named.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen, TopBar } from '../../../components/Screen';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Card, SectionLabel } from '../../../components/Bits';
import { MobileField } from '../../../components/MobileField';
import { TextField } from '../../../components/TextField';
import { T } from '../../../components/T';
import { useFeedback } from '../../../components/Feedback';
import { BillLine, ChoiceGroup } from '../../../components/sales/SaleParts';
import { useOnline } from '../../../hooks/useOnline';
import { billStore, useBill } from '../../../sales/bill';
import * as sales from '../../../api/sales';
import { billTotals, completeErrors, plural, rupees, saleRequest } from '../../../utils/sales';

const FIELD = { paymentMethod: 'pay', channel: 'where', invoice: 'invoice', 'customer.name': 'name', 'customer.mobile': 'mobile', 'customer.address': 'address' };
const SHORT = { ALREADY_SOLD: 'Just sold on another phone', DAMAGED: 'Marked damaged', ONLINE_ONLY: 'Set to Online only', SWITCHED_OFF: 'Switched off', GONE: 'Not in the shop any more', DELETED: 'Deleted', TAG_RETIRED: 'Tag replaced', NOT_FOR_SALE: 'Not in stock' };

export default function Complete() {
  const online = useOnline();
  const { confirm, showToast } = useFeedback();
  const bill = useBill();
  const f = bill.form;
  const t = billTotals(bill.lines);
  const wa = f.where === 'whatsapp';
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null); // { tone, title, text, action }
  const [busy, setBusy] = useState(false);
  const set = (patch) => { billStore.setForm(patch); setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n; }); };
  const changedLine = bill.lines.find((l) => l.pieceId === bill.changed?.pieceId);

  async function submit() {
    const b = billStore.getState().bill;
    const errs = completeErrors(b.form, b.lines);
    setErrors(errs);
    if (Object.keys(errs).length) { setProblem(errs.lines ? { tone: 'error', title: 'Check the bill', text: errs.lines } : null); return; }
    setProblem(null);
    setBusy(true);
    billStore.setPending(true); // until the server answers: a lost answer must not become a different bill
    try {
      const r = await sales.completeSale(saleRequest(b));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      billStore.sold(r);
      router.replace(`/scan/sold?id=${r.sale.id}`);
    } catch (e) {
      const d = e.details || {};
      if (e.code === 'NETWORK' || e.code === 'TIMEOUT') {
        setProblem({ tone: 'warning', title: 'No answer from the server', text: 'The bill is kept on this phone. Tap Complete sale again when the internet is back: if the sale already went through, you\'ll see it. Nothing is sold twice.' });
        return;
      }
      billStore.setPending(false); // the server answered: nothing was sold
      if (e.code === 'LINE_CHANGED' && d.reason === 'PRICE_CHANGED') {
        billStore.setStorePrice(d.pieceId, d.storePrice);
        setProblem({ tone: 'warning', title: 'A store price changed: nothing was sold', text: `${d.code} now costs ${rupees(d.storePrice)} in the catalogue. The bill shows the new price; check it with the customer, then tap Complete sale again.` });
      } else if (e.code === 'LINE_CHANGED') {
        billStore.markChanged({ pieceId: d.pieceId, message: e.message, short: SHORT[d.reason] || 'Can\'t be sold now' });
        setProblem(null);
      } else if (e.code === 'HELD_ONLINE') {
        if (d.canSellAnyway) {
          confirm({
            sticky: true, tone: 'warning', icon: 'clock', title: `${d.code}: sell it anyway?`, text: `${e.message} Nothing was sold yet.`,
            actions: [
              { label: 'Sell anyway and complete', kind: 'dangerSolid', onPress: () => { billStore.setHeld(d.pieceId); setTimeout(submit, 250); } },
              { label: 'Remove it from the bill', onPress: () => billStore.remove(d.pieceId) },
              { label: 'Back' },
            ],
          });
        } else {
          billStore.markChanged({ pieceId: d.pieceId, message: e.message, short: 'Held by an online checkout' });
        }
      } else if (e.code === 'VALIDATION_FAILED') {
        const fe = {};
        (d.issues || []).forEach((i) => { if (FIELD[i.field]) fe[FIELD[i.field]] = i.message; });
        setErrors(fe);
        setProblem(Object.keys(fe).length ? null : { tone: 'error', title: 'Nothing was sold', text: e.message });
      } else {
        setProblem({ tone: 'error', title: 'Nothing was sold', text: e.message });
      }
    } finally {
      setBusy(false);
    }
  }

  function removeChanged() {
    billStore.remove(bill.changed.pieceId);
    showToast('Taken off the bill');
    if (billStore.getState().bill.lines.length) setTimeout(submit, 200);
    else router.back();
  }

  return (
    <Screen
      top={<TopBar title={wa ? 'WhatsApp order' : 'Complete sale'} onBack={() => router.back()} right={<T variant="small" color="muted" style={{ marginRight: 14 }}>{plural(t.count, 'saree')} · {rupees(t.total)}</T>} />}
      footer={<Button title={`${bill.pending && !busy ? 'Send again' : wa ? 'Create WhatsApp order' : 'Complete sale'} · ${rupees(t.total)}`} loading={busy} disabled={!t.count} onPress={submit} />}
    >
      {!online ? <Banner tone="warning" icon="wifioff" title="No internet" text="The bill is kept on this phone. Complete sale works as soon as the internet is back." style={{ marginBottom: 12 }} /> : null}
      {problem ? <Banner tone={problem.tone} title={problem.title} text={problem.text} style={{ marginBottom: 12 }} /> : null}
      {changedLine ? (
        <View style={{ marginBottom: 14 }}>
          <Banner tone="error" title="Nothing was sold" text={bill.changed.message} />
          <Card style={{ marginTop: 10 }}>
            <BillLine line={changedLine} editable={false} changed={bill.changed.short} last />
          </Card>
          <Button title={`Remove ${changedLine.code} and complete`} onPress={removeChanged} style={{ marginTop: 10 }} />
        </View>
      ) : null}

      <ChoiceGroup label="Where" value={f.where} error={errors.where} onChange={(v) => set({ where: v })}
        options={[['store', 'At the counter', 'store'], ['whatsapp', 'WhatsApp order', 'whatsapp']]} />
      <ChoiceGroup label="Paid by" value={f.pay} error={errors.pay} onChange={(v) => set({ pay: v })}
        options={[['cash', 'Cash', 'cash'], ['upi', 'UPI', 'upi'], ['card', 'Card', 'card']]} />
      <ChoiceGroup label="Invoice" value={f.invoice} error={errors.invoice} onChange={(v) => set({ invoice: v })}
        options={[[true, 'Yes', 'receipt'], [false, 'No', 'xcircle']]} />

      <SectionLabel>{wa ? 'Customer' : 'Customer · optional'}</SectionLabel>
      <TextField label={wa ? 'Name' : 'Name (optional)'} value={f.name} onChange={(v) => set({ name: v })} error={errors.name} maxLength={60} autoCapitalize="words" />
      <MobileField value={f.mobile} onChange={(v) => set({ mobile: v })} error={errors.mobile}
        hint={wa ? 'For the courier and to send the invoice.' : 'Optional. Goes on the invoice and is used to send it on WhatsApp.'} />
      {wa ? <TextField label="Delivery address" value={f.address} onChange={(v) => set({ address: v })} error={errors.address} multiline maxLength={600} placeholder="House, street, town, PIN" /> : null}
    </Screen>
  );
}
