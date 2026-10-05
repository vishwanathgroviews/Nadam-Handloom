import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import {
  listProducts,
  unhideProduct,
  markProductSoldOut,
  deleteProduct,
  AdminProductSummary,
} from '../api/catalog';
import { scanSell } from '../api/inventory';
import { usePagedList, useRefreshOnReturn } from '../hooks/usePagedList';
import { useDialog } from '../components/DialogProvider';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { Badge } from '../components/ui/Chip';
import { goToTab } from '../navigation/tabs';
import { colors, radius, spacing, typography, shadow } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'HiddenProducts'>;

export default function HiddenProductsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const showDialog = useDialog();
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!accessToken) return { items: [], total: 0 };
      const res = await listProducts(accessToken, {
        visibility: 'hidden',
        q: appliedQuery || undefined,
        page,
        pageSize,
      });
      return { items: res.data.items, total: res.data.total };
    },
    [accessToken, appliedQuery]
  );

  const {
    items: products,
    total,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePagedList<AdminProductSummary>(fetchPage, { maxPageSize: 100, enabled: Boolean(accessToken) });

  useRefreshOnReturn(refresh);

  const handleUnhide = useCallback(
    (product: AdminProductSummary) => {
      if (!accessToken) return;
      showDialog({
        title: `Unhide "${product.name}"?`,
        message: 'This product will be restored to public listings and storefront.',
        tone: 'info',
        actions: [
          {
            label: 'Unhide',
            onPress: async () => {
              setActionLoadingId(product.id);
              try {
                await unhideProduct(accessToken, product.id);
                showDialog({
                  title: 'Product Unhidden',
                  message: `"${product.name}" is now visible to customers.`,
                  tone: 'success',
                });
                refresh({ pull: true });
              } catch (err: any) {
                showDialog({
                  title: 'Failed to unhide',
                  message: err.message || 'Could not unhide product.',
                  tone: 'danger',
                });
              } finally {
                setActionLoadingId(null);
              }
            },
          },
          { label: 'Cancel', variant: 'secondary' },
        ],
      });
    },
    [accessToken, showDialog, refresh]
  );

  const handleMarkSoldOut = useCallback(
    (product: AdminProductSummary) => {
      if (!accessToken) return;
      showDialog({
        title: `Mark "${product.name}" as Sold Out?`,
        message: 'This will update available stock count to 0. You can still view sales records and analytics.',
        tone: 'warning',
        actions: [
          {
            label: 'Mark Sold Out',
            variant: 'destructive',
            onPress: async () => {
              setActionLoadingId(product.id);
              try {
                await markProductSoldOut(accessToken, product.id);
                showDialog({
                  title: 'Marked Sold Out',
                  message: `"${product.name}" is now marked as sold out.`,
                  tone: 'success',
                });
                refresh({ pull: true });
              } catch (err: any) {
                showDialog({
                  title: 'Failed to update',
                  message: err.message || 'Could not mark product sold out.',
                  tone: 'danger',
                });
              } finally {
                setActionLoadingId(null);
              }
            },
          },
          { label: 'Cancel', variant: 'secondary' },
        ],
      });
    },
    [accessToken, showDialog, refresh]
  );

  const handleDelete = useCallback(
    (product: AdminProductSummary) => {
      if (!accessToken) return;
      showDialog({
        title: `Delete "${product.name}"?`,
        message:
          'It will be removed permanently or archived if it has past sales history. You cannot undo this.',
        tone: 'danger',
        actions: [
          {
            label: 'Delete',
            variant: 'destructive',
            onPress: async () => {
              setActionLoadingId(product.id);
              try {
                await deleteProduct(accessToken, product.id);
                showDialog({
                  title: 'Product Deleted',
                  message: `"${product.name}" was removed.`,
                  tone: 'success',
                });
                refresh({ pull: true });
              } catch (err: any) {
                showDialog({
                  title: 'Failed to delete',
                  message: err.message || 'Could not delete product.',
                  tone: 'danger',
                });
              } finally {
                setActionLoadingId(null);
              }
            },
          },
          { label: 'Cancel', variant: 'secondary' },
        ],
      });
    },
    [accessToken, showDialog, refresh]
  );

  const handleSellDirect = useCallback(
    (product: AdminProductSummary) => {
      if (!accessToken) return;
      if (product.availableCount <= 0) {
        showDialog({
          title: 'Out of Stock',
          message: `"${product.name}" has no stock remaining to sell.`,
          tone: 'warning',
        });
        return;
      }

      const effectivePrice = product.isOfferActive && product.offerPrice
        ? Number(product.offerPrice)
        : Number(product.regularPrice || product.subcategory.storePrice);

      showDialog({
        title: `Sell "${product.name}"?`,
        message: `Price: ₹${effectivePrice.toLocaleString('en-IN')}${
          product.isOfferActive ? ' (Offer Price Applied)' : ''
        }\nWould you like to complete a direct store sale now or open in POS scanner?`,
        tone: 'info',
        actions: [
          {
            label: 'Direct Counter Sale',
            onPress: async () => {
              setActionLoadingId(product.id);
              try {
                const codeToSell = product.sku;
                const res = await scanSell(
                  accessToken,
                  [{ code: codeToSell, quantity: 1, salePrice: effectivePrice }],
                  { channel: 'store', invoiceRequired: false }
                );
                showDialog({
                  title: 'Sale Completed',
                  message: `Order #${res.data.orderNumber} recorded for ₹${res.data.total.toLocaleString(
                    'en-IN'
                  )}. Stock updated.`,
                  tone: 'success',
                });
                refresh({ pull: true });
              } catch (err: any) {
                showDialog({
                  title: 'Sale Failed',
                  message: err.message || 'Could not complete sale. Try using POS Scanner.',
                  tone: 'danger',
                });
              } finally {
                setActionLoadingId(null);
              }
            },
          },
          {
            label: 'Open in POS Scanner',
            onPress: () => {
              goToTab(navigation, 'ScannerTab');
            },
          },
          { label: 'Cancel', variant: 'secondary' },
        ],
      });
    },
    [accessToken, showDialog, refresh, navigation]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Hidden Products"
        subtitle={`${total} hidden listing${total === 1 ? '' : 's'}`}
        showBack
      />

      <Card style={styles.searchCard}>
        <Ionicons name="search" size={17} color={colors.textLabel} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search hidden products"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (!text.trim()) setAppliedQuery('');
          }}
          onSubmitEditing={() => setAppliedQuery(query.trim())}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => { setQuery(''); setAppliedQuery(''); }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </Card>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.infoBannerText}>
          These products are hidden from the public website. Staff can sell them directly, edit pricing, or unhide them anytime.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && products.length === 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refresh({ pull: true })}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="eye-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {appliedQuery ? `No hidden products match "${appliedQuery}"` : 'No hidden products'}
              </Text>
              <Text style={styles.emptySub}>
                To hide a product from customers, toggle "Hide from Catalog" in its product form.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isBusy = actionLoadingId === item.id;
            const stockTone =
              item.availableCount === 0 ? 'error' : item.availableCount <= 3 ? 'warning' : 'success';
            const stockLabel =
              item.availableCount === 0
                ? 'Sold Out'
                : item.trackingMode === 'serialized'
                ? `${item.availableCount} pcs`
                : `${item.availableCount} in stock`;

            const regular = Number(item.regularPrice || item.subcategory.storePrice);
            const offer = item.offerPrice ? Number(item.offerPrice) : null;
            const hasActiveOffer = Boolean(item.isOfferActive && offer && offer < regular);
            const discountPct = hasActiveOffer && offer ? Math.round(((regular - offer) / regular) * 100) : 0;

            return (
              <Card style={styles.productCard}>
                <View style={styles.cardHeader}>
                  {item.images[0]?.url ? (
                    <Image source={{ uri: item.images[0].url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="image-outline" size={24} color={colors.iconMuted} />
                    </View>
                  )}
                  <View style={styles.infoCol}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.productMeta} numberOfLines={1}>
                      {item.sku} · {item.category.name} › {item.subcategory.name}
                    </Text>

                    <View style={styles.badgeRow}>
                      <Badge label="Hidden" tone="neutral" />
                      <Badge label={stockLabel} tone={stockTone} />
                      {hasActiveOffer && <Badge label={`${discountPct}% OFF`} tone="primary" />}
                    </View>

                    <View style={styles.priceRow}>
                      {hasActiveOffer ? (
                        <>
                          <Text style={styles.offerPriceText}>₹{offer?.toLocaleString('en-IN')}</Text>
                          <Text style={styles.regularStrikethrough}>₹{regular.toLocaleString('en-IN')}</Text>
                        </>
                      ) : (
                        <Text style={styles.priceText}>₹{regular.toLocaleString('en-IN')}</Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Actions Toolbar */}
                <View style={styles.actionsDivider} />
                {isBusy ? (
                  <View style={styles.actionSpinnerRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.actionSpinnerText}>Processing...</Text>
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.sellBtn]}
                      onPress={() => handleSellDirect(item)}
                      activeOpacity={0.8}
                      disabled={item.availableCount <= 0}
                    >
                      <Ionicons name="cart-outline" size={15} color="#fff" />
                      <Text style={styles.sellBtnText}>Sell</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleUnhide(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="eye-outline" size={15} color={colors.primary} />
                      <Text style={styles.actionBtnText}>Unhide</Text>
                    </TouchableOpacity>

                    {item.availableCount > 0 && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleMarkSoldOut(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle-outline" size={15} color={colors.warning} />
                        <Text style={[styles.actionBtnText, { color: colors.warning }]}>Sold Out</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => navigation.navigate('ProductForm', { productId: item.id })}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={15} color={colors.text} />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDelete(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          }}
          ListFooterComponent={
            products.length > 0 ? (
              <View style={styles.footer}>
                {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                <Text style={styles.footerText}>
                  Showing {products.length} of {total} hidden product{total === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 1,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.bodyMedium, color: colors.text, padding: 0 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  infoBannerText: { ...typography.bodySm, color: colors.primary, flex: 1, fontSize: 12.5 },
  listContent: { paddingBottom: spacing.xxl + spacing.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.placeholderBg },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  infoCol: { flex: 1, minWidth: 0 },
  productName: { ...typography.bodySemibold, color: colors.text, fontSize: 15 },
  productMeta: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs + 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs + 3 },
  priceText: { ...typography.bodySemibold, color: colors.text, fontSize: 15 },
  offerPriceText: { ...typography.bodySemibold, color: colors.primary, fontSize: 16 },
  regularStrikethrough: {
    ...typography.bodySm,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  actionsDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm + 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs + 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
  },
  actionBtnText: { ...typography.bodySmSemibold, fontSize: 12, color: colors.text },
  sellBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  sellBtnText: { ...typography.bodySmSemibold, fontSize: 12, color: '#fff' },
  deleteBtn: {
    backgroundColor: colors.errorBg,
    paddingHorizontal: spacing.sm,
  },
  actionSpinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionSpinnerText: { ...typography.bodySm, color: colors.textMuted },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { ...typography.h3, color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  emptySub: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  footer: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.xs },
  footerText: { ...typography.bodySm, color: colors.textMuted },
  error: {
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginTop: spacing.md,
    fontSize: 13,
  },
});
