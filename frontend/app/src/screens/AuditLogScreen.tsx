import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getAuditLog, AuditLogEntry } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePagedList, useRefreshOnReturn } from '../hooks/usePagedList';
import { AuditTone, dayLabel, describeAuditEntry, timeLabel } from '../utils/auditLog';

type Props = NativeStackScreenProps<AppStackParamList, 'AuditLog'>;
type IconName = keyof typeof Ionicons.glyphMap;

const TONE_COLORS: Record<AuditTone, { bg: string; fg: string }> = {
  sale: { bg: colors.primaryBg, fg: colors.primary },
  catalog: { bg: colors.placeholderBg, fg: colors.textLabel },
  order: { bg: colors.successBg, fg: colors.success },
  team: { bg: colors.primaryBg, fg: colors.primary },
  security: { bg: colors.warningBg, fg: colors.warning },
  signin: { bg: colors.placeholderBg, fg: colors.textMuted },
};

/**
 * The shop's activity history: what was done, by whom, when, and to what.
 *
 * Each entry reads as a sentence — "Price changed, by Priya (Staff)" — with
 * the facts that matter underneath (which subcategory, the price before and
 * after), grouped under Today / Yesterday / the date. Loads ten at a time.
 */
export default function AuditLogScreen(_props: Props) {
  const { accessToken } = useAuth();

  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!accessToken) return { items: [], total: 0 };
      const res = await getAuditLog(accessToken, { page, pageSize });
      return { items: res.data.items, total: res.data.total };
    },
    [accessToken]
  );

  const { items, loading, loadingMore, refreshing, error, loadMore, refresh } = usePagedList<AuditLogEntry>(
    fetchPage,
    { maxPageSize: 100, enabled: Boolean(accessToken) }
  );
  useRefreshOnReturn(refresh);

  const renderItem = ({ item, index }: { item: AuditLogEntry; index: number }) => {
    const d = describeAuditEntry(item);
    const tone = TONE_COLORS[d.tone];
    const day = dayLabel(item.createdAt);
    // A day heading above the first entry of each day.
    const showDay = index === 0 || dayLabel(items[index - 1]!.createdAt) !== day;

    return (
      <View>
        {showDay && <Text style={styles.dayHeading}>{day}</Text>}
        <Card style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
            <Ionicons name={d.icon as IconName} size={17} color={tone.fg} />
          </View>
          <View style={styles.rowInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.rowTitle} numberOfLines={2}>{d.title}</Text>
              <Text style={styles.time}>{timeLabel(item.createdAt)}</Text>
            </View>
            <Text style={[styles.byLine, !item.actor && styles.byLineMuted]}>{d.byLine}</Text>
            {d.details.length > 0 && (
              <View style={styles.details}>
                {d.details.map((detail) => (
                  <View key={detail.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{detail.label}</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>{detail.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.container}>
        <ScreenHeader title="Audit Log" subtitle="What was done in the app, who did it, and when." />

        {loading ? (
          <SkeletonList count={7} variant="text" />
        ) : error && items.length === 0 ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => refresh({ pull: true })} tintColor={colors.primary} />
            }
            ListEmptyComponent={<Text style={styles.empty}>Nothing recorded yet.</Text>}
            ListFooterComponent={loadingMore ? <SkeletonList count={2} variant="text" /> : null}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  dayHeading: {
    ...typography.caption, color: colors.textLabel,
    marginTop: spacing.md, marginBottom: spacing.sm, marginLeft: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm, borderRadius: radius.lg },
  iconWrap: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowTitle: { ...typography.bodySemibold, color: colors.text, flex: 1 },
  time: { ...typography.bodySm, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  byLine: { ...typography.bodySm, color: colors.textLabel, marginTop: 2 },
  byLineMuted: { color: colors.textMuted, fontStyle: 'italic' },
  details: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.divider, gap: 4,
  },
  detailRow: { flexDirection: 'row', gap: spacing.sm },
  detailLabel: { ...typography.bodySm, color: colors.textMuted, width: 96 },
  detailValue: { ...typography.bodySm, color: colors.text, flex: 1 },
  empty: { color: colors.textMuted, fontSize: 13, marginTop: 24, textAlign: 'center' },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: spacing.sm + 2, borderRadius: radius.md, marginTop: spacing.md, fontSize: 13,
  },
});
