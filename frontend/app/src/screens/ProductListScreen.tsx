import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Image, RefreshControl } from 'react-native';
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
import { SkeletonList } from '../components/ui/Skeleton';
import { usePagedList, useRefreshOnReturn } from '../hooks/usePagedList';
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

export default function ProductListScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const showDialog = useDialog();
  const [activeCount, setActiveCount] = useState(0);
  const [cap, setCap] = useState(5000);
  // What is typed vs. what is being searched for: the list only reloads when
  // a search is submitted (or the box is cleared), not on every keystroke.
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

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

  // Ten products at a time (see usePagedList). If the very first page of the
  // full list can't be fetched, the last list saved on this phone is shown
  // instead, so staff can still browse the catalog with no signal.
  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!accessToken) return { items: [], total: 0 };
      try {
        const res = await listProducts(accessToken, { q: appliedQuery || undefined, page, pageSize });
        setActiveCount(res.data.activeCount);
        setCap(res.data.cap);
        setOfflineSince(null);
        return { items: res.data.items, total: res.data.total };
      } catch (err) {
        if (page === 1 && !appliedQuery) {
          const cached = await loadFromCache<ProductsCachePayload>(CACHE_KEY);
          if (cached) {
            setActiveCount(cached.data.activeCount);
            setCap(cached.data.cap);
            setOfflineSince(cached.savedAt);
            return { items: cached.data.items, total: cached.data.items.length };
          }
        }
        throw err;
      }
    },
    [accessToken, appliedQuery]
  );

  const {
    items: products, total, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh,
  } = usePagedList<AdminProductSummary>(fetchPage, { maxPageSize: 100, enabled: Boolean(accessToken) });

  // Coming back from a product (after editing it, say) refreshes the rows
  // already on screen without jumping back to the top.
  useRefreshOnReturn(refresh);

  // Whatever of the full list has been loaded is kept for offline browsing.
  // Only the unfiltered list — a past search isn't worth keeping.
  useEffect(() => {
    if (appliedQuery || offlineSince || products.length === 0) return;
    saveToCache<ProductsCachePayload>(CACHE_KEY, { items: products, activeCount, cap, total });
  }, [products, appliedQuery, offlineSince, activeCount, cap, total]);

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
            if (!text.trim()) setAppliedQuery('');
          }}
          onSubmitEditing={() => setAppliedQuery(query.trim())}
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
        <SkeletonList count={7} variant="media" />
      ) : error && products.length === 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={offlineSince ? undefined : loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => refresh({ pull: true })} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {appliedQuery ? `No products match "${appliedQuery}".` : 'No products yet.'}
            </Text>
          }
          ListFooterComponent={
            products.length > 0 ? (
              <View>
                {loadingMore ? <SkeletonList count={2} variant="media" /> : null}
                {error && !loadingMore ? (
                  <TouchableOpacity onPress={loadMore} style={styles.footer}>
                    <Text style={styles.retryText}>Couldn't load more. Tap to try again.</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.footer}>
                    <Text style={styles.footerText}>
                      Showing {products.length} of {total} {total === 1 ? 'product' : 'products'}
                      {hasMore ? ' — scroll for more' : ''}
                    </Text>
                  </View>
                )}
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

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  footerText: { ...typography.bodySm, color: colors.textMuted },
  retryText: { ...typography.bodySmSemibold, color: colors.primary },
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
