import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { AppStackParamList, RootTabParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listAdminOrders, AdminOrderSummary } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { Badge, FilterChip, SegmentedControl } from '../components/ui/Chip';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'OrdersTab'>,
  NativeStackScreenProps<AppStackParamList>
>;

// The whole screen is exactly this binary workflow — nothing else. Entering
// an AWB (markOrderShipped, admin.service.ts) is what moves an order from
// "processing" to "shipped" automatically; there's no manual status step.
const STATUS_TABS: { key: 'to_ship' | 'shipped'; label: string; status: string[] }[] = [
  { key: 'to_ship', label: 'To Ship', status: ['processing'] },
  { key: 'shipped', label: 'Shipped', status: ['shipped'] },
];

const DATE_FILTERS: { key: string; label: string; days?: number }[] = [
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

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatRupees = (amount: string | number): string => `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;

const itemsSummary = (items: { nameSnapshot: string }[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!.nameSnapshot;
  return `${items[0]!.nameSnapshot} + ${items.length - 1} more`;
};

export default function AdminOrdersScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  // Only ever rendered as the "Orders" bottom tab now (Home's "to ship"
  // tile selects the tab rather than pushing a second copy), so the real
  // bar height is always available here.
  const bottomPadding = useBottomTabBarHeight() + spacing.xl;
  const [tab, setTab] = useState<'to_ship' | 'shipped'>('to_ship');
  const [dateKey, setDateKey] = useState('all');

  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const activeTab = STATUS_TABS.find((t) => t.key === tab)!;

  const load = useCallback(
    async (targetPage = 1) => {
      if (!accessToken) return;
      if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');
      try {
        const dateFilter = DATE_FILTERS.find((f) => f.key === dateKey);
        const res = await listAdminOrders(accessToken, {
          status: activeTab.status,
          ...(dateFilter?.days !== undefined ? { from: startOfDaysAgo(dateFilter.days) } : {}),
          page: targetPage,
        });
        setOrders((prev) => (targetPage === 1 ? res.data.items : [...prev, ...res.data.items]));
        setTotal(res.data.total);
        setPage(targetPage);
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, activeTab.status, dateKey]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const hasMore = orders.length < total;
  const subtitle = `${total} ${tab === 'to_ship' ? 'waiting to ship' : 'shipped'}`;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Orders" subtitle={subtitle} showBack={false} />

      <SegmentedControl
        options={STATUS_TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={setTab}
      />

      <View style={styles.dateRow}>
        {DATE_FILTERS.map((f) => (
          <FilterChip key={f.key} label={f.label} active={dateKey === f.key} onPress={() => setDateKey(f.key)} />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && orders.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : orders.length === 0 ? (
        <Text style={styles.empty}>No orders in this view.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(1)} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loadingMore) load(page + 1);
          }}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('OrderShipment', { orderId: item.id })}
            >
              <Card style={styles.orderCard}>
                <View style={styles.orderTopRow}>
                  <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                  <Badge
                    label={tab === 'shipped' ? 'Shipped' : 'To Ship'}
                    tone={tab === 'shipped' ? 'success' : 'primary'}
                  />
                </View>
                <Text style={styles.orderProduct} numberOfLines={2}>{itemsSummary(item.items)}</Text>
                <Text style={styles.orderMeta}>
                  {tab === 'shipped' ? `AWB: ${item.shipment?.awbNumber || '—'}` : `Placed ${formatDate(item.placedAt)}`}
                </Text>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderFooterDate}>
                    {tab === 'shipped' ? `Shipped ${formatDate(item.shipment?.shippedAt ?? null)}` : formatDate(item.placedAt)}
                  </Text>
                  <Text style={styles.orderTotal}>{formatRupees(item.total)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: {
    ...typography.bodySm,
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  orderCard: {
    marginBottom: spacing.md,
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { ...typography.bodySmSemibold, color: colors.textLabel, letterSpacing: 0.4 },
  orderProduct: { ...typography.bodySemibold, fontSize: 16, color: colors.text, marginTop: spacing.sm + 2 },
  orderMeta: { ...typography.bodySm, color: colors.textMuted, marginTop: 4 },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.md + 2,
    paddingTop: spacing.md + 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  orderFooterDate: { ...typography.bodySm, color: colors.textLabel },
  orderTotal: { ...typography.amount, fontSize: 24, color: colors.text },
});
