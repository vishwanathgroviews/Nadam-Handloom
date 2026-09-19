import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import DatePickerModal from '../components/DatePickerModal';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import {
  getAnalyticsSummary,
  getTopSubcategories,
  AnalyticsSummary,
  TopSubcategoryEntry,
  GroupBy,
  ChannelFilter,
} from '../api/analytics';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import { FilterChip, SegmentedControl } from '../components/ui/Chip';
import { dayRange } from '../utils/dayRange';

type Props = NativeStackScreenProps<AppStackParamList, 'Analytics'>;

type Preset = 'today' | 'week' | 'month' | 'custom';

const formatRupees = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

const RANGE_OPTIONS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 Days' },
  { key: 'month', label: '30 Days' },
  { key: 'custom', label: 'Custom' },
];

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: 'all', label: 'All Channels' },
  { value: 'online', label: 'Online' },
  { value: 'store', label: 'Store' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const rangeForPreset = (preset: Preset): { from: Date; to: Date; groupBy: GroupBy } => {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'today') {
    from.setHours(0, 0, 0, 0);
    return { from, to, groupBy: 'day' };
  }
  if (preset === 'week') {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to, groupBy: 'day' };
  }
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from, to, groupBy: 'week' };
};

export default function AnalyticsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [preset, setPreset] = useState<Preset>('today');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [datePickerFor, setDatePickerFor] = useState<'from' | 'to' | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topSubcategories, setTopSubcategories] = useState<TopSubcategoryEntry[]>([]);

  const range = useMemo(() => {
    if (preset === 'custom') {
      // Whole local days — see dayRange for why new Date('YYYY-MM-DD') was
      // wrong: it made a single chosen day a zero-length range.
      const days = dayRange(customFrom, customTo);
      return { from: days?.from, to: days?.to, groupBy: 'day' as GroupBy };
    }
    return rangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    if (preset === 'custom' && (!range.from || !range.to || Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime()))) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = {
        from: range.from?.toISOString(),
        to: range.to?.toISOString(),
        groupBy: range.groupBy,
        limit: 5,
        channel,
      };
      const [summaryRes, subcategoriesRes] = await Promise.all([
        getAnalyticsSummary(accessToken, params),
        getTopSubcategories(accessToken, params),
      ]);
      setSummary(summaryRes.data);
      setTopSubcategories(subcategoriesRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [accessToken, preset, range, channel]);

  useEffect(() => {
    load();
  }, [load]);

  const maxSubcategoryRevenue = Math.max(1, ...topSubcategories.map((s) => s.revenue));

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="Analytics" subtitle="Revenue and sales across online, store and WhatsApp — Admin only." />

        <SegmentedControl options={RANGE_OPTIONS} value={preset} onChange={setPreset} />

        {preset === 'custom' && (
          <View style={styles.customRow}>
            <TouchableOpacity style={styles.dateField} onPress={() => setDatePickerFor('from')} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={customFrom ? styles.dateFieldValue : styles.dateFieldPlaceholder}>{customFrom || 'From'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateField} onPress={() => setDatePickerFor('to')} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={customTo ? styles.dateFieldValue : styles.dateFieldPlaceholder}>{customTo || 'To'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[typography.caption, styles.filterLabel]}>Channel</Text>
        <View style={styles.chipRow}>
          {CHANNEL_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              active={channel === opt.value}
              onPress={() => setChannel(opt.value)}
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : summary ? (
          <>
            <Card style={styles.revenueCard}>
              <Text style={[typography.caption, styles.revenueLabel]}>Revenue</Text>
              <View style={styles.revenueRow}>
                <Text style={[typography.display, styles.revenueValue]}>{formatRupees(summary.totalRevenue)}</Text>
              </View>
            </Card>

            <View style={styles.statsRow}>
              <StatCard label="Orders" value={summary.orderCount} />
              <StatCard label="Avg. Order Value" value={formatRupees(summary.averageOrderValue)} />
            </View>

            {channel === 'all' && (
              <Card style={styles.channelCard}>
                <Text style={[typography.caption, styles.channelLabel]}>By Channel</Text>
                <View style={styles.channelSplitRow}>
                  {([
                    { key: 'online', label: 'Online', data: summary.online },
                    { key: 'store', label: 'Store', data: summary.store },
                    { key: 'whatsapp', label: 'WhatsApp', data: summary.whatsapp },
                  ] as const).map((entry) => (
                    <View key={entry.key} style={styles.channelSplitCol}>
                      <Text style={styles.channelSplitLabel}>{entry.label}</Text>
                      <Text style={[typography.h2, styles.channelValue]}>{entry.data?.count ?? 0}</Text>
                      <Text style={styles.channelSub}>{formatRupees(entry.data?.total ?? 0)}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            <Text style={[typography.caption, styles.sectionLabel]}>Top Subcategories</Text>
            <Card style={styles.topSubsCard}>
              {topSubcategories.length === 0 ? (
                <Text style={styles.helper}>No sales in this range.</Text>
              ) : (
                topSubcategories.map((s, i) => (
                  <View
                    key={s.subcategoryId}
                    style={[styles.subRow, i === topSubcategories.length - 1 && styles.subRowLast]}
                  >
                    <View style={styles.subRowTop}>
                      <Text style={styles.subName} numberOfLines={1}>{s.subcategoryName}</Text>
                      <Text style={styles.subValue}>{formatRupees(s.revenue)}</Text>
                    </View>
                    <View style={styles.subTrack}>
                      <View style={[styles.subFill, { width: `${(s.revenue / maxSubcategoryRevenue) * 100}%` }]} />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>

      <DatePickerModal
        visible={datePickerFor !== null}
        title={datePickerFor === 'to' ? 'To date' : 'From date'}
        value={datePickerFor === 'to' ? customTo : customFrom}
        maximumDate={datePickerFor === 'from' && customTo ? new Date(customTo) : new Date()}
        {...(datePickerFor === 'to' && customFrom ? { minimumDate: new Date(customFrom) } : {})}
        onSelect={(iso) => (datePickerFor === 'to' ? setCustomTo(iso) : setCustomFrom(iso))}
        onClose={() => setDatePickerFor(null)}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl },
  filterLabel: { color: colors.textLabel, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  dateField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  dateFieldValue: { ...typography.body, color: colors.text },
  dateFieldPlaceholder: { ...typography.body, color: colors.textFaint },
  revenueCard: { marginTop: spacing.lg },
  revenueLabel: { color: colors.textLabel },
  revenueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.sm },
  revenueValue: { color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  channelCard: { marginTop: spacing.md },
  channelLabel: { color: colors.textLabel },
  channelSplitRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  channelSplitCol: { flex: 1 },
  channelSplitLabel: { ...typography.bodySm, fontSize: 12, color: colors.textLabel },
  channelValue: { color: colors.text, marginTop: spacing.xs + 2 },
  channelSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  sectionLabel: { color: colors.textLabel, marginTop: spacing.xl - 2, marginBottom: spacing.md },
  topSubsCard: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  subRow: { paddingVertical: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: colors.divider },
  subRowLast: { borderBottomWidth: 0 },
  subRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  subName: { ...typography.bodySemibold, color: colors.text, flex: 1, marginRight: spacing.sm },
  subValue: { ...typography.bodySm, color: colors.textMuted },
  subTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.segmentTrack, marginTop: spacing.sm, overflow: 'hidden' },
  subFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  helper: { fontSize: 12, color: colors.textMuted, paddingVertical: spacing.md },
  error: {
    color: colors.error, backgroundColor: colors.errorBg, padding: spacing.sm + 2, borderRadius: radius.md, marginTop: spacing.md, fontSize: 13,
  },
});
