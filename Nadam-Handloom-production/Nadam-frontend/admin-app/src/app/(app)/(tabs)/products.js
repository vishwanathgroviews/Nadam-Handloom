// Products tab (owners and staff): sarees in stock against the 5,000 limit, search
// by name, SKU or tag number, scan a tag to find its saree, filters, and a rows /
// photo-grid switch. Docs Module 4, sections 6B and 7.1.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { StatusBanner } from '../../../components/StatusBanner';
import { T } from '../../../components/T';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { Progress } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { SearchBox } from '../../../components/SearchBox';
import { FilterChips } from '../../../components/catalog/FilterChips';
import { OfflineCopy } from '../../../components/catalog/OfflineCopy';
import { ProductCell, ProductRow } from '../../../components/products/ProductItem';
import { ListHead, useListView } from '../../../components/products/ViewSwitch';
import { QueueBar } from '../../../components/products/QueueBar';
import { useTheme, useIsTablet } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { useOnline } from '../../../hooks/useOnline';
import { useBatch } from '../../../products/batch';
import * as products from '../../../api/products';
import { PRODUCT_FILTERS, plural } from '../../../utils/products';
import { useOnResume } from '../../../gate/store';

const MAX_W = 760;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

export default function Products() {
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { width } = useWindowDimensions();
  const [view, setView] = useListView();
  const batch = useBatch();
  const online = useOnline();
  const [q, setQ] = useState('');
  const params = useLocalSearchParams();
  const [filter, setFilter] = useState(params.filter || 'all');
  // Home's "sarees without a photo" opens the list on that filter (Module 8).
  const [paramFilter, setParamFilter] = useState(params.filter);
  if (params.filter !== paramFilter) { setParamFilter(params.filter); if (params.filter) setFilter(String(params.filter)); }
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const asked = useRef(0);

  const load = useCallback(async () => {
    const mine = ++asked.current;
    setError(null);
    try {
      const r = await products.listProducts({ q, filter });
      if (mine !== asked.current) return;
      setData(r);
      setItems(r.products);
    } catch (e) {
      if (mine === asked.current) setError(e);
    }
  }, [q, filter]);
  // Search waits for a short pause in typing.
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnResume(load);
  // Back online after showing the phone's copy, or after a failed load: fetch the live list.
  const stale = !!data?.savedAt || error?.code === 'NETWORK' || error?.code === 'TIMEOUT';
  useEffect(() => { if (online && stale) { const t = setTimeout(load, 0); return () => clearTimeout(t); } return undefined; }, [online, stale, load]);

  // The next 20 (a search comes in pages too).
  async function loadMore() {
    if (more || !data?.nextOffset) return;
    setMore(true);
    const mine = asked.current;
    try {
      const r = await products.listProducts({ q, filter, offset: data.nextOffset });
      if (mine !== asked.current) return;
      setData((d) => ({ ...d, nextOffset: r.nextOffset }));
      setItems((list) => [...list, ...r.products.filter((p) => !list.some((x) => x.id === p.id))]);
    } catch { /* the next scroll tries again */ } finally { setMore(false); }
  }

  const contentW = Math.min(width - (tablet ? 96 : 0), MAX_W) - 40;
  const cols = view === 'grid' ? (contentW > 600 ? 4 : 2) : 1;
  const cellW = (contentW - (cols - 1) * 10) / cols;
  const t = data?.totals;
  const near = t && t.inStock >= t.limit * 0.98;
  const open = (p) => router.push(`/products/${p.id}`);

  const header = (
    <View>
      <QueueBar />
      {batch ? (
        <View style={{ padding: 14, borderRadius: radius.md, backgroundColor: c.infoSoft, marginBottom: 12, gap: 8 }}>
          <T variant="smallStrong" color="info">Draft on this phone: {batch.items.filter((i) => i.tag).length} of {plural(batch.items.length, 'photo')} tagged</T>
          <T variant="small">{batch.sub.name}. Nothing is lost if the app closes.</T>
          <Button title="Continue" small onPress={() => router.push('/products/add/scan')} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      <OfflineCopy savedAt={data?.savedAt} />
      {t ? (
        <View style={{ padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: near ? c.warning : c.border, gap: 8, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <T variant="heading">{n(t.inStock)}</T>
            <T variant="small" color="text2">sarees in stock · {n(t.listings)} listings</T>
          </View>
          <Progress fraction={t.inStock / t.limit} tone={near ? 'warning' : 'primary'} />
          <T variant="caption" color="muted">{n(t.inStock)} of the {n(t.limit)} limit. Sold-out listings don&apos;t count.</T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><SearchBox value={q} onChange={setQ} placeholder="Name, SKU or tag number" /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan a tag to find its saree" onPress={() => router.push('/products/find')}
          style={{ width: 52, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="scan" color={c.text} />
        </Pressable>
      </View>
      {q ? null : <FilterChips items={PRODUCT_FILTERS} value={filter} counts={data?.counts} onChange={setFilter} />}
      {error ? (
        <View style={{ gap: 10, marginBottom: 12 }}>
          <Banner tone={error.code === 'NETWORK' || error.code === 'TIMEOUT' ? 'warning' : 'error'} title="Couldn't load the sarees" text={error.message} />
          <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {data && !error ? <ListHead label={q ? `${plural(items.length, 'saree')} match "${q.trim()}"` : plural(filter === 'all' ? data.counts.all : data.counts[filter] ?? items.length, 'saree')} view={view} onView={setView} /> : null}
    </View>
  );

  const empty = !data ? (
    error ? null : <View style={{ gap: 8 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={{ height: 76, borderRadius: radius.md, backgroundColor: c.surface3, opacity: 0.6 }} />)}</View>
  ) : (
    <View style={{ alignItems: 'center', gap: 8, padding: 28, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong }}>
      <Icon name={q ? 'search' : 'box'} size={34} color={c.muted} />
      <T variant="bodyStrong" color="text2">{q ? 'No saree has that' : filter === 'all' ? 'No sarees yet' : 'Nothing here'}</T>
      <T variant="small" color="muted" style={{ textAlign: 'center' }}>{q ? 'Try the number on the tag (like 2264), a SKU, or a name.' : filter === 'all' ? 'Add the first ones: choose a subcategory, pick the photos, scan the tags.' : 'No sarees in this filter.'}</T>
      {q ? <Button title="Scan the tag instead" icon="scan" kind="secondary" small onPress={() => router.push('/products/find')} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
        <StatusBanner />
        <TopBar title="Products" right={<Button title="Add" icon="plus" small onPress={() => router.push('/products/add/pick')} style={{ marginRight: 8 }} />} />
      </View>
      <FlatList
        key={`${view}-${cols}`}
        data={items}
        numColumns={cols}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={more ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.primary} /> : null}
        columnWrapperStyle={cols > 1 ? { gap: 10, marginBottom: 10 } : undefined}
        renderItem={({ item, index }) => (cols > 1
          ? <ProductCell p={item} width={cellW} onPress={() => open(item)} />
          : (
            <View style={{ backgroundColor: c.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border, borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: index === items.length - 1 ? 1 : 0, borderTopLeftRadius: index === 0 ? radius.lg : 0, borderTopRightRadius: index === 0 ? radius.lg : 0, borderBottomLeftRadius: index === items.length - 1 ? radius.lg : 0, borderBottomRightRadius: index === items.length - 1 ? radius.lg : 0, overflow: 'hidden' }}>
              <ProductRow p={item} onPress={() => open(item)} last={index === items.length - 1} />
            </View>
          ))}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      />
    </View>
  );
}
