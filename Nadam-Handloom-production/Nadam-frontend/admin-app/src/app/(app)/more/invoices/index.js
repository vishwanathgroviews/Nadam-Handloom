// Invoices (Module 6, owner's pick A: rows, newest first). Search by number, name,
// mobile or tag (every date); period and channel chips; Owners see the totals and the
// sales without an invoice, Staff the list only (6.1). Dates are the invoice date in
// India time (6.7). Docs Module 6, section 5.1.
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { SearchBox } from '../../../../components/SearchBox';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card, Row } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { T } from '../../../../components/T';
import { FilterChips } from '../../../../components/catalog/FilterChips';
import { InvoiceRow } from '../../../../components/invoices/InvoiceRow';
import { CalendarModal } from '../../../../components/invoices/CalendarModal';
import { LockNote } from '../../../../components/sales/SaleParts';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { useCan, PERMISSION } from '../../../../auth/permissions';
import * as invoices from '../../../../api/invoices';
import { rupees } from '../../../../utils/catalog';
import { PERIOD_TEXT, periodRange, rangeLabel } from '../../../../utils/invoices';
import { useOnResume } from '../../../../gate/store';
import { nearEnd } from '../../../../hooks/usePaged';

const CHANNELS = [['all', 'All channels'], ['store', 'Counter'], ['whatsapp', 'WhatsApp'], ['online', 'Online'], ['cancelled', 'Cancelled']];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function Invoices() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.SALES_VIEW);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('month');
  const [custom, setCustom] = useState(null);
  const [calendar, setCalendar] = useState(false);
  const [chip, setChip] = useState('all');
  const [data, setData] = useState(null);
  const [without, setWithout] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(0);

  // The search waits until typing pauses.
  useEffect(() => { const t = setTimeout(() => setQuery(q), 350); return () => clearTimeout(t); }, [q]);
  const range = periodRange(period, custom);
  const filter = { q: query, ...range, channel: chip === 'cancelled' ? 'all' : chip, cancelled: chip === 'cancelled' };

  const load = useCallback(async () => {
    const n = ++asked.current;
    const r0 = periodRange(period, custom);
    const f = { q: query, ...r0, channel: chip === 'cancelled' ? 'all' : chip, cancelled: chip === 'cancelled' };
    try {
      const r = await invoices.listInvoices(f);
      if (n !== asked.current) return; // a newer search or filter already answered
      setData(r);
      setError(null);
      if (owner && !f.q.trim() && !f.cancelled && f.channel !== 'online') {
        invoices.salesWithout({ from: f.from, to: f.to, channel: f.channel }).then((w) => { if (n === asked.current) setWithout(w); }, () => setWithout(null));
      } else setWithout(null);
    } catch (e) {
      if (n === asked.current) setError(e.message);
    }
  }, [query, period, custom, chip, owner]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnResume(load);

  // The next 20: near the end of the list, or "Show more".
  async function showMore() {
    if (more || !data?.nextOffset) return;
    setMore(true);
    const n = asked.current;
    try {
      const r = await invoices.listInvoices({ ...filter, offset: data.nextOffset });
      if (n === asked.current) setData((d) => ({ ...d, invoices: [...d.invoices, ...r.invoices.filter((i) => !d.invoices.some((x) => x.id === i.id))], nextOffset: r.nextOffset }));
    } catch (e) {
      setError(e.message);
    } finally {
      setMore(false);
    }
  }
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const searching = !!query.trim();
  const label = searching ? 'All dates' : period === 'custom' ? rangeLabel(range) : PERIOD_TEXT[period];
  const periods = [['today', 'Today'], ['month', 'This month'], ['last', 'Last month'], ['custom', period === 'custom' ? rangeLabel(range) : 'Custom'], ['all', 'All']];
  const list = data?.invoices ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Invoices" onBack={() => router.back()} right={owner ? <Button title="Summary" icon="chart" kind="ghost" small onPress={() => router.push('/more/invoices/summary')} style={{ marginRight: 6 }} /> : null} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onScroll={(e) => { if (nearEnd(e)) showMore(); }} scrollEventThrottle={200}>
        <SearchBox value={q} onChange={setQ} placeholder="Number, name, mobile or tag" label="Search invoices" />
        {searching ? <T variant="caption" color="muted" style={{ marginBottom: 10 }}>Searching every date.</T> : (
          <FilterChips items={periods} value={period} onChange={(k) => (k === 'custom' ? setCalendar(true) : setPeriod(k))} />
        )}
        <FilterChips items={CHANNELS} value={chip} onChange={setChip} />

        {error ? <Banner tone="error" title="Couldn't load the invoices" text={error} style={{ marginBottom: 12 }} /> : null}
        {data && owner ? (
          <View accessibilityLabel={`${label}, ${data.totals.count} invoices, ${rupees(data.totals.amount)}`} style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 10 }}>
            <View>
              <T variant="small" color="muted">{label} · {plural(data.totals.count, 'invoice')}</T>
              <T variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{rupees(data.totals.amount)}</T>
            </View>
            <T variant="caption" color="muted" style={{ flexShrink: 1, textAlign: 'right' }}>{data.totals.cancelled ? `${plural(data.totals.cancelled, 'cancelled invoice')}, not counted` : 'Cancelled invoices never counted'}</T>
          </View>
        ) : null}
        {data && !owner ? <LockNote text="Open, share and print any invoice. Money totals and the sales summary are for owners." style={{ marginBottom: 10 }} /> : null}
        {without?.totals.count ? (
          <Card style={{ marginBottom: 10 }}>
            <Row icon="receipt" title={`${plural(without.totals.count, 'sale')} without an invoice`} subtitle={`${rupees(without.totals.amount)} · not in the totals above. Make an invoice for a customer who asks.`}
              onPress={() => router.push(`/more/invoices/without?from=${range.from}&to=${range.to}&channel=${filter.channel}`)} last />
          </Card>
        ) : null}

        {data && !list.length ? (
          <View style={{ minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, padding: 16 }}>
            <Icon name={searching ? 'search' : 'receipt'} size={36} color={c.muted} />
            <T variant="bodyStrong" color="text2" style={{ textAlign: 'center' }}>{searching ? `No invoice matches "${query.trim()}"` : 'No invoices in this period'}</T>
            <T variant="small" color="muted" style={{ textAlign: 'center' }}>{searching ? 'Try the invoice number (like 17), the mobile, the customer\'s name or a saree\'s tag.' : 'Invoices made at the counter, for WhatsApp orders and online show here.'}</T>
          </View>
        ) : null}
        {list.length ? (
          <Card>
            {list.map((inv, i) => <InvoiceRow key={inv.id} inv={inv} last={i === list.length - 1} onPress={() => router.push(`/more/invoices/${inv.id}`)} />)}
          </Card>
        ) : null}
        {data?.nextOffset ? <Button title="Show more" kind="secondary" loading={more} onPress={showMore} style={{ marginTop: 12 }} /> : null}
        {list.length && !data.nextOffset ? <T variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 12 }}>That&apos;s all {plural(list.length, 'invoice')}.</T> : null}
        {!data && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      </ScrollView>
      {calendar ? <CalendarModal visible initial={custom} onClose={() => setCalendar(false)} onUse={(r) => { setCustom(r); setPeriod('custom'); setCalendar(false); }} /> : null}
    </View>
  );
}
