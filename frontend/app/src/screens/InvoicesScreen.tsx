import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { listInvoices, generateSalesReportPdf, Invoice, InvoiceChannelFilter } from '../api/invoices';
import { savePdfBytes, printPdf, sharePdf } from '../utils/pdf';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import { SkeletonList } from '../components/ui/Skeleton';
import { usePagedList } from '../hooks/usePagedList';
import Button from '../components/ui/Button';
import DatePickerModal from '../components/DatePickerModal';
import { Badge, SegmentedControl } from '../components/ui/Chip';

type Props = NativeStackScreenProps<AppStackParamList, 'Invoices'>;

// SegmentedControl (same connected-pill-track component the channel filter
// below and Analytics' own date-range picker already use) rather than
// independently-wrapped chips — its segments are guaranteed equal-width and
// single-line (numberOfLines=1 inside), which is what actually keeps five
// options aligned edge-to-edge with no ragged heights or leftover space.
const DATE_FILTERS: { key: string; label: string; days?: number }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const CHANNEL_OPTIONS: { key: InvoiceChannelFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'store', label: 'Store' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const startOfThisMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const CHANNEL_BADGE: Record<string, { label: string; tone: 'primary' | 'success' | 'warning' }> = {
  online: { label: 'Online', tone: 'primary' },
  store: { label: 'Store', tone: 'success' },
  whatsapp: { label: 'WhatsApp', tone: 'warning' },
};

const startOfDaysAgo = (days: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const formatRupees = (amount: string | number): string => `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;

export default function InvoicesScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [dateKey, setDateKey] = useState('all');
  const [channel, setChannel] = useState<InvoiceChannelFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [datePickerFor, setDatePickerFor] = useState<'from' | 'to' | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  // Kept apart from the list's own error, so a failed PDF doesn't read as the list failing to load.
  const [reportError, setReportError] = useState('');

  // Custom range needs both ends filled in and parseable before it's usable
  // as a filter — until then just hold off rather than firing a bad request.
  const customRangeReady = useMemo(() => {
    if (dateKey !== 'custom') return true;
    if (!customFrom || !customTo) return false;
    return !Number.isNaN(new Date(customFrom).getTime()) && !Number.isNaN(new Date(customTo).getTime());
  }, [dateKey, customFrom, customTo]);

  // The exact window the list is showing, reused verbatim by the complete
  // invoice below so the PDF always covers what's on screen.
  const activeRange = useMemo((): { from?: string; to?: string } => {
    if (dateKey === 'custom') {
      if (!customFrom || !customTo) return {};
      return { from: new Date(customFrom).toISOString(), to: new Date(`${customTo}T23:59:59.999`).toISOString() };
    }
    if (dateKey === 'month') return { from: startOfThisMonth().toISOString() };
    const dateFilter = DATE_FILTERS.find((f) => f.key === dateKey);
    return dateFilter?.days !== undefined ? { from: startOfDaysAgo(dateFilter.days) } : {};
  }, [dateKey, customFrom, customTo]);

  // Ten invoices at a time; a new channel or date range starts the list
  // over. A half-filled custom range doesn't fetch at all (see
  // customRangeReady) — the previous list stays until both dates are set.
  const fetchPage = useCallback(
    async (page: number, pageSize: number) => {
      if (!accessToken) return { items: [], total: 0 };
      const res = await listInvoices(accessToken, { channel, ...activeRange, page, pageSize });
      return { items: res.data.items, total: res.data.total };
    },
    [accessToken, channel, activeRange]
  );

  const {
    items: invoices, total, loading, loadingMore, refreshing, error, loadMore, refresh,
  } = usePagedList<Invoice>(fetchPage, { maxPageSize: 50, enabled: Boolean(accessToken) && customRangeReady });

  // One consolidated invoice for the whole selected period — every sale in
  // range across all three channels (online, in-store, WhatsApp), grouped by
  // product with the GST breakdown, generated fresh each time.
  const handleCompleteInvoice = useCallback(
    async (action: 'print' | 'share') => {
      if (!accessToken) return;
      if (dateKey === 'custom' && !customRangeReady) {
        setReportError('Pick both a From and a To date first.');
        return;
      }
      setGeneratingReport(true);
      setReportError('');
      try {
        const result = await generateSalesReportPdf(accessToken, { ...activeRange, channel });
        const uri = savePdfBytes(result.bytes, `sales-summary-${Date.now()}.pdf`);
        if (action === 'print') await printPdf(uri);
        else await sharePdf(uri);
      } catch (err: any) {
        setReportError(err.message || 'Failed to generate the complete invoice');
      } finally {
        setGeneratingReport(false);
      }
    },
    [accessToken, activeRange, channel, dateKey, customRangeReady]
  );


  return (
    <View style={styles.container}>
      <ScreenHeader title="Invoices" subtitle={`${total} generated`} />

      <Text style={[typography.caption, styles.filterLabel]}>Channel</Text>
      <SegmentedControl options={CHANNEL_OPTIONS} value={channel} onChange={setChannel} />

      <Text style={[typography.caption, styles.filterLabel]}>Date Range</Text>
      <View style={styles.dateControlWrap}>
        <SegmentedControl options={DATE_FILTERS} value={dateKey} onChange={setDateKey} />
      </View>

      {dateKey === 'custom' && (
        <View style={styles.customRow}>
          <TouchableOpacity style={styles.dateField} onPress={() => setDatePickerFor('from')} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={customFrom ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
              {customFrom || 'From'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateField} onPress={() => setDatePickerFor('to')} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={customTo ? styles.dateFieldValue : styles.dateFieldPlaceholder}>
              {customTo || 'To'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.reportRow}>
        <Button
          title={generatingReport ? 'Preparing…' : 'Complete Invoice — Print'}
          onPress={() => handleCompleteInvoice('print')}
          disabled={generatingReport}
          style={styles.reportButton}
        />
        <Button
          title="Share"
          variant="secondary"
          onPress={() => handleCompleteInvoice('share')}
          disabled={generatingReport}
          style={styles.reportShareButton}
        />
      </View>
      <Text style={styles.reportHint}>
        One consolidated invoice for the selected period — online, store and WhatsApp sales together.
      </Text>

      {reportError ? <Text style={styles.error}>{reportError}</Text> : null}
      {error && !loadingMore ? <Text style={styles.error}>{error}</Text> : null}

      {loading && invoices.length === 0 ? (
        <SkeletonList count={6} variant="compact" />
      ) : invoices.length === 0 ? (
        <Text style={styles.empty}>No invoices in this view.</Text>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh({ pull: true })} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={loadingMore ? <SkeletonList count={2} variant="compact" /> : null}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}>
              <Card style={styles.invoiceCard}>
                <View style={styles.topRow}>
                  <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                  <Badge label={CHANNEL_BADGE[item.channel]?.label ?? item.channel} tone={CHANNEL_BADGE[item.channel]?.tone ?? 'neutral'} />
                </View>
                <Text style={styles.customerName} numberOfLines={1}>{item.customerName || 'Walk-in customer'}</Text>
                <View style={styles.footer}>
                  <Text style={styles.footerDate}>{formatDate(item.generatedAt)}</Text>
                  <Text style={styles.total}>{formatRupees(item.totalAmount)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      <DatePickerModal
        visible={datePickerFor !== null}
        title={datePickerFor === 'to' ? 'To date' : 'From date'}
        value={datePickerFor === 'to' ? customTo : customFrom}
        // Keep the range coherent: "from" can't be after "to", "to" can't be
        // before "from", and neither can run past today.
        maximumDate={datePickerFor === 'from' && customTo ? new Date(customTo) : new Date()}
        {...(datePickerFor === 'to' && customFrom ? { minimumDate: new Date(customFrom) } : {})}
        onSelect={(iso) => (datePickerFor === 'to' ? setCustomTo(iso) : setCustomFrom(iso))}
        onClose={() => setDatePickerFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  filterLabel: { color: colors.textLabel, marginTop: spacing.lg, marginBottom: spacing.sm },
  dateControlWrap: { marginBottom: spacing.lg },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  dateField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  dateFieldValue: { ...typography.body, color: colors.text },
  dateFieldPlaceholder: { ...typography.body, color: colors.textFaint },
  reportRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  reportButton: { flex: 2 },
  reportShareButton: { flex: 1 },
  reportHint: { ...typography.bodySm, fontSize: 11.5, color: colors.textMuted, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    ...typography.body, color: colors.text,
  },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  error: {
    ...typography.bodySm, color: colors.error, backgroundColor: colors.errorBg,
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md,
  },
  invoiceCard: { marginBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invoiceNumber: { ...typography.bodySmSemibold, color: colors.textLabel, letterSpacing: 0.4 },
  customerName: { ...typography.bodySemibold, fontSize: 16, color: colors.text, marginTop: spacing.sm + 2 },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: spacing.md + 2, paddingTop: spacing.md + 2, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  footerDate: { ...typography.bodySm, color: colors.textLabel },
  total: { ...typography.amount, fontSize: 24, color: colors.text },
});
