import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listAdminOrders, AdminOrderSummary } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { Badge, FilterChip } from '../components/ui/Chip';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePagedList, useRefreshOnReturn } from '../hooks/usePagedList';

type Props = NativeStackScreenProps<AppStackParamList, 'AllOrders'>;

// Every real order, whatever the channel. Online checkouts that were never
// paid (pending_payment / payment_failed) are left out: the customer walked
// away before paying, so there was no sale to show.
const REAL_ORDER_STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'cancelled'];

const DATE_FILTERS: { key: 'all' | 'today' | '7d' | '30d'; label: string; days?: number }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
];

const startOfDaysAgo = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const CHANNEL: Record<string, { label: string; tone: 'primary' | 'success' | 'warning'; icon: keyof typeof Ionicons.glyphMap }> = {
  online: { label: 'Online', tone: 'primary', icon: 'globe-outline' },
  store: { label: 'Offline Store', tone: 'success', icon: 'storefront-outline' },
  whatsapp: { label: 'WhatsApp', tone: 'warning', icon: 'logo-whatsapp' },
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  processing: 'To ship',
  shipped: 'Shipped',
  delivered: 'Completed',
  cancelled: 'Cancelled',
};

const formatRupees = (amount: string | number) => `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const itemsSummary = (order: AdminOrderSummary) => {
  const first = order.items[0]?.nameSnapshot ?? 'Order';
  const rest = order.items.length - 1;
  return rest > 0 ? `${first} + ${rest} more` : first;
};

/**
 * All orders in one list — online, offline store and WhatsApp — ten at a
 * time, newest first, filtered by date (Today by default).
 */
export default function AllOrdersScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [dateKey, setDateKey] = useState<'all' | 'today' | '7d' | '30d'>('today');

  const from = useMemo(() => {
    const f = DATE_FILTERS.find((d) => d.key === dateKey);
    return f?.days !== undefined ? startOfDaysAgo(f.days) : undefined;
  }, [dateKey]);

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!accessToken) return { items: [], total: 0 };
      const res = await listAdminOrders(accessToken, {
        status: REAL_ORDER_STATUSES,
        ...(from ? { from } : {}),
        page,
        pageSize,
      });
      return { items: res.data.items, total: res.data.total };
    },
    [accessToken, from]
  );

  const { items, total, loading, loadingMore, refreshing, error, loadMore, refresh } = usePagedList<AdminOrderSummary>(
    fetchPage,
    { maxPageSize: 50, enabled: Boolean(accessToken) }
  );
  useRefreshOnReturn(refresh);

  // Shipped orders open their shipment page; a counter sale has nothing to
  // ship, so it opens its invoice instead.
  const openOrder = (order: AdminOrderSummary) => {
    if (order.channel === 'store') {
      if (order.invoice) navigation.navigate('InvoiceDetail', { invoiceId: order.invoice.id });
      return;
    }
    navigation.navigate('OrderShipment', { orderId: order.id });
  };

  const renderItem = ({ item }: { item: AdminOrderSummary }) => {
    const channel = CHANNEL[item.channel] ?? { label: item.channel, tone: 'primary' as const, icon: 'receipt-outline' as const };
    const canOpen = item.channel !== 'store' || Boolean(item.invoice);
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openOrder(item)} disabled={!canOpen}>
        <Card style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.orderNumber}>{item.orderNumber}</Text>
            <Text style={styles.total}>{formatRupees(item.total)}</Text>
          </View>
          <Text style={styles.items} numberOfLines={1}>{itemsSummary(item)}</Text>
          <View style={styles.bottomRow}>
            <View style={styles.badges}>
              <Badge label={channel.label} tone={channel.tone} />
              <Badge label={STATUS_LABEL[item.status] ?? item.status} tone="neutral" />
            </View>
            <Text style={styles.when}>{formatWhen(item.placedAt)}</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Orders" subtitle={`${total} ${total === 1 ? 'order' : 'orders'} — online, store and WhatsApp`} />

      <View style={styles.dateRow}>
        {DATE_FILTERS.map((f) => (
          <FilterChip key={f.key} label={f.label} active={dateKey === f.key} onPress={() => setDateKey(f.key)} fill />
        ))}
      </View>

      {error && !loadingMore && items.length === 0 ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <SkeletonList count={6} variant="compact" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => refresh({ pull: true })} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            error ? null : (
              <Text style={styles.empty}>{dateKey === 'today' ? 'No orders yet today.' : 'No orders in this period.'}</Text>
            )
          }
          ListFooterComponent={loadingMore ? <SkeletonList count={2} variant="compact" /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  dateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  orderNumber: { ...typography.bodySemibold, color: colors.text },
  total: { ...typography.bodySemibold, color: colors.text },
  items: { ...typography.bodySm, color: colors.textMuted, marginTop: 4 },
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: spacing.sm, marginTop: spacing.sm,
  },
  badges: { flexDirection: 'row', gap: spacing.xs, flexShrink: 1, flexWrap: 'wrap' },
  when: { ...typography.bodySm, fontSize: 11.5, color: colors.textLabel },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: spacing.sm + 2,
    borderRadius: radius.md, marginBottom: spacing.md, fontSize: 13,
  },
});
