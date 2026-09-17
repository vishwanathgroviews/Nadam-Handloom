import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { AppStackParamList, RootTabParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listProducts, AdminProductSummary } from '../api/catalog';
import { saveToCache, loadFromCache } from '../utils/offlineCache';
import OfflineBanner from '../components/OfflineBanner';
import BarcodeScanModal from '../components/BarcodeScanModal';
import { useDialog } from '../components/DialogProvider';
import type { ScanLookupResult } from '../api/inventory';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { Badge } from '../components/ui/Chip';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'ProductsTab'>,
  NativeStackScreenProps<AppStackParamList>
>;

const CACHE_KEY = 'products';

const VISIBILITY_LABEL: Record<string, string> = {
  online_only: 'Online only',
  store_only: 'Store only',
  both: 'Online + Store',
  hidden: 'Hidden',
};

interface ProductsCachePayload {
  items: AdminProductSummary[];
  activeCount: number;
  cap: number;
  total?: number;
}

// The API's maximum. Big pages mean fewer round trips while scrolling a
// catalog of a few hundred listings.
const PAGE_SIZE = 100;

export default function ProductListScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const showDialog = useDialog();
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [cap, setCap] = useState(5000);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // Every fetch is tagged; a response that arrives after a newer search or
  // refresh has started is dropped, so a slow page from the old query can't
  // land on top of the new results.
  const requestSeq = useRef(0);
  const loadingMoreRef = useRef(false);
  // Read by the focus effect below, which is only re-created when `load`
  // changes — reading `page`/`query` state there would capture their values
  // from the first render and always reload just page 1 of an empty search.
  const pageRef = useRef(1);
  const queryRef = useRef('');
  pageRef.current = page;
  queryRef.current = query;

  const handleScanFound = useCallback(
    (result: ScanLookupResult) => {
      setScannerVisible(false);
      navigation.navigate('ProductForm', { productId: result.productId });
    },
    [navigation]
  );

  // No existing product uses this barcode — offer to create one and attach
  // it right away, instead of a dead-end "not found" error.
  const handleScanNotFound = useCallback(
    (code: string) => {
      setScannerVisible(false);
      showDialog({
        title: 'No product found',
        message: `No product uses the barcode "${code}" yet. Create a new product and attach it?`,
        tone: 'warning',
        dismissOnBackdrop: false,
        actions: [
          { label: 'Create Product', onPress: () => navigation.navigate('ProductForm', { initialBarcode: code }) },
          { label: 'Cancel' },
        ],
      });
    },
    [navigation, showDialog]
  );

  /**
   * Loads the list from the top.
   *
   * The API returns products a page at a time, and this screen used to ask
   * for page 1 only — so it showed the newest 20 and silently stopped there.
   * `keepPages` refetches as many pages as were already on screen, so coming
   * back from editing a product deep in the list doesn't collapse it back to
   * the first page.
   */
  const load = useCallback(
    async (q?: string, keepPages = 1) => {
      if (!accessToken) return;
      const seq = ++requestSeq.current;
      setLoading(true);
      setError('');
      try {
        let collected: AdminProductSummary[] = [];
        let lastPage = 0;
        let latest: Awaited<ReturnType<typeof listProducts>> | null = null;
        for (let p = 1; p <= Math.max(1, keepPages); p++) {
          const res = await listProducts(accessToken, { q: q || undefined, page: p, pageSize: PAGE_SIZE });
          if (seq !== requestSeq.current) return;
          latest = res;
          collected = mergeById(collected, res.data.items);
          lastPage = p;
          if (collected.length >= res.data.total || res.data.items.length === 0) break;
        }
        if (!latest) return;
        setProducts(collected);
        setTotal(latest.data.total);
        setPage(lastPage);
        setActiveCount(latest.data.activeCount);
        setCap(latest.data.cap);
        setOfflineSince(null);
        // Only the unfiltered list is cached — offline browsing is for the
        // whole catalog, not for reproducing every past search.
        if (!q) {
          saveToCache<ProductsCachePayload>(CACHE_KEY, {
            items: collected, activeCount: latest.data.activeCount, cap: latest.data.cap, total: latest.data.total,
          });
        }
      } catch (err: any) {
        if (seq !== requestSeq.current) return;
        const cached = !q ? await loadFromCache<ProductsCachePayload>(CACHE_KEY) : null;
        if (cached) {
          setProducts(cached.data.items);
          setTotal(cached.data.total ?? cached.data.items.length);
          setActiveCount(cached.data.activeCount);
          setCap(cached.data.cap);
          setOfflineSince(cached.savedAt);
        } else {
          setError(err.message || 'Failed to load products');
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [accessToken]
  );

  // Fetches the next page when the list is scrolled near its end.
  const loadMore = useCallback(async () => {
    if (!accessToken || loading || offlineSince) return;
    if (products.length >= total) return;
    // A ref, not state: FlatList can fire onEndReached several times before
    // React re-renders, and each would otherwise request the same page.
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await listProducts(accessToken, { q: query || undefined, page: next, pageSize: PAGE_SIZE });
      if (seq !== requestSeq.current) return;
      setProducts((prev) => {
        const merged = mergeById(prev, res.data.items);
        if (!query) {
          saveToCache<ProductsCachePayload>(CACHE_KEY, {
            items: merged, activeCount: res.data.activeCount, cap: res.data.cap, total: res.data.total,
          });
        }
        return merged;
      });
      setTotal(res.data.total);
      setPage(next);
    } catch (err: any) {
      if (seq === requestSeq.current) setError(err.message || 'Failed to load more products');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [accessToken, loading, offlineSince, products.length, total, page, query]);

  useFocusEffect(
    useCallback(() => {
      load(queryRef.current, pageRef.current);
    }, [load])
  );

  const progressPct = Math.min(100, cap > 0 ? (activeCount / cap) * 100 : 0);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Products"
        subtitle={`${activeCount} live listings`}
        showBack={false}
        rightAction={
          <TouchableOpacity style={styles.addChip} onPress={() => navigation.navigate('ProductForm', {})} activeOpacity={0.8}>
            <Text style={styles.addChipText}>+ New</Text>
          </TouchableOpacity>
        }
      />

      <Card style={styles.searchCard}>
        <Ionicons name="search" size={17} color={colors.textLabel} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            // Clearing the box brings the full list back without needing a
            // second tap on search.
            if (!text.trim()) load('');
          }}
          onSubmitEditing={() => load(query)}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setScannerVisible(true)}>
          <Ionicons name="barcode-outline" size={19} color={colors.primary} />
        </TouchableOpacity>
      </Card>

      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {activeCount} of {cap} listings live
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {offlineSince && <OfflineBanner cachedAt={offlineSince} />}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{query ? `No products match "${query}".` : 'No products yet.'}</Text>
          }
          ListFooterComponent={
            products.length > 0 ? (
              <View style={styles.footer}>
                {loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
                <Text style={styles.footerText}>
                  Showing {products.length} of {total} {total === 1 ? 'product' : 'products'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const stockTone: 'error' | 'warning' | 'success' =
              item.availableCount === 0 ? 'error' : item.availableCount <= 3 ? 'warning' : 'success';
            const stockLabel =
              item.availableCount === 0
                ? 'Out of stock'
                : item.trackingMode === 'serialized'
                ? `${item.availableCount} pieces`
                : `${item.availableCount} in stock`;
            return (
              <TouchableOpacity onPress={() => navigation.navigate('ProductForm', { productId: item.id })} activeOpacity={0.85}>
                <Card style={styles.productCard}>
                  {item.images[0]?.url ? (
                    <Image source={{ uri: item.images[0].url }} style={styles.thumb} />
                  ) : (
                    <View style={styles.thumb} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {item.sku} · {item.category.name} › {item.subcategory.name}
                    </Text>
                    <View style={styles.badgeRow}>
                      <Badge label={stockLabel} tone={stockTone} />
                      {item.channelVisibility !== 'both' && (
                        <Badge label={VISIBILITY_LABEL[item.channelVisibility]} tone="neutral" />
                      )}
                      {!item.isActive && <Badge label="Inactive" tone="neutral" />}
                    </View>
                  </View>
                  {/* Store price, never the online one: this app sells at the
                      counter, and showing the website's figure here invited
                      staff to charge it by mistake. */}
                  <Text style={styles.price}>₹{item.subcategory.storePrice}</Text>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <BarcodeScanModal
        visible={scannerVisible}
        accessToken={accessToken}
        onClose={() => setScannerVisible(false)}
        onFound={handleScanFound}
        onNotFound={handleScanNotFound}
      />
    </View>
  );
}

/** Appends a page, dropping any product already on screen. */
const mergeById = (existing: AdminProductSummary[], incoming: AdminProductSummary[]) => {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
};

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  footerText: { ...typography.bodySm, color: colors.textMuted },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  addChip: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  addChipText: { ...typography.bodySmSemibold, color: colors.primary },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 1,
  },
  searchInput: { flex: 1, ...typography.bodyMedium, color: colors.text, padding: 0 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  statsText: { ...typography.bodySm, color: colors.textMuted },
  progressTrack: {
    width: 88,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.segmentTrack,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.sm + 2,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.placeholderBg },
  cardTitle: { ...typography.bodySemibold, color: colors.text },
  cardMeta: { ...typography.bodySm, color: colors.textLabel, marginTop: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs + 3 },
  price: { ...typography.price, color: colors.text },
  error: {
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginTop: spacing.md,
    fontSize: 13,
  },
});
