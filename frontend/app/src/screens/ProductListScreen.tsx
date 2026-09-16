import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Image, Alert } from 'react-native';
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
}

export default function ProductListScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [products, setProducts] = useState<AdminProductSummary[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [cap, setCap] = useState(5000);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      Alert.alert(
        'No product found',
        `No product uses the barcode "${code}" yet. Create a new product and attach it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Product', onPress: () => navigation.navigate('ProductForm', { initialBarcode: code }) },
        ]
      );
    },
    [navigation]
  );

  const load = useCallback(
    async (q?: string) => {
      if (!accessToken) return;
      setLoading(true);
      setError('');
      try {
        const res = await listProducts(accessToken, { q: q || undefined });
        setProducts(res.data.items);
        setActiveCount(res.data.activeCount);
        setCap(res.data.cap);
        setOfflineSince(null);
        // Only the unfiltered list is cached — offline browsing is for the
        // whole catalog, not for reproducing every past search.
        if (!q) saveToCache<ProductsCachePayload>(CACHE_KEY, { items: res.data.items, activeCount: res.data.activeCount, cap: res.data.cap });
      } catch (err: any) {
        const cached = !q ? await loadFromCache<ProductsCachePayload>(CACHE_KEY) : null;
        if (cached) {
          setProducts(cached.data.items);
          setActiveCount(cached.data.activeCount);
          setCap(cached.data.cap);
          setOfflineSince(cached.savedAt);
        } else {
          setError(err.message || 'Failed to load products');
        }
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  useFocusEffect(
    useCallback(() => {
      load(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
          onChangeText={setQuery}
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
                  <Text style={styles.price}>₹{item.subcategory.onlinePrice}</Text>
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
