// Analytics (Module 9, owners; picks B: tabs, and A: bars). Period and channel, then
// four tabs: Sales (the headline against the period before, the chart, payment, busy
// hours and days), Designs (best sellers, bargains), People, Stock. Docs Module 9, section 5.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Avatar, Badge } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { T } from '../../../../components/T';
import { Thumb } from '../../../../components/catalog/Thumb';
import { FilterChips } from '../../../../components/catalog/FilterChips';
import { LockNote } from '../../../../components/sales/SaleParts';
import { CalendarModal } from '../../../../components/invoices/CalendarModal';
import { BarChart } from '../../../../components/analytics/BarChart';
import { DesignRow, Kpis, Meter, Panel } from '../../../../components/analytics/Parts';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { useBack } from '../../../../hooks/useBack';
import { useCan, PERMISSION } from '../../../../auth/permissions';
import { analyticsView, useAnalyticsView, queryOf } from '../../../../analytics/view';
import * as analytics from '../../../../api/analytics';
import { rupees } from '../../../../utils/catalog';
import { plural } from '../../../../utils/sales';
import { CHANNELS, PAYMENT, PERIODS, ROLE, TABS, changeText, lakh, maxOf } from '../../../../utils/analytics';

// The tab's cards: one column on phones, two on tablets.
function Cards({ items }) {
  const tablet = useIsTablet();
  const list = items.filter(Boolean);
  if (!tablet) return <View style={{ gap: 12 }}>{list}</View>;
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 12 }}>{list.filter((_, i) => i % 2 === 0)}</View>
      <View style={{ flex: 1, gap: 12 }}>{list.filter((_, i) => i % 2 === 1)}</View>
    </View>
  );
}
function Seg({ items, value, onChange }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 999, backgroundColor: c.surface2 }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            style={{ flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: on ? c.surface : 'transparent', elevation: on ? 1 : 0 }}>
            <T variant="smallStrong" color={on ? 'text' : 'text2'}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
function SalesTab({ d }) {
  const { c } = useTheme();
  const [tip, setTip] = useState(null);
  const p = d.previous;
  const ch = (cur, prev) => changeText(cur, prev, p.label, p.beforeHistory);
  const bars = d.chart.bars;
  const title = { hour: 'Sales by hour', day: 'Sales by day', week: 'Sales by week' }[d.chart.unit];
  const payMax = maxOf(d.payments);
  return (
    <Cards items={[
      <Panel key="sales" title="Sales">
        <Kpis items={[
          { label: 'Sales', value: rupees(d.totals.amount), change: ch(d.totals.amount, p.amount) },
          { label: 'Bills', value: String(d.totals.bills), change: ch(d.totals.bills, p.bills) },
          { label: 'Sarees', value: String(d.totals.sarees), change: ch(d.totals.sarees, p.sarees) },
          { label: 'Average bill', value: rupees(d.totals.avg), change: ch(d.totals.avg, p.avg) },
        ]} />
        {d.cancelled.bills ? <T variant="caption" color="muted">{plural(d.cancelled.bills, 'sale')} cancelled ({rupees(d.cancelled.amount)}), not counted</T> : null}
      </Panel>,
      <Panel key="chart" title={title}>
        <BarChart bars={bars} selected={tip} onSelect={setTip} />
        <T variant="caption" color="text2">{tip != null && bars[tip] ? `${bars[tip].title}: ${rupees(bars[tip].amount)} · ${plural(bars[tip].bills, 'bill')}` : 'Tap a bar for its figures.'}</T>
      </Panel>,
      <Panel key="pay" title="Payment">
        {d.payments.length ? d.payments.map((x) => {
          const [label, icon] = PAYMENT[x.method] || [x.method, 'info'];
          return (
            <View key={x.method} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 110, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={icon} size={16} color={c.text2} /><T variant="small" color="text2" numberOfLines={1}>{label}</T></View>
              <View style={{ flex: 1 }}><Meter value={x.amount} max={payMax} /></View>
              <View style={{ alignItems: 'flex-end', minWidth: 76 }}><T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(x.amount)}</T><T variant="caption" color="muted">{plural(x.bills, 'bill')}</T></View>
            </View>
          );
        }) : <T variant="small" color="muted">No sales in this period.</T>}
      </Panel>,
      <Panel key="hours" title="Busiest hours">
        <BarChart bars={d.hours.list.map((h) => ({ key: String(h.hour), label: [10, 13, 16, 19, 22].includes(h.hour) ? h.label.replace(' ', '') : '', title: h.label, amount: h.amount }))} height={70} muted />
        {d.hours.busiest ? <T variant="small" color="text2">Busiest around {d.hours.busiest}</T> : null}
        {d.weekdays ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <T variant="label" color="muted">Days of the week</T>
            {d.weekdays.map((w) => (
              <View key={w.dow} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T variant="small" color="text2" style={{ width: 36 }}>{w.label}</T>
                <View style={{ flex: 1 }}><Meter value={w.amount} max={maxOf(d.weekdays)} /></View>
                <T variant="smallStrong" style={{ minWidth: 76, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{rupees(w.amount)}</T>
              </View>
            ))}
          </View>
        ) : <T variant="caption" color="muted">Days of the week appear once a period covers 4 weeks of sales.</T>}
      </Panel>,
    ]} />
  );
}

function DesignsTab({ d, sort }) {
  const { c } = useTheme();
  const list = [...d.designs].sort((a, b) => (sort === 'amount' ? b.amount - a.amount : b.sarees - a.sarees || b.amount - a.amount));
  const top = list.slice(0, 10);
  const max = maxOf(top, sort === 'amount' ? 'amount' : 'sarees');
  const b = d.bargains;
  return (
    <Cards items={[
      <Panel key="best" title="Best-selling designs">
        <Seg items={[['sarees', 'By sarees'], ['amount', 'By ₹']]} value={sort} onChange={(v) => analyticsView.set({ sort: v })} />
        {top.length ? top.map((x, i) => <DesignRow key={x.id || x.name} d={x} rank={i + 1} max={max} by={sort} last={i === top.length - 1} />) : <T variant="small" color="muted">No designs sold in this period.</T>}
        {list.length > 10 ? <Button title={`See all ${list.length} designs`} kind="secondary" small onPress={() => router.push('/more/analytics/designs')} /> : null}
      </Panel>,
      <Panel key="bargains" title="Bargains" note="counter and WhatsApp">
        {d.channel === 'online' ? <T variant="small" color="muted">Online orders use website prices: no bargains.</T> : !b ? <T variant="small" color="muted">No counter or WhatsApp sales in this period.</T> : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <T variant="display" style={{ color: c.accent }}>{b.paidPct}%</T>
              <T variant="small" color="text2">of store prices paid on average</T>
            </View>
            <T variant="small" color="text2">{lakh(b.below)} below store prices · {b.bargained} of {plural(b.sarees, 'saree')} bargained</T>
            {b.most.length ? (
              <View style={{ gap: 2 }}>
                <T variant="label" color="muted" style={{ marginTop: 6 }}>Bargained most</T>
                {b.most.map((x, i) => (
                  <View key={x.id || x.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i === b.most.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                    <Thumb uri={x.imageUrl} width={32} height={42} />
                    <View style={{ flex: 1 }}><T variant="smallStrong" numberOfLines={2}>{x.name}</T><T variant="caption" color="muted">{plural(x.sarees, 'saree')}</T></View>
                    <T variant="bodyStrong">{x.paidPct}%</T>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </Panel>,
    ]} />
  );
}

function PeopleTab({ d }) {
  const { c } = useTheme();
  if (d.channel === 'online') return <Panel title="By person"><T variant="small" color="muted">Online orders are placed by customers on the website.</T></Panel>;
  const ppl = d.people;
  if (!ppl || (!ppl.list.length && !ppl.notRecorded)) return <Panel title="By person"><T variant="small" color="muted">No counter or WhatsApp sales in this period.</T></Panel>;
  return (
    <Panel title="By person">
      {ppl.list.map((p, i) => (
        <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/more/analytics/person/${p.id}`)} android_ripple={{ color: c.surface2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i === ppl.list.length - 1 && !ppl.notRecorded ? 0 : 1, borderBottomColor: c.border }}>
            <Avatar name={p.name} size={38} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><T variant="smallStrong">{p.name}</T><Badge text={ROLE[p.role]} tone={p.role === 'owner' ? 'owner' : 'staff'} /></View>
              <T variant="caption" color="muted">{plural(p.bills, 'bill')} · {plural(p.sarees, 'saree')}{p.paidPct != null ? ` · ${p.paidPct}% of store price` : ''}</T>
            </View>
            <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(p.amount)}</T>
          </View>
        </Pressable>
      ))}
      {ppl.notRecorded ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <Avatar name="?" size={38} muted />
          <View style={{ flex: 1 }}><T variant="smallStrong" color="muted">Not recorded</T><T variant="caption" color="muted">Sales without a person: {plural(ppl.notRecorded.bills, 'bill')}</T></View>
          <T variant="smallStrong" color="muted">{rupees(ppl.notRecorded.amount)}</T>
        </View>
      ) : null}
    </Panel>
  );
}

function StockTab() {
  const { c } = useTheme();
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { analytics.stock().then(setS, (e) => setError(e.message)); }, []);
  if (error) return <Banner tone="error" title="Couldn't load stock" text={error} />;
  if (!s) return <T color="muted" style={{ textAlign: 'center', marginTop: 20 }}>Loading…</T>;
  const list = (rows, line, tone) => rows.map((x, i) => (
    <Pressable key={x.id} accessibilityRole="button" onPress={() => router.push(`/products/sub/${x.id}?back=${encodeURIComponent('/more/analytics')}`)} android_ripple={{ color: c.surface2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
        <Thumb uri={x.imageUrl} width={32} height={42} />
        <View style={{ flex: 1 }}><T variant="smallStrong" numberOfLines={2}>{x.name}</T><T variant="caption" color={tone || 'muted'}>{line(x)}</T></View>
        <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>{lakh(x.value)}</T>
      </View>
    </Pressable>
  ));
  return (
    <Cards items={[
      <Panel key="stock" title="Stock">
        <Kpis items={[{ label: 'Sarees in stock', value: s.inStock.toLocaleString('en-IN') }, { label: 'Value at store prices', value: lakh(s.value) }]} />
        {s.listings !== s.inStock ? <T variant="caption" color="muted">Products shows {s.listings.toLocaleString('en-IN')}: some old listings hold more than one saree.</T> : null}
      </Panel>,
      s.priceChecks.length ? (
        <Panel key="checks" title="Prices to check" note="they make the value and bargains wrong">
          <T variant="caption" color="warning">Store price above the MRP, or more than 3 times the website price. Fix them in Catalogue.</T>
          {list(s.priceChecks, (x) => `${x.inStock} in stock · store ${rupees(x.storePrice)} · web ${x.onlinePrice != null ? rupees(x.onlinePrice) : '—'}${x.mrp ? ` · MRP ${rupees(x.mrp)}` : ''}`, 'warning')}
        </Panel>
      ) : null,
      <Panel key="top" title="Holding the most value">{list(s.topValue, (x) => `${x.inStock} in stock × ${rupees(x.storePrice)}`)}</Panel>,
      <Panel key="slow" title={`Not sold for ${s.slowDays} days`}>
        {s.slowFrom ? <T variant="small" color="muted">From {s.slowFromText}: sarees were first tagged less than {s.slowDays} days ago.</T>
          : s.slow.length ? list(s.slow, (x) => `${x.inStock} in stock · ${x.lastSold ? `last sold ${x.lastSold}` : 'none sold yet'}`) : <T variant="small" color="muted">Every design in stock sold in the last {s.slowDays} days.</T>}
      </Panel>,
    ]} />
  );
}

export default function Analytics() {
  const goBack = useBack();
  const { c } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.ANALYTICS_VIEW);
  const v = useAnalyticsView();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [calendar, setCalendar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(0);
  const q = JSON.stringify(queryOf(v));

  const load = useCallback(async () => {
    const mine = ++asked.current;
    setError(null);
    try {
      const r = await analytics.summary(JSON.parse(q));
      if (mine === asked.current) setData({ q, r });
    } catch (e) {
      if (mine === asked.current) setError(e);
    }
  }, [q]);
  useFocusEffect(useCallback(() => { if (owner) load(); }, [owner, load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (!owner) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <TopBar title="Analytics" onBack={goBack} />
        <View style={{ padding: 20 }}><LockNote text="Analytics shows money totals and each person's sales, so it is for owners." /></View>
      </View>
    );
  }
  const d = data?.q === q ? data.r : null; // never show one period's figures under another's name
  const panes = d ? (v.tab === 'designs' ? <DesignsTab d={d} sort={v.sort} /> : v.tab === 'people' ? <PeopleTab d={d} /> : v.tab === 'stock' ? <StockTab /> : <SalesTab d={d} />) : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Analytics" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: tablet ? 40 : 20, paddingBottom: space.scroll, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View>
          <FilterChips items={PERIODS} value={v.period} onChange={(k) => { if (k === 'custom') setCalendar(true); else analyticsView.set({ period: k, custom: null }); }} />
          <View style={{ marginTop: -4 }}><FilterChips items={CHANNELS} value={v.channel} onChange={(k) => analyticsView.set({ channel: k })} /></View>
          {d ? <T variant="caption" color="muted"><T variant="caption" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{d.range.label}</T> · compared with {d.previous.label}</T> : null}
        </View>
        {d?.history.partial && d.history.firstDate ? <Banner tone="info" title={`Sales recorded from ${d.history.firstDate}`} text="Sarees were first tagged then, so charts and comparisons fill in over the coming weeks." /> : null}
        <Seg items={TABS} value={v.tab} onChange={(k) => analyticsView.set({ tab: k })} />
        {error && !d ? (
          <View style={{ gap: 10 }}>
            <Banner tone="error" title="Couldn't load Analytics" text={error.code === 'NETWORK' || error.code === 'TIMEOUT' ? 'No internet. Analytics needs internet.' : error.message} />
            <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
        {!d && !error ? <View style={{ gap: 12 }}><View style={{ height: 150, borderRadius: 20, backgroundColor: c.surface3 }} /><View style={{ height: 200, borderRadius: 20, backgroundColor: c.surface2 }} /></View> : null}
        {panes}
      </ScrollView>
      {calendar ? <CalendarModal visible title="Any dates" initial={v.custom} onClose={() => setCalendar(false)} onUse={(r) => { analyticsView.set({ period: 'custom', custom: r }); setCalendar(false); }} /> : null}
    </View>
  );
}
