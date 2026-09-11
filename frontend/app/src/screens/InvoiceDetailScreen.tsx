import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getInvoice, Invoice } from '../api/invoices';
import { savePdfBytes, printPdf, sharePdf } from '../utils/pdf';
import { useIsOnline } from '../utils/network';
import OfflineBanner from '../components/OfflineBanner';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'InvoiceDetail'>;

const formatRupees = (amount: string | number): string => `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoiceDetailScreen({ route }: Props) {
  const { invoiceId } = route.params;
  const { accessToken } = useAuth();
  const isOnline = useIsOnline();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getInvoice(accessToken, invoiceId)
      .then((res) => setInvoice(res.data))
      .catch((err) => setError(err.message || 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [accessToken, invoiceId]);

  const fetchPdfUri = useCallback(async () => {
    if (!invoice) return null;
    const res = await fetch(invoice.url);
    if (!res.ok) throw new Error('Could not download this invoice PDF');
    const bytes = new Uint8Array(await res.arrayBuffer());
    return savePdfBytes(bytes, `${invoice.invoiceNumber}.pdf`);
  }, [invoice]);

  const handleAction = useCallback(
    async (action: 'print' | 'share') => {
      if (!isOnline) return setError('You are offline — fetching the PDF needs a live connection.');
      setBusy(true);
      setError('');
      try {
        const uri = await fetchPdfUri();
        if (!uri) return;
        if (action === 'print') await printPdf(uri);
        else await sharePdf(uri);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setBusy(false);
      }
    },
    [isOnline, fetchPdfUri]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Invoice" backLabel="Invoices" />
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Invoice" backLabel="Invoices" />
        <Text style={styles.error}>{error || 'Invoice not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={invoice.invoiceNumber} backLabel="Invoices" subtitle={new Date(invoice.generatedAt).toLocaleDateString()} />

      {!isOnline && <OfflineBanner />}

      <Card style={styles.card}>
        {/* An invoice states what was sold and the tax on it — the mode of
            sale (online / store / WhatsApp) is internal and is deliberately
            not shown on the document or here. Channel filtering still lives
            on the Invoices list. */}
        <View style={styles.topRow}>
          <Text style={styles.customerName}>{invoice.customerName || 'Walk-in customer'}</Text>
        </View>
        {invoice.customerMobile && <Text style={styles.customerMobile}>Mobile: {invoice.customerMobile}</Text>}

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Taxable Value</Text>
          <Text style={styles.summaryValue}>{formatRupees(invoice.taxableValue)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>CGST @ {(Number(invoice.gstRatePercent) / 2).toFixed(2)}%</Text>
          <Text style={styles.summaryValue}>{formatRupees(invoice.cgstAmount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>SGST @ {(Number(invoice.gstRatePercent) / 2).toFixed(2)}%</Text>
          <Text style={styles.summaryValue}>{formatRupees(invoice.sgstAmount)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatRupees(invoice.totalAmount)}</Text>
        </View>
      </Card>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {busy ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
      ) : (
        <View style={styles.actionColumn}>
          <Button title="Print" onPress={() => handleAction('print')} disabled={!isOnline} />
          <Button title="Share" onPress={() => handleAction('share')} disabled={!isOnline} variant="secondary" style={styles.secondAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { marginTop: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerName: { ...typography.h2, color: colors.text, flex: 1, marginRight: spacing.sm },
  customerMobile: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { ...typography.bodySm, color: colors.textMuted },
  summaryValue: { ...typography.bodySm, color: colors.text },
  totalLabel: { ...typography.bodySemibold, color: colors.text },
  totalValue: { ...typography.amount, fontSize: 20, color: colors.text },
  actionColumn: { marginTop: spacing.xl },
  secondAction: { marginTop: spacing.sm + 2 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.sm + 2, marginTop: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
  error: {
    ...typography.bodySm, color: colors.error, backgroundColor: colors.errorBg,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md,
  },
});
