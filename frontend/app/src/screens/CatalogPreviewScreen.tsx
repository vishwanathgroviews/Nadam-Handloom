import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import {
  getCatalogPreviewProducts,
  generateCatalogPdf,
  CatalogPreviewProduct,
} from '../api/catalogPdf';
import { savePdfBytes, sharePdf } from '../utils/pdf';
import { catalogFilename } from '../utils/catalogShare';
import { useIsOnline } from '../utils/network';
import { useDialog } from '../components/DialogProvider';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Chip';
import OfflineBanner from '../components/OfflineBanner';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'CatalogPreview'>;

export default function CatalogPreviewScreen({ route, navigation }: Props) {
  const { subcategoryId, subcategoryName } = route.params;
  const { accessToken } = useAuth();
  const isOnline = useIsOnline();
  const showDialog = useDialog();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<CatalogPreviewProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastRemoved, setLastRemoved] = useState<CatalogPreviewProduct | null>(null);
  const [activeTab, setActiveTab] = useState<'included' | 'excluded'>('included');

  const loadProducts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await getCatalogPreviewProducts(accessToken, subcategoryId);
      const items = res.data.products || [];
      setProducts(items);
      setSelectedIds(new Set(items.map((p) => p.id)));
      setLastRemoved(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load catalog products');
    } finally {
      setLoading(false);
    }
  }, [accessToken, subcategoryId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const includedProducts = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds]
  );

  const excludedProducts = useMemo(
    () => products.filter((p) => !selectedIds.has(p.id)),
    [products, selectedIds]
  );

  const handleRemoveProduct = useCallback(
    (product: CatalogPreviewProduct) => {
      showDialog({
        title: 'Remove from Catalog?',
        message: `Exclude "${product.name}" from this catalog PDF? The product remains active in your store.`,
        tone: 'warning',
        actions: [
          {
            label: 'Remove',
            variant: 'destructive',
            onPress: () => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(product.id);
                return next;
              });
              setLastRemoved(product);
            },
          },
          { label: 'Cancel', variant: 'secondary' },
        ],
      });
    },
    [showDialog]
  );

  const handleRestoreProduct = useCallback((productId: string) => {
    setSelectedIds((prev) => new Set([...prev, productId]));
    setLastRemoved((current) => (current?.id === productId ? null : current));
  }, []);

  const handleUndo = useCallback(() => {
    if (!lastRemoved) return;
    handleRestoreProduct(lastRemoved.id);
  }, [lastRemoved, handleRestoreProduct]);

  const handleRestoreAll = useCallback(() => {
    setSelectedIds(new Set(products.map((p) => p.id)));
    setLastRemoved(null);
  }, [products]);

  const handleGenerate = useCallback(async () => {
    if (!accessToken) return;
    if (!isOnline) {
      setError('You are offline — generating the catalog needs an active connection.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Please select at least one product before generating the PDF.');
      return;
    }

    // Preserve the original ordering among selected products
    const orderedSelectedIds = products
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.id);

    setGenerating(true);
    setError('');

    try {
      const result = await generateCatalogPdf(accessToken, subcategoryId, orderedSelectedIds);
      const filename = catalogFilename(subcategoryName ?? '');
      const uri = savePdfBytes(result.bytes, filename);

      showDialog({
        title: 'Catalog PDF Generated',
        message: `Successfully generated catalog with ${result.productCount ?? orderedSelectedIds.length} product(s).`,
        tone: 'success',
        actions: [
          {
            label: 'Share / View PDF',
            variant: 'primary',
            onPress: async () => {
              try {
                await sharePdf(uri);
              } catch (shareErr: any) {
                // If native sharing is dismissed or unavailable, still complete gracefully
                console.warn('PDF share cancelled or failed:', shareErr?.message);
              }
              navigation.goBack();
            },
          },
          {
            label: 'Done',
            variant: 'secondary',
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to generate catalog PDF');
    } finally {
      setGenerating(false);
    }
  }, [accessToken, isOnline, selectedIds, products, subcategoryId, subcategoryName, showDialog, navigation]);

  const displayedList = activeTab === 'included' ? includedProducts : excludedProducts;

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <ScreenHeader
          title="Catalog Preview"
          subtitle={subcategoryName || 'Customize Catalog'}
          backLabel="Catalog"
        />
      </View>

      {!isOnline && <OfflineBanner />}

      {/* Undo Notification Banner */}
      {lastRemoved && selectedIds.size > 0 && !selectedIds.has(lastRemoved.id) && (
        <View style={styles.undoBanner}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={styles.undoText} numberOfLines={1}>
            Excluded "{lastRemoved.name}"
          </Text>
          <TouchableOpacity onPress={handleUndo} style={styles.undoButton} activeOpacity={0.8}>
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Control Summary Card */}
      {!loading && products.length > 0 && (
        <Card style={styles.controlCard}>
          <View style={styles.controlRow}>
            <View>
              <Text style={styles.countHeadline}>
                Selected: {includedProducts.length} of {products.length}
              </Text>
              <Text style={styles.countSubline}>
                {excludedProducts.length > 0
                  ? `${excludedProducts.length} excluded from final PDF`
                  : 'All products included'}
              </Text>
            </View>

            {excludedProducts.length > 0 && (
              <TouchableOpacity
                onPress={handleRestoreAll}
                style={styles.restoreAllBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                <Text style={styles.restoreAllText}>Restore All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tab Filter Pills */}
          {excludedProducts.length > 0 && (
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('included')}
                style={[styles.tabPill, activeTab === 'included' && styles.tabPillActive]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    activeTab === 'included' && styles.tabPillTextActive,
                  ]}
                >
                  Included ({includedProducts.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('excluded')}
                style={[styles.tabPill, activeTab === 'excluded' && styles.tabPillActive]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    activeTab === 'excluded' && styles.tabPillTextActive,
                  ]}
                >
                  Excluded ({excludedProducts.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>
      )}

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadProducts} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Products List / Empty State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading eligible products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={54} color={colors.iconMuted} />
          <Text style={styles.emptyTitle}>No eligible products</Text>
          <Text style={styles.emptySubtitle}>
            This subcategory has no active in-stock products with photos.
          </Text>
          <Button
            title="Go Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : (
        <FlatList
          data={displayedList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyTabBox}>
              <Text style={styles.emptyTabText}>
                {activeTab === 'included'
                  ? 'No products selected. Please restore products from the Excluded tab.'
                  : 'No products are currently excluded.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isIncluded = selectedIds.has(item.id);
            return (
              <Card style={[styles.productCard, !isIncluded && styles.productCardExcluded]}>
                <View style={styles.cardRow}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.productThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productThumb, styles.placeholderThumb]}>
                      <Ionicons name="image-outline" size={24} color={colors.iconMuted} />
                    </View>
                  )}

                  <View style={styles.cardDetails}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <View style={styles.metaRow}>
                      {item.catalogId ? (
                        <Badge label={`ID: ${item.catalogId}`} tone="primary" />
                      ) : (
                        <Badge label={item.sku} tone="neutral" />
                      )}
                      <Badge
                        label={`${item.availableCount} in stock`}
                        tone={item.availableCount > 0 ? 'success' : 'neutral'}
                      />
                    </View>

                    <Text style={styles.productPrice}>₹{item.price}</Text>
                  </View>

                  {/* Action Button: Remove or Restore */}
                  <View style={styles.cardAction}>
                    {isIncluded ? (
                      <TouchableOpacity
                        onPress={() => handleRemoveProduct(item)}
                        style={styles.removeBtn}
                        accessibilityLabel={`Remove ${item.name}`}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={19} color={colors.error} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleRestoreProduct(item.id)}
                        style={styles.restoreBtn}
                        accessibilityLabel={`Restore ${item.name}`}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add-circle" size={22} color={colors.success} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Bottom Sticky Action Bar */}
      {!loading && products.length > 0 && (
        <View style={styles.footerBar}>
          {includedProducts.length === 0 ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.warningText}>
                Select at least 1 product to generate the PDF.
              </Text>
            </View>
          ) : (
            <Text style={styles.footerHint}>
              The PDF will contain {includedProducts.length} product photo(s).
            </Text>
          )}

          <Button
            title={
              generating
                ? 'Generating PDF...'
                : `Generate PDF (${includedProducts.length})`
            }
            onPress={handleGenerate}
            loading={generating}
            disabled={!isOnline || includedProducts.length === 0 || generating}
            style={styles.generateButton}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerArea: {
    paddingHorizontal: spacing.md,
  },
  controlCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countHeadline: {
    ...typography.bodySemibold,
    color: colors.text,
  },
  countSubline: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: 2,
  },
  restoreAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  restoreAllText: {
    ...typography.bodySmSemibold,
    color: colors.primary,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  tabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.placeholderBg,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
  },
  tabPillText: {
    ...typography.bodySmSemibold,
    color: colors.textMuted,
  },
  tabPillTextActive: {
    color: colors.surface,
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  undoText: {
    ...typography.bodySm,
    color: colors.primary,
    flex: 1,
  },
  undoButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  undoButtonText: {
    ...typography.bodySmSemibold,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 110,
  },
  productCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm + 2,
  },
  productCardExcluded: {
    opacity: 0.6,
    backgroundColor: colors.placeholderBg,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productThumb: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.placeholderBg,
  },
  placeholderThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  productName: {
    ...typography.bodySemibold,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  productPrice: {
    ...typography.bodySemibold,
    color: colors.primary,
    marginTop: 4,
    fontSize: 14,
  },
  cardAction: {
    paddingLeft: spacing.xs,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyTabBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTabText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    ...shadow.floating,
  },
  footerHint: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningBg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  warningText: {
    ...typography.bodySm,
    color: colors.warning,
  },
  generateButton: {
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorBg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  retryBtnText: {
    ...typography.bodySmSemibold,
    color: colors.error,
  },
});
