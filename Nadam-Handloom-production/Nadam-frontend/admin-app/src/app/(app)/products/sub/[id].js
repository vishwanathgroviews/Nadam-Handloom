// A subcategory's sarees (opened from the catalogue's subcategory page): its price,
// Add products (gallery + scan) and Quick add, and the list with the rows / grid switch.
// Docs Module 4, section 7.2.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../../hooks/useBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Icon } from '../../../../components/Icon';
import { ProductCell, ProductRow } from '../../../../components/products/ProductItem';
import { ListHead, useListView } from '../../../../components/products/ViewSwitch';
import { QueueBar } from '../../../../components/products/QueueBar';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import * as products from '../../../../api/products';
import * as catalog from '../../../../api/catalog';
import { plural } from '../../../../utils/products';
import { rupees } from '../../../../utils/catalog';

const MAX_W = 760;

export default function SubcategorySarees() {
  const goBack = useBack();
  const { id } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { width } = useWindowDimensions();
  const [view, setView] = useListView();
  const [sub, setSub] = useState(null);
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, r] = await Promise.all([catalog.getSubcategory(id), products.listProducts({ subcategoryId: id })]);
      setSub(s.subcategory);
      setData(r);
      setItems(r.products);
    } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function loadMore() {
    if (more || !data?.nextOffset) return;
    setMore(true);
    try {
      const r = await products.listProducts({ subcategoryId: id, offset: data.nextOffset });
      setData((d) => ({ ...d, nextOffset: r.nextOffset }));
      setItems((list) => [...list, ...r.products.filter((p) => !list.some((x) => x.id === p.id))]);
    } catch { /* tries again on the next scroll */ } finally { setMore(false); }
  }

  const contentW = Math.min(width - (tablet ? 96 : 0), MAX_W) - 40;
  const cols = view === 'grid' ? (contentW > 600 ? 4 : 2) : 1;
  const cellW = (contentW - (cols - 1) * 10) / cols;
  const open = (p) => router.push(`/products/${p.id}`);

  const header = (
    <View>
      {error ? <Banner tone="error" title="Couldn't load" text={error.message} style={{ marginBottom: 12 }} /> : null}
      {sub ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <View style={{ width: 72, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
              {sub.imageUrl ? <Image source={{ uri: sub.imageUrl }} style={{ width: '100%', height: '100%' }} /> : <Icon name="image" color={c.muted} />}
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption" color="muted" numberOfLines={1} style={{ textTransform: 'uppercase' }}>{sub.categoryName}</T>
              <T variant="bodyStrong" numberOfLines={2}>{sub.name}</T>
              <T variant="caption" color="muted">Store {rupees(sub.storePrice)} · Web {rupees(sub.websitePrice)}{sub.mrp ? ` · MRP ${rupees(sub.mrp)}` : ''}</T>
            </View>
          </View>
          <T variant="caption" color="muted" style={{ marginTop: 6, marginBottom: 12, marginLeft: 4 }}>Every saree here gets this name, price and description.</T>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <Button title="Add products" icon="image" onPress={() => router.push(`/products/add/start?id=${id}`)} style={{ flex: 1 }} />
            <Button title="Quick add" icon="camera" kind="secondary" onPress={() => router.push(`/products/add/quick?id=${id}`)} style={{ flex: 1 }} />
          </View>
        </>
      ) : null}
      <QueueBar />
      {data ? <ListHead label={`${plural(data.counts.all, 'saree')} · ${data.counts.instock} in stock`} view={view} onView={setView} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}>
        <TopBar title={sub?.name || 'Sarees'} onBack={goBack} />
      </View>
      <FlatList
        key={`${view}-${cols}`}
        data={items}
        numColumns={cols}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={data ? (
          <View style={{ alignItems: 'center', gap: 8, padding: 28, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong }}>
            <Icon name="box" size={34} color={c.muted} />
            <T variant="bodyStrong" color="text2">No sarees here yet</T>
            <T variant="small" color="muted" style={{ textAlign: 'center' }}>Add them: pick the photos, then scan each saree&apos;s tag.</T>
          </View>
        ) : null}
        ListFooterComponent={more ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.primary} /> : null}
        columnWrapperStyle={cols > 1 ? { gap: 10, marginBottom: 10 } : undefined}
        renderItem={({ item, index }) => (cols > 1 ? <ProductCell p={item} width={cellW} onPress={() => open(item)} /> : (
          <View style={{ backgroundColor: c.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border, borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: index === items.length - 1 ? 1 : 0, borderTopLeftRadius: index === 0 ? radius.lg : 0, borderTopRightRadius: index === 0 ? radius.lg : 0, borderBottomLeftRadius: index === items.length - 1 ? radius.lg : 0, borderBottomRightRadius: index === items.length - 1 ? radius.lg : 0, overflow: 'hidden' }}>
            <ProductRow p={item} onPress={() => open(item)} last={index === items.length - 1} />
          </View>
        ))}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      />
    </View>
  );
}
