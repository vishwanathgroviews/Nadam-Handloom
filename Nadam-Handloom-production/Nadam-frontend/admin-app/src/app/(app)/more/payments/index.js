// Online payments (owners): every payment from the website, newest first. Search (order
// number, name, mobile, Razorpay id) looks at every date; chips for the state (with counts),
// the days and the method; the totals of what is shown. Pull down for the latest; it also
// refreshes on opening and when the app comes back.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { SearchBox } from '../../../../components/SearchBox';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { T } from '../../../../components/T';
import { FilterChips } from '../../../../components/catalog/FilterChips';
import { CalendarModal } from '../../../../components/invoices/CalendarModal';
import { PaymentRow } from '../../../../components/payments/PaymentRow';
import { NotifyCard } from '../../../../components/payments/NotifyCard';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { usePaged, nearEnd } from '../../../../hooks/usePaged';
import { useOnResume } from '../../../../gate/store';
import * as payments from '../../../../api/payments';
import { rupees } from '../../../../utils/catalog';
import { rangeLabel } from '../../../../utils/invoices';
import { METHOD_CHIPS, PERIOD_CHIPS, STATUS_CHIPS } from '../../../../utils/payments';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function OnlinePayments() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [custom, setCustom] = useState(null);
  const [method, setMethod] = useState('all');
  const [calendar, setCalendar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // The search waits until typing pauses.
  useEffect(() => { const t = setTimeout(() => setQuery(q), 350); return () => clearTimeout(t); }, [q]);
  const page = useCallback((offset) => payments.listPayments({ status, period, custom, method, q: query, offset }), [status, period, custom, method, query]);
  const list = usePaged(page, 'payments');
  const { load } = list;
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnResume(load);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const data = list.data;
  const searching = !!query.trim();
  const periods = PERIOD_CHIPS.map(([k, l]) => [k, k === 'custom' && period === 'custom' && custom ? rangeLabel(custom) : l]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Online payments" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onScroll={(e) => { if (nearEnd(e)) list.loadMore(); }} scrollEventThrottle={200}>
        <NotifyCard />
        <SearchBox value={q} onChange={setQ} placeholder="Order no., name, mobile, pay_ id" label="Search online payments" />
        <FilterChips items={STATUS_CHIPS} value={status} counts={data?.counts} onChange={setStatus} />
        {searching ? <T variant="caption" color="muted" style={{ marginBottom: 10 }}>Searching every date.</T> : (
          <FilterChips items={periods} value={period} onChange={(k) => (k === 'custom' ? setCalendar(true) : setPeriod(k))} />
        )}
        <FilterChips items={METHOD_CHIPS} value={method} onChange={setMethod} />

        {list.error ? <Banner tone="error" title="Couldn't load the payments" text={list.error.message} style={{ marginBottom: 12 }} /> : null}
        {data ? (
          <View accessibilityLabel={`Paid ${rupees(data.totals.paid)} in ${plural(data.totals.paidCount, 'order')}; refunded ${rupees(data.totals.refunded)}`}
            style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <T variant="small" color="muted">Paid · {plural(data.totals.paidCount, 'order')}</T>
              <T variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{rupees(data.totals.paid)}</T>
            </View>
            <View style={{ flex: 1, padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <T variant="small" color="muted">Refunded · {data.totals.refundedCount}</T>
              <T variant="heading" color={data.totals.refunded ? 'text' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>{rupees(data.totals.refunded)}</T>
            </View>
          </View>
        ) : null}
        {data?.counts?.refund_stuck && status !== 'refund_stuck' ? (
          <Banner tone="error" title={`${plural(data.counts.refund_stuck, 'refund')} stuck`} text="Razorpay refused these refunds. Refund them by hand in the Razorpay dashboard." style={{ marginBottom: 12 }} />
        ) : null}

        {data && !list.items.length ? (
          <View style={{ minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, padding: 16 }}>
            <Icon name={searching ? 'search' : 'card'} size={36} color={c.muted} />
            <T variant="bodyStrong" color="text2" style={{ textAlign: 'center' }}>{searching ? `No payment matches "${query.trim()}"` : 'No online payments here'}</T>
            <T variant="small" color="muted" style={{ textAlign: 'center' }}>{searching ? 'Try the order number (like NH12345678), the mobile, the customer\'s name or the Razorpay payment id.' : 'Payments made on the website show here as they happen.'}</T>
          </View>
        ) : null}
        {list.items.length ? (
          <Card>
            {list.items.map((p, i) => <PaymentRow key={p.id} p={p} last={i === list.items.length - 1} onPress={() => router.push(`/more/payments/${p.number}`)} />)}
          </Card>
        ) : null}
        {list.moreError ? <Banner tone="error" title="Couldn't load more" text={list.moreError.message} style={{ marginTop: 12 }} /> : null}
        {list.hasMore ? <Button title="Show more" kind="secondary" loading={list.more} onPress={list.loadMore} style={{ marginTop: 12 }} /> : null}
        {list.items.length && !list.hasMore ? <T variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 12 }}>That&apos;s all {plural(list.total ?? list.items.length, 'payment')}.</T> : null}
        {!data && !list.error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      </ScrollView>
      {calendar ? <CalendarModal visible initial={custom} onClose={() => setCalendar(false)} onUse={(r) => { setCustom(r); setPeriod('custom'); setCalendar(false); }} /> : null}
    </View>
  );
}
