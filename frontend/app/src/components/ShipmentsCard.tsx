import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { listAdminOrders, AdminOrderSummary } from '../api/admin';
import { goToTab } from '../navigation/tabs';
import { SkeletonBlock } from './ui/Skeleton';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';

interface Props {
  accessToken: string | null;
  navigation: { navigate: (...args: any[]) => void };
}

/** How many waiting orders are previewed on the card. */
const PREVIEW = 3;

const waitingFor = (iso: string): string => {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const itemsLine = (order: AdminOrderSummary): string => {
  const first = order.items[0]?.nameSnapshot ?? 'Order';
  const rest = order.items.length - 1;
  return rest > 0 ? `${first} + ${rest} more` : first;
};

const CHANNEL_LABEL: Record<string, string> = { online: 'Website', whatsapp: 'WhatsApp', store: 'Store' };

/**
 * The Home screen's shipments summary: how many orders are waiting to be
 * packed and how many are already on their way, with the most recent waiting
 * orders one tap away.
 *
 * Replaces a lone "to ship" number tile. It fetches only what it shows — the
 * three newest waiting orders and a count of shipped ones — rather than any
 * full list.
 */
export default function ShipmentsCard({ accessToken, navigation }: Props) {
  const [toShip, setToShip] = useState<{ total: number; items: AdminOrderSummary[] } | null>(null);
  const [shippedTotal, setShippedTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      let cancelled = false;
      setFailed(false);
      Promise.all([
        listAdminOrders(accessToken, { status: ['processing'], page: 1, pageSize: PREVIEW }),
        listAdminOrders(accessToken, { status: ['shipped'], page: 1, pageSize: 1 }),
      ])
        .then(([waiting, shipped]) => {
          if (cancelled) return;
          setToShip({ total: waiting.data.total, items: waiting.data.items });
          setShippedTotal(shipped.data.total);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }, [accessToken])
  );

  const loading = toShip === null && !failed;
  const openList = (tab: 'to_ship' | 'shipped') => goToTab(navigation, 'OrdersTab', { tab });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="cube" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Shipments</Text>
          <Text style={styles.subtitle}>Website and WhatsApp orders</Text>
        </View>
        <TouchableOpacity onPress={() => openList('to_ship')} hitSlop={10} style={styles.viewAll}>
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tiles}>
        <TouchableOpacity
          style={[styles.tile, styles.tileToShip]}
          onPress={() => openList('to_ship')}
          activeOpacity={0.85}
          accessibilityLabel={`${toShip?.total ?? 0} orders to ship`}
        >
          <View style={styles.tileTop}>
            <Ionicons name="time-outline" size={15} color={colors.warning} />
            <Text style={[styles.tileLabel, { color: colors.warning }]}>To ship</Text>
          </View>
          {loading ? (
            <SkeletonBlock width={40} height={26} style={styles.tileSkeleton} />
          ) : (
            <Text style={styles.tileValue}>{failed ? '—' : toShip?.total ?? 0}</Text>
          )}
          <Text style={styles.tileHint}>Waiting to be packed</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, styles.tileShipped]}
          onPress={() => openList('shipped')}
          activeOpacity={0.85}
          accessibilityLabel={`${shippedTotal ?? 0} orders shipped`}
        >
          <View style={styles.tileTop}>
            <Ionicons name="paper-plane-outline" size={15} color={colors.success} />
            <Text style={[styles.tileLabel, { color: colors.success }]}>Shipped</Text>
          </View>
          {loading ? (
            <SkeletonBlock width={40} height={26} style={styles.tileSkeleton} />
          ) : (
            <Text style={styles.tileValue}>{failed ? '—' : shippedTotal ?? 0}</Text>
          )}
          <Text style={styles.tileHint}>On the way to customers</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.list}>
          {Array.from({ length: 2 }, (_, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.rowText}>
                <SkeletonBlock width="45%" height={12} />
                <SkeletonBlock width="70%" height={10} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : failed ? (
        <Text style={styles.note}>Couldn't load shipments. Pull down on Orders to try again.</Text>
      ) : toShip && toShip.items.length > 0 ? (
        <View style={styles.list}>
          <Text style={styles.listHeading}>Waiting to ship</Text>
          {toShip.items.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.row}
              onPress={() => navigation.navigate('OrderShipment', { orderId: order.id })}
              activeOpacity={0.7}
            >
              <View style={styles.rowText}>
                <View style={styles.rowTop}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <Text style={styles.channel}>{CHANNEL_LABEL[order.channel] ?? order.channel}</Text>
                </View>
                <Text style={styles.items} numberOfLines={1}>{itemsLine(order)}</Text>
              </View>
              <Text style={styles.age}>{waitingFor(order.placedAt)}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.iconMuted} />
            </TouchableOpacity>
          ))}
          {toShip.total > toShip.items.length && (
            <TouchableOpacity onPress={() => openList('to_ship')} style={styles.more}>
              <Text style={styles.moreText}>+ {toShip.total - toShip.items.length} more waiting</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.caughtUp}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.caughtUpText}>All caught up — nothing waiting to ship.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerIcon: {
    width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typography.bodySemibold, fontSize: 16, color: colors.text },
  subtitle: { ...typography.bodySm, color: colors.textMuted, marginTop: 1 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { ...typography.bodySmSemibold, color: colors.primary },

  tiles: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.lg },
  tile: { flex: 1, borderRadius: radius.lg, padding: spacing.md },
  tileToShip: { backgroundColor: colors.warningBg },
  tileShipped: { backgroundColor: colors.successBg },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { ...typography.bodySmSemibold },
  tileValue: { ...typography.amount, fontSize: 26, color: colors.text, marginTop: spacing.sm },
  tileSkeleton: { marginTop: spacing.sm },
  tileHint: { ...typography.bodySm, fontSize: 11, color: colors.textLabel, marginTop: 2 },

  list: { marginTop: spacing.lg },
  listHeading: { ...typography.caption, color: colors.textLabel, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderNumber: { ...typography.bodySemibold, fontSize: 13.5, color: colors.text },
  channel: {
    ...typography.bodySm, fontSize: 10.5, color: colors.primary,
    backgroundColor: colors.primaryBg, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden',
  },
  items: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  age: { ...typography.bodySm, fontSize: 11.5, color: colors.textLabel },
  more: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  moreText: { ...typography.bodySmSemibold, color: colors.primary },
  note: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.md },
  caughtUp: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.successBg,
  },
  caughtUpText: { ...typography.bodySm, color: colors.success, flex: 1 },
});
