// The sales summary (Module 6, owner's pick A: one page). Period and channels, then
// Make the summary: the totals on screen, then Share PDF, Print, Excel file. Owners
// only (6.1). The PDF and the file are fetched with the sign-in key and kept on the
// phone (never a public link). Docs Module 6, section 5.3.
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../../hooks/useBack';
import * as Print from 'expo-print';
import { Screen, TopBar } from '../../../../components/Screen';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card, SectionLabel } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { useFeedback } from '../../../../components/Feedback';
import { ChoiceGroup, LockNote } from '../../../../components/sales/SaleParts';
import { CalendarModal } from '../../../../components/invoices/CalendarModal';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useCan, PERMISSION } from '../../../../auth/permissions';
import * as invoices from '../../../../api/invoices';
import { shareFile } from '../../../../../modules/nandam-share';
import { rupees } from '../../../../utils/catalog';
import { CHANNEL_ICON, CHANNEL_TEXT, PAY_TEXT, periodRange, rangeLabel } from '../../../../utils/invoices';

const ALL = ['store', 'whatsapp', 'online'];
const money2 = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Line({ label, value, strong }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <T variant={strong ? 'bodyStrong' : 'small'} color={strong ? 'text' : 'text2'}>{label}</T>
      <T variant={strong ? 'bodyStrong' : 'smallStrong'} style={{ fontVariant: ['tabular-nums'] }}>{value}</T>
    </View>
  );
}

export default function SalesSummary() {
  const goBack = useBack();
  const { c, radius } = useTheme();
  const owner = useCan(PERMISSION.SALES_VIEW);
  const { showToast } = useFeedback();
  const params = useLocalSearchParams();
  // Home's monthly reminder opens last month (Module 8, 6.6).
  const [period, setPeriod] = useState(params.period === 'last' ? 'last' : 'month');
  const [custom, setCustom] = useState(null);
  const [calendar, setCalendar] = useState(false);
  const [channels, setChannels] = useState(ALL);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const range = periodRange(period, custom);

  if (!owner) {
    return (
      <Screen top={<TopBar title="Sales summary" onBack={goBack} />}>
        <LockNote text="Money totals and the sales summary are for owners. You can still open, share and print any invoice." style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  const changed = () => { setResult(null); setError(null); };
  function toggle(ch) {
    setChannels((list) => (list.includes(ch) ? list.filter((x) => x !== ch) : ALL.filter((x) => x === ch || list.includes(x))));
    changed();
  }
  const query = { ...range, channels };

  async function make() {
    setBusy('make');
    setError(null);
    try {
      setResult(await invoices.makeSummary(query));
    } catch (e) {
      setError(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'No internet. The summary needs internet.' : e.message);
    } finally {
      setBusy(null);
    }
  }
  async function file(kind, then) {
    setBusy(kind === 'csv' ? 'csv' : then);
    try {
      const s = result.summary;
      const uri = await invoices.summaryFile(kind, query, kind === 'pdf' ? s.pdfName : s.csvName);
      await (then === 'print' ? Print.printAsync({ uri })
        : shareFile({ uri, mimeType: kind === 'pdf' ? 'application/pdf' : 'text/csv', caption: `Nandam Handlooms – sales summary, ${s.label}`, title: kind === 'pdf' ? 'Send the sales summary' : 'Send the Excel file' }));
    } catch (e) {
      showToast(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'No internet. Try again when it\'s back.' : e.message || 'Couldn\'t open it. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const s = result?.summary;
  return (
    <Screen
      top={<TopBar title="Sales summary" onBack={goBack} />}
      footer={<Button title={result ? 'Make it again' : 'Make the summary'} kind={result ? 'secondary' : 'primary'} loading={busy === 'make'} disabled={!channels.length || !!busy} onPress={make} />}
    >
      <T variant="small" color="muted" style={{ marginBottom: 12 }}>For you and the accountant: every invoice in the period, its GST, and sarees by name. Dates are invoice dates, India time.</T>
      <ChoiceGroup label="Period" value={period} onChange={(v) => { if (v === 'custom') setCalendar(true); else { setPeriod(v); changed(); } }}
        options={[['month', 'This month', 'calendar'], ['last', 'Last month', 'history'], ['custom', 'Custom', 'sliders']]} />
      <T variant="smallStrong" color="primary" style={{ marginTop: -8, marginBottom: 14 }}>{rangeLabel(range)}</T>
      <View accessibilityRole="none" style={{ gap: 7, marginBottom: 16 }}>
        <T variant="label" color="muted">Channels</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ALL.map((ch) => {
            const on = channels.includes(ch);
            return (
              <Button key={ch} title={CHANNEL_TEXT[ch]} icon={CHANNEL_ICON[ch]} kind={on ? 'primary' : 'secondary'} small onPress={() => toggle(ch)} accessibilityLabel={`${CHANNEL_TEXT[ch]}${on ? ', included' : ', left out'}`} style={{ flex: 1 }} />
            );
          })}
        </View>
        {!channels.length ? <T variant="caption" color="danger">Choose at least one channel.</T> : null}
      </View>

      {error ? <Banner tone="error" title="Couldn't make the summary" text={error} style={{ marginBottom: 12 }} /> : null}
      {s && s.empty ? (
        <Banner tone="info" title={`No invoices: ${s.label}`} text={s.withoutInvoice.sales ? `${plural(s.withoutInvoice.sales, 'sale')} without an invoice in these days: ${rupees(s.withoutInvoice.amount)}.` : 'Try another period or channel.'} />
      ) : null}
      {s && !s.empty ? (
        <>
          <SectionLabel>{s.label} · {s.channelsText}</SectionLabel>
          <Card style={{ padding: 16 }}>
            <T variant="small" color="muted">{plural(s.totals.invoices, 'invoice')} · {plural(s.totals.sarees, 'saree')}</T>
            <T variant="title" style={{ fontVariant: ['tabular-nums'], marginBottom: 8 }}>{money2(s.totals.total)}</T>
            <Line label="Taxable value" value={money2(s.totals.taxableValue)} />
            <Line label={`CGST @ ${(s.totals.gstRatePercent / 2).toFixed(1)}%`} value={money2(s.totals.cgst)} />
            <Line label={`SGST @ ${(s.totals.gstRatePercent / 2).toFixed(1)}%`} value={money2(s.totals.sgst)} />
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
            {Object.entries(s.byChannel).map(([k, v]) => <Line key={k} label={CHANNEL_TEXT[k]} value={rupees(v)} />)}
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 8 }} />
            {Object.entries(s.byPayment).map(([k, v]) => <Line key={k} label={PAY_TEXT[k]} value={rupees(v)} />)}
            {s.totals.cancelled ? <T variant="caption" color="muted" style={{ marginTop: 8 }}>{plural(s.totals.cancelled, 'cancelled invoice')} listed in the PDF, not counted.</T> : null}
          </Card>
          {s.withoutInvoice.sales ? (
            <View style={{ marginTop: 10, padding: 12, borderRadius: radius.md, backgroundColor: c.warningSoft }}>
              <T variant="smallStrong">{plural(s.withoutInvoice.sales, 'sale')} without an invoice: {rupees(s.withoutInvoice.amount)}</T>
              <T variant="small" color="text2">Not in the GST figures above (no invoice was issued). Ask your accountant whether they need reporting.</T>
            </View>
          ) : null}
          <View style={{ gap: 10, marginTop: 16 }}>
            <Button title="Share PDF" icon="share" loading={busy === 'share'} disabled={!!busy} onPress={() => file('pdf', 'share')} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Print" icon="print" kind="secondary" loading={busy === 'print'} disabled={!!busy} onPress={() => file('pdf', 'print')} style={{ flex: 1 }} />
              <Button title="Excel file" icon="sheet" kind="secondary" loading={busy === 'csv'} disabled={!!busy} onPress={() => file('csv', 'share')} style={{ flex: 1 }} />
            </View>
          </View>
        </>
      ) : null}
      {calendar ? <CalendarModal visible initial={custom} onClose={() => setCalendar(false)} onUse={(r) => { setCustom(r); setPeriod('custom'); setCalendar(false); changed(); }} /> : null}
    </Screen>
  );
}
