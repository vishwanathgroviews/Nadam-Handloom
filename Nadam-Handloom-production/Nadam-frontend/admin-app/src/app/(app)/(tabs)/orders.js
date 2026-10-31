// The Orders tab (Module 7, owner's pick A: tabs at the top). To ship oldest first
// (6.2), Shipped, Delivered; search every order; Owners also see unpaid checkouts (6.7).
// Docs Module 7, section 5.1.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { StatusBanner } from '../../../components/StatusBanner';
import { SearchBox } from '../../../components/SearchBox';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Card, Row } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/T';
import { OrderRow } from '../../../components/orders/OrderRow';
import { LockNote } from '../../../components/sales/SaleParts';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { useCan, PERMISSION } from '../../../auth/permissions';
import { orderCount } from '../../../orders/count';
import * as orders from '../../../api/orders';
import { TAB_TEXT } from '../../../utils/orders';
import { useOnResume } from '../../../gate/store';
import { nearEnd } from '../../../hooks/usePaged';

const EMPTY = {
  to_ship: ['Nothing to ship', 'Paid online orders and WhatsApp orders show here.'],
  shipped: ['Nothing on its way', 'Shipped orders show here until they are marked delivered.'],
  delivered: ['Nothing delivered yet', 'Orders marked delivered show here.'],
};

export default function Orders() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.SALES_VIEW);
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.tab || 'to_ship');
  // Home's "parcels to check" opens Shipped (Module 8).
  const [paramTab, setParamTab] = useState(params.tab);
  if (params.tab !== paramTab) { setParamTab(params.tab); if (params.tab) setTab(String(params.tab)); }
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(0);
  useEffect(() => { const t = setTimeout(() => setQuery(q), 350); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    const n = ++asked.current;
    try {
      const r = await orders.listOrders({ tab, q: query });
      if (n !== asked.current) return;
      setData(r);
      setError(null);
      orderCount.set(r.counts.to_ship);
    } catch (e) {
      if (n === asked.current) setError(e.message);
    }
  }, [tab, query]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnResume(load);

  // The next 20: near the end of the list, or "Show more".
  async function showMore() {
    if (more || !data?.nextOffset) return;
    setMore(true);
    const n = asked.current;
    try {
      const r = await orders.listOrders({ tab, q: query, offset: data.nextOffset });
      if (n === asked.current) setData((d) => ({ ...d, orders: [...d.orders, ...r.orders.filter((o) => !d.orders.some((x) => x.id === o.id))], nextOffset: r.nextOffset }));
    } catch (e) { setError(e.message); } finally { setMore(false); }
  }
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const searching = !!query.trim();
  const list = data?.orders ?? [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Orders" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onScroll={(e) => { if (nearEnd(e)) showMore(); }} scrollEventThrottle={200}>
        <SearchBox value={q} onChange={setQ} placeholder="Order, name, mobile or tracking number" label="Search orders" />
        {!searching && owner ? (
          <Card style={{ marginBottom: 12 }}>
            <Row icon="clock" title="Unpaid checkouts" subtitle="Website checkouts not paid: call the customer" onPress={() => router.push('/orders/unpaid')} last />
          </Card>
        ) : null}
        {!searching && !owner ? <LockNote text="Ship, change tracking numbers and mark delivered. Cancelling is for owners." style={{ marginBottom: 12 }} /> : null}
        {searching ? <T variant="caption" color="muted" style={{ marginBottom: 10 }}>Searching every order.</T> : (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, marginBottom: 12 }}>
            {Object.keys(TAB_TEXT).map((t) => {
              const on = tab === t;
              return (
                <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${TAB_TEXT[t]}, ${data?.counts?.[t] ?? 0}`} onPress={() => setTab(t)}
                  style={{ flex: 1, minHeight: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, backgroundColor: on ? c.surface : 'transparent', elevation: on ? 1 : 0 }}>
                  <T variant="smallStrong" color={on ? 'text' : 'text2'}>{TAB_TEXT[t]}</T>
                  {data?.counts ? <T variant="caption" color={t === 'to_ship' && data.counts.to_ship ? 'danger' : 'muted'} style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{data.counts[t]}</T> : null}
                </Pressable>
              );
            })}
          </View>
        )}
        {error ? <Banner tone="error" title="Couldn't load the orders" text={error} style={{ marginBottom: 12 }} /> : null}
        {data && !list.length ? (
          <View style={{ minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, padding: 16 }}>
            <Icon name={searching ? 'search' : 'orders'} size={36} color={c.muted} />
            <T variant="bodyStrong" color="text2" style={{ textAlign: 'center' }}>{searching ? `No order matches "${query.trim()}"` : EMPTY[tab][0]}</T>
            <T variant="small" color="muted" style={{ textAlign: 'center' }}>{searching ? 'Try the order number, the customer\'s name or mobile, or the tracking number.' : EMPTY[tab][1]}</T>
          </View>
        ) : null}
        {list.length ? <Card>{list.map((o, i) => <OrderRow key={o.id} o={o} last={i === list.length - 1} onPress={() => router.push(`/orders/order/${o.id}`)} />)}</Card> : null}
        {data?.nextOffset ? <Button title="Show more" kind="secondary" loading={more} onPress={showMore} style={{ marginTop: 12 }} /> : null}
        {!data && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      </ScrollView>
    </View>
  );
}
