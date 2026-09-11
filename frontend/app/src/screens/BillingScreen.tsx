import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { scanLookup, ScanLookupResult } from '../api/inventory';
import { completeSale, CompleteSaleResult } from '../api/billing';
import { savePdfBytes, printPdf, sharePdf } from '../utils/pdf';
import { useIsOnline } from '../utils/network';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import OfflineBanner from '../components/OfflineBanner';
import BarcodeScanModal from '../components/BarcodeScanModal';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Billing'>;

interface CartLine {
  code: string;
  name: string;
  mode: 'serialized' | 'quantity';
  quantity: number;
  storePrice: number;
  unitPrice: string; // editable text, parsed on submit
}

const formatRupees = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BillingScreen({}: Props) {
  const { accessToken } = useAuth();
  const isOnline = useIsOnline();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [duplicateHint, setDuplicateHint] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompleteSaleResult | null>(null);
  const [busySharing, setBusySharing] = useState(false);

  const addLookupResult = useCallback((lookup: ScanLookupResult) => {
    const code = lookup.barcode || lookup.sku!;
    setDuplicateHint('');
    setCart((prev) => {
      const existingIndex = prev.findIndex((l) => l.code === code);
      if (existingIndex >= 0) {
        if (lookup.mode === 'serialized') {
          setDuplicateHint(`${lookup.productName} is already on this bill.`);
          return prev;
        }
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex]!, quantity: next[existingIndex]!.quantity + 1 };
        return next;
      }
      return [
        ...prev,
        { code, name: lookup.productName, mode: lookup.mode, quantity: 1, storePrice: Number(lookup.storePrice), unitPrice: lookup.storePrice },
      ];
    });
  }, []);

  const handleScanFound = useCallback(
    (lookup: ScanLookupResult) => {
      addLookupResult(lookup);
      setScannerVisible(false);
    },
    [addLookupResult]
  );

  const handleManualAdd = useCallback(async () => {
    const code = manualCode.trim();
    if (!code || !accessToken) return;
    setError('');
    try {
      const res = await scanLookup(accessToken, code);
      addLookupResult(res.data);
      setManualCode('');
    } catch (err: any) {
      setError(err.message || 'No product found for this code');
    }
  }, [manualCode, accessToken, addLookupResult]);

  const updateLine = useCallback((code: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => (l.code === code ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((code: string) => {
    setCart((prev) => prev.filter((l) => l.code !== code));
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + (Number(l.unitPrice) || 0) * l.quantity, 0),
    [cart]
  );

  const handleCompleteSale = useCallback(async () => {
    if (!accessToken) return;
    if (!isOnline) return setError('You are offline — billing needs a live connection.');
    if (!customerName.trim()) return setError('Enter the customer\'s name.');
    if (cart.length === 0) return setError('Add at least one item to the bill.');

    setSubmitting(true);
    setError('');
    try {
      const res = await completeSale(accessToken, {
        customerName: customerName.trim(),
        ...(customerMobile.trim() ? { customerMobile: customerMobile.trim() } : {}),
        items: cart.map((l) => {
          const unitPrice = Number(l.unitPrice);
          return {
            code: l.code,
            quantity: l.quantity,
            ...(unitPrice !== l.storePrice ? { salePrice: unitPrice } : {}),
          };
        }),
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.message || 'Could not complete this sale');
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, isOnline, customerName, customerMobile, cart]);

  const handleShareInvoice = useCallback(
    async (action: 'print' | 'share') => {
      if (!result) return;
      setBusySharing(true);
      setError('');
      try {
        const res = await fetch(result.invoice.url);
        if (!res.ok) throw new Error('Could not download the invoice PDF');
        const bytes = new Uint8Array(await res.arrayBuffer());
        const uri = savePdfBytes(bytes, `${result.invoice.invoiceNumber}.pdf`);
        if (action === 'print') await printPdf(uri);
        else await sharePdf(uri);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setBusySharing(false);
      }
    },
    [result]
  );

  const startNewSale = useCallback(() => {
    setCart([]);
    setCustomerName('');
    setCustomerMobile('');
    setResult(null);
    setError('');
  }, []);

  if (result) {
    return (
      <View style={styles.screen}>
        <View style={styles.container}>
          <ScreenHeader title="Billing" backLabel="Home" />
          <View style={styles.soldPanel}>
            <Ionicons name="checkmark-circle" size={46} color={colors.success} />
            <Text style={styles.soldHeading}>Sale Complete</Text>
            <Text style={styles.soldMeta}>Order {result.orderNumber} · Invoice {result.invoice.invoiceNumber}</Text>
            <Text style={styles.soldAmount}>{formatRupees(Number(result.invoice.totalAmount))}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {busySharing ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
            ) : (
              <View style={styles.actionColumn}>
                <Button title="Print Invoice" onPress={() => handleShareInvoice('print')} />
                <Button title="Share Invoice" onPress={() => handleShareInvoice('share')} variant="secondary" style={styles.secondAction} />
                <Button title="Start New Sale" onPress={startNewSale} variant="secondary" style={styles.secondAction} />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Billing" subtitle="Bill several items to one customer" backLabel="Home" />

        {!isOnline && <OfflineBanner />}

        <View style={styles.addRow}>
          <TouchableOpacity style={styles.scanButton} onPress={() => setScannerVisible(true)} activeOpacity={0.85}>
            <Ionicons name="barcode-outline" size={18} color="#fff" />
            <Text style={styles.scanButtonText}>Scan Item</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.manualInput}
            placeholder="Or type a barcode / SKU"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            returnKeyType="done"
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={handleManualAdd}
          />
        </View>
        {duplicateHint && <Text style={styles.hint}>{duplicateHint}</Text>}

        {cart.length === 0 ? (
          <Text style={styles.emptyCart}>No items yet — scan or type a code to start the bill.</Text>
        ) : (
          <Card style={styles.cartCard}>
            {cart.map((line, index) => (
              <View key={line.code} style={[styles.cartRow, index === cart.length - 1 && styles.cartRowLast]}>
                <View style={styles.cartRowTop}>
                  <Text style={styles.cartName} numberOfLines={2}>{line.name}</Text>
                  <TouchableOpacity onPress={() => removeLine(line.code)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cartRowBottom}>
                  {line.mode === 'quantity' ? (
                    <View style={styles.qtyStepper}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateLine(line.code, { quantity: Math.max(1, line.quantity - 1) })}
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{line.quantity}</Text>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => updateLine(line.code, { quantity: line.quantity + 1 })}>
                        <Ionicons name="add" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.qtyFixed}>Qty 1</Text>
                  )}
                  <TextInput
                    style={styles.priceInput}
                    keyboardType="numeric"
                    value={line.unitPrice}
                    onChangeText={(v) => updateLine(line.code, { unitPrice: v })}
                  />
                  <Text style={styles.lineSubtotal}>{formatRupees((Number(line.unitPrice) || 0) * line.quantity)}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {cart.length > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatRupees(total)}</Text>
          </View>
        )}

        <Text style={[typography.caption, styles.sectionLabel]}>Customer</Text>
        <TextInput
          style={styles.input}
          placeholder="Customer name"
          placeholderTextColor={colors.textFaint}
          value={customerName}
          onChangeText={setCustomerName}
        />
        <TextInput
          style={[styles.input, { marginTop: spacing.sm }]}
          placeholder="Mobile number (optional)"
          placeholderTextColor={colors.textFaint}
          keyboardType="phone-pad"
          value={customerMobile}
          onChangeText={setCustomerMobile}
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {submitting ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : (
          <Button title="Complete Sale" onPress={handleCompleteSale} disabled={!isOnline} style={styles.completeButton} />
        )}
      </ScrollView>

      <BarcodeScanModal
        visible={scannerVisible}
        accessToken={accessToken}
        onClose={() => setScannerVisible(false)}
        onFound={handleScanFound}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  scanButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  scanButtonText: { ...typography.bodySemibold, color: '#fff' },
  manualInput: {
    flex: 1, backgroundColor: colors.inputBg, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    ...typography.body, color: colors.text,
  },
  hint: { ...typography.bodySm, color: colors.warning, marginTop: spacing.sm },
  emptyCart: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  cartCard: { marginTop: spacing.lg, paddingVertical: 0, paddingHorizontal: spacing.lg },
  cartRow: { paddingVertical: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: colors.divider },
  cartRowLast: { borderBottomWidth: 0 },
  cartRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  cartName: { ...typography.bodySemibold, color: colors.text, flex: 1 },
  cartRowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.segmentTrack, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 4 },
  qtyButton: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  qtyValue: { ...typography.bodySemibold, color: colors.text, minWidth: 18, textAlign: 'center' },
  qtyFixed: { ...typography.bodySm, color: colors.textMuted },
  priceInput: {
    ...typography.bodySm, color: colors.text, backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 6, width: 84, textAlign: 'right',
  },
  lineSubtotal: { ...typography.bodySemibold, color: colors.text, flex: 1, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider,
  },
  totalLabel: { ...typography.bodySemibold, color: colors.text },
  totalValue: { ...typography.amount, fontSize: 22, color: colors.text },
  sectionLabel: { color: colors.textLabel, marginTop: spacing.xl - 2, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    ...typography.body, color: colors.text,
  },
  completeButton: { marginTop: spacing.xl },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md, padding: spacing.sm + 2, marginTop: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
  error: { ...typography.bodySm, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  soldPanel: {
    marginTop: spacing.xl, backgroundColor: colors.successBg, borderRadius: radius.xxl,
    padding: spacing.xl + 6, alignItems: 'center',
  },
  soldHeading: { ...typography.display, color: colors.success, marginTop: spacing.md },
  soldMeta: { ...typography.bodyMedium, color: colors.success, marginTop: spacing.sm, textAlign: 'center' },
  soldAmount: { ...typography.amount, fontSize: 28, color: colors.text, marginTop: spacing.md },
  actionColumn: { marginTop: spacing.xl, width: '100%' },
  secondAction: { marginTop: spacing.sm + 2 },
});
