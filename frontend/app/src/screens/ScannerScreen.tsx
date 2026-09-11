import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { scanLookup, scanSell, ScanLookupResult, ScanSellResult, WhatsappCustomerInput } from '../api/inventory';
import { useIsOnline } from '../utils/network';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import OfflineBanner from '../components/OfflineBanner';
import { SUPPORTED_BARCODE_TYPES } from '../utils/barcodeTypes';
import { savePdfBytes, printPdf, sharePdf } from '../utils/pdf';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';
import { openWhatsAppChat } from '../utils/whatsapp';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge, SegmentedControl } from '../components/ui/Chip';

type Props = NativeStackScreenProps<AppStackParamList, 'Scanner'>;

type Mode = 'sell' | 'lookup';
type Phase = 'scanning' | 'processing' | 'result';
type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';
// Where the sale is actually happening: handed over at the counter, or
// agreed over chat and still to be couriered.
type SaleChannel = 'store' | 'whatsapp';

const SALE_CHANNEL_OPTIONS: { key: SaleChannel; label: string }[] = [
  { key: 'store', label: 'Offline Store' },
  { key: 'whatsapp', label: 'Through WhatsApp' },
];

const EMPTY_CUSTOMER = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  notes: '',
};

const STATUS_LABEL: Record<string, string> = {
  in_stock: 'In stock',
  reserved: 'Reserved online right now',
  sold_online: 'Already sold (online)',
  sold_offline: 'Already sold (in store)',
  damaged: 'Marked damaged',
  returned: 'Marked returned',
  out_of_stock: 'Out of stock',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  in_stock: 'success',
  reserved: 'warning',
  sold_online: 'neutral',
  sold_offline: 'neutral',
  damaged: 'error',
  returned: 'neutral',
  out_of_stock: 'error',
};

const MODE_OPTIONS: { key: Mode; label: string }[] = [
  { key: 'sell', label: 'Scan to Sell' },
  { key: 'lookup', label: 'Price Check' },
];

export default function ScannerScreen({ navigation }: Props) {
  const { accessToken, role } = useAuth();
  const isOnline = useIsOnline();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('sell');
  const [phase, setPhase] = useState<Phase>('scanning');
  const [manualCode, setManualCode] = useState('');
  const [lookup, setLookup] = useState<ScanLookupResult | null>(null);
  const [sellResult, setSellResult] = useState<ScanSellResult | null>(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [scannedLock, setScannedLock] = useState(false);
  const [salePriceInput, setSalePriceInput] = useState('');
  const [saleChannel, setSaleChannel] = useState<SaleChannel>('store');
  // Only used for a WhatsApp sale — it's a remote order, so it can't be
  // completed without somewhere to send the parcel.
  const [customer, setCustomer] = useState({ ...EMPTY_CUSTOMER });
  const [busySharing, setBusySharing] = useState(false);
  // Kept apart from `error`: that one means "the scan/sale failed" and takes
  // over the whole result area. A print/share problem happens after the sale
  // is already done, so it has to show inside the Sold panel instead of
  // replacing it with something that reads like the sale didn't go through.
  const [shareError, setShareError] = useState('');

  const reset = useCallback(() => {
    setPhase('scanning');
    setLookup(null);
    setSellResult(null);
    setError('');
    setErrorCode('');
    setShareError('');
    setManualCode('');
    setScannedLock(false);
    setSalePriceInput('');
    setSaleChannel('store');
    setCustomer({ ...EMPTY_CUSTOMER });
  }, []);

  const updateCustomer = useCallback(
    (field: keyof typeof EMPTY_CUSTOMER, value: string) =>
      setCustomer((prev) => ({ ...prev, [field]: value })),
    []
  );

  const runLookup = useCallback(
    async (code: string) => {
      if (!accessToken) return;
      setPhase('processing');
      setError('');
      try {
        const res = await scanLookup(accessToken, code);
        setLookup(res.data);
        setPhase('result');
      } catch (err: any) {
        setError(err.message || 'No product found for this code');
        setPhase('result');
      }
    },
    [accessToken]
  );

  const runSell = useCallback(
    async (code: string, override = false, salePrice?: number) => {
      if (!accessToken) return;

      // A WhatsApp order is going to be couriered, so it can't be recorded
      // without a name, a number to message, and an address to ship to.
      let customerPayload: WhatsappCustomerInput | undefined;
      if (saleChannel === 'whatsapp') {
        const missing = (['fullName', 'phone', 'line1', 'city', 'state', 'pincode'] as const).filter(
          (field) => !customer[field].trim()
        );
        if (missing.length) {
          setError('Enter the customer\'s name, mobile number and full delivery address first.');
          setPhase('result');
          return;
        }
        customerPayload = {
          fullName: customer.fullName.trim(),
          phone: customer.phone.trim(),
          line1: customer.line1.trim(),
          ...(customer.line2.trim() ? { line2: customer.line2.trim() } : {}),
          city: customer.city.trim(),
          state: customer.state.trim(),
          pincode: customer.pincode.trim(),
          ...(customer.notes.trim() ? { notes: customer.notes.trim() } : {}),
        };
      }

      setPhase('processing');
      setError('');
      setErrorCode('');
      try {
        const res = await scanSell(accessToken, code, {
          override,
          salePrice,
          channel: saleChannel,
          ...(customerPayload ? { customer: customerPayload } : {}),
        });
        setSellResult(res.data);
        setPhase('result');
      } catch (err: any) {
        setError(err.message || 'Could not complete this sale');
        setErrorCode(err.code || '');
        // Keep the lookup context (if we have it) so a RESERVED_ONLINE error
        // can still offer the override action.
        setPhase('result');
      }
    },
    [accessToken, saleChannel, customer]
  );

  // Same print/share path the Billing screen uses for its multi-item bill —
  // the invoice PDF lives in object storage, so it's fetched, written to a
  // local file, and handed to the OS print/share sheet.
  const handleShareInvoice = useCallback(
    async (action: 'print' | 'share') => {
      const invoice = sellResult?.invoice;
      if (!invoice) return;
      setBusySharing(true);
      setShareError('');
      try {
        const res = await fetch(invoice.url);
        if (!res.ok) throw new Error('Could not download the invoice PDF');
        const bytes = new Uint8Array(await res.arrayBuffer());
        const uri = savePdfBytes(bytes, `${invoice.invoiceNumber}.pdf`);
        if (action === 'print') await printPdf(uri);
        else await sharePdf(uri);
      } catch (err: any) {
        setShareError(err.message || 'Could not open the invoice');
      } finally {
        setBusySharing(false);
      }
    },
    [sellResult]
  );

  // Only send salePrice if the staff member actually typed a different
  // number — leaving it blank sells at the category's store price, same as
  // before this field existed, and avoids spurious audit-log noise.
  const enteredSalePrice = useCallback((): number | undefined => {
    const trimmed = salePriceInput.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    if (lookup && parsed === Number(lookup.storePrice)) return undefined;
    return parsed;
  }, [salePriceInput, lookup]);

  const handleCode = useCallback(
    (code: string) => {
      if (!isOnline) {
        setError('You are offline — scanning (lookup and sale) needs a live connection.');
        setPhase('result');
        return;
      }
      // Sell mode looks up first too, so the confirm step shows what's about to be sold.
      runLookup(code);
    },
    [isOnline, runLookup]
  );

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scannedLock || phase !== 'scanning') return;
      setScannedLock(true);
      handleCode(data);
    },
    [scannedLock, phase, handleCode]
  );

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    handleCode(manualCode.trim());
  };

  const confirmSale = () => {
    if (!isOnline) return setError('You are offline — selling needs a live connection.');
    const code = lookup?.barcode || lookup?.sku;
    if (code) runSell(code, false, enteredSalePrice());
  };

  const overrideSale = () => {
    if (!isOnline) return setError('You are offline — selling needs a live connection.');
    const code = lookup?.barcode || lookup?.sku;
    if (code) runSell(code, true, enteredSalePrice());
  };

  // Shares this item's details to WhatsApp — for negotiating/confirming an
  // order over chat before (or instead of) recording it as sold here. Since
  // this is triggered from an anonymous in-store scan (no customer on
  // record), it opens WhatsApp's own contact picker rather than a fixed
  // number.
  const sellViaWhatsApp = () => {
    if (!lookup) return;
    const price = salePriceInput.trim() || lookup.storePrice;
    openWhatsAppChat(
      null,
      `Hi! Checking on this for you:\n\n${lookup.productName}\n${lookup.categoryName}\nPrice: ₹${price}\n\nShall I go ahead with the order?`
    );
  };

  if (!permission) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title="Scanner" subtitle="Sell or check a price" showBack={false} />

        {!isOnline && <OfflineBanner />}

        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={(key) => {
            setMode(key);
            reset();
          }}
        />

        {phase === 'scanning' && (
          <>
            <View style={styles.cameraWrap}>
              {permission.granted ? (
                <>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                  <View style={styles.viewfinderWrap} pointerEvents="none">
                    <View style={styles.viewfinder} />
                  </View>
                </>
              ) : (
                <View style={styles.permissionPrompt}>
                  <Text style={styles.permissionText}>Camera access is needed to scan tags.</Text>
                  <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
                    <Text style={styles.permissionButtonText}>Allow Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.manualPill}>
              <TextInput
                style={styles.manualInput}
                placeholder="Or type a barcode / SKU"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                returnKeyType="search"
                value={manualCode}
                onChangeText={setManualCode}
                onSubmitEditing={handleManualSubmit}
              />
            </View>
          </>
        )}

        {phase === 'processing' && <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />}

        {phase === 'result' && (
          <>
            {error ? (
              <Card style={styles.resultCard}>
                <Text style={styles.error}>{error}</Text>
                {errorCode === 'RESERVED_ONLINE' && role === 'ADMIN' && (
                  <Button title="Override & Sell Anyway" variant="destructive" onPress={overrideSale} style={styles.overrideButton} />
                )}
                {errorCode === 'RESERVED_ONLINE' && role !== 'ADMIN' && (
                  <Text style={styles.helper}>Only the owner can override a reserved item.</Text>
                )}
                <TouchableOpacity style={styles.linkButton} onPress={reset}>
                  <Text style={styles.linkButtonText}>Scan Again</Text>
                </TouchableOpacity>
              </Card>
            ) : sellResult ? (
              <View style={styles.soldPanel}>
                <Ionicons name="checkmark-circle" size={46} color={colors.success} />
                <Text style={styles.soldHeading}>
                  {sellResult.channel === 'whatsapp'
                    ? 'WhatsApp order created'
                    : sellResult.overridden
                      ? 'Sold (override recorded)'
                      : 'Sold'}
                </Text>
                <Text style={styles.soldMeta}>
                  Order {sellResult.orderNumber}
                  {sellResult.invoice ? ` · Invoice ${sellResult.invoice.invoiceNumber}` : ''}
                </Text>
                {sellResult.invoice && (
                  <Text style={styles.soldAmount}>₹{sellResult.invoice.totalAmount}</Text>
                )}
                {sellResult.channel === 'whatsapp' && (
                  <Text style={styles.soldMeta}>
                    It's in To Ship now — add the DTDC AWB there to send {customer.fullName || 'the customer'} their
                    tracking update and invoice.
                  </Text>
                )}

                {shareError ? <Text style={styles.error}>{shareError}</Text> : null}

                {busySharing ? (
                  <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
                ) : sellResult.invoice ? (
                  <View style={styles.soldActions}>
                    <Button title="Print Invoice" onPress={() => handleShareInvoice('print')} />
                    <Button
                      title="Share Invoice"
                      onPress={() => handleShareInvoice('share')}
                      variant="secondary"
                      style={styles.soldSecondAction}
                    />
                  </View>
                ) : (
                  // The sale itself still went through — only the PDF didn't.
                  <Text style={styles.helper}>
                    Invoice couldn’t be generated just now. Find it under Invoices once it’s ready.
                  </Text>
                )}

                <TouchableOpacity style={styles.scanNextButton} onPress={reset} activeOpacity={0.85}>
                  <Text style={styles.scanNextText}>Scan Next</Text>
                </TouchableOpacity>
              </View>
            ) : lookup ? (
              <Card style={styles.resultCard}>
                <Text style={styles.skuLine}>{lookup.sku || lookup.barcode}</Text>
                <Text style={styles.productName}>{lookup.productName}</Text>
                <Text style={styles.categoryLine}>{lookup.categoryName}</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.priceValue}>₹{lookup.storePrice}</Text>
                  <Badge label={STATUS_LABEL[lookup.status] || lookup.status} tone={STATUS_TONE[lookup.status] || 'neutral'} />
                </View>

                {mode === 'sell' && lookup.status === 'in_stock' && (
                  <>
                    <Text style={styles.label}>Selling price (optional — leave blank to use store price)</Text>
                    <TextInput
                      style={styles.salePriceInput}
                      placeholder={`₹${lookup.storePrice}`}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={salePriceInput}
                      onChangeText={setSalePriceInput}
                    />

                    <Text style={styles.label}>Where is this sale happening?</Text>
                    <SegmentedControl options={SALE_CHANNEL_OPTIONS} value={saleChannel} onChange={setSaleChannel} />

                    {saleChannel === 'whatsapp' && (
                      <View style={styles.customerForm}>
                        <Text style={styles.helper}>
                          A WhatsApp order still has to be packed and couriered — it goes into To Ship, and the
                          shipment update and invoice are sent to this number once you add the AWB.
                        </Text>
                        <TextInput
                          style={styles.customerInput}
                          placeholder="Customer name *"
                          placeholderTextColor={colors.textMuted}
                          value={customer.fullName}
                          onChangeText={(v) => updateCustomer('fullName', v)}
                        />
                        <TextInput
                          style={styles.customerInput}
                          placeholder="Mobile number *"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="phone-pad"
                          value={customer.phone}
                          onChangeText={(v) => updateCustomer('phone', v)}
                        />
                        <TextInput
                          style={styles.customerInput}
                          placeholder="Address line 1 *"
                          placeholderTextColor={colors.textMuted}
                          value={customer.line1}
                          onChangeText={(v) => updateCustomer('line1', v)}
                        />
                        <TextInput
                          style={styles.customerInput}
                          placeholder="Address line 2 (optional)"
                          placeholderTextColor={colors.textMuted}
                          value={customer.line2}
                          onChangeText={(v) => updateCustomer('line2', v)}
                        />
                        <View style={styles.customerRow}>
                          <TextInput
                            style={[styles.customerInput, styles.customerRowInput]}
                            placeholder="City *"
                            placeholderTextColor={colors.textMuted}
                            value={customer.city}
                            onChangeText={(v) => updateCustomer('city', v)}
                          />
                          <TextInput
                            style={[styles.customerInput, styles.customerRowInput]}
                            placeholder="State *"
                            placeholderTextColor={colors.textMuted}
                            value={customer.state}
                            onChangeText={(v) => updateCustomer('state', v)}
                          />
                        </View>
                        <TextInput
                          style={styles.customerInput}
                          placeholder="Pincode *"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="number-pad"
                          value={customer.pincode}
                          onChangeText={(v) => updateCustomer('pincode', v)}
                        />
                        <TextInput
                          style={styles.customerInput}
                          placeholder="Notes (optional)"
                          placeholderTextColor={colors.textMuted}
                          value={customer.notes}
                          onChangeText={(v) => updateCustomer('notes', v)}
                        />
                      </View>
                    )}

                    <Button
                      title={saleChannel === 'whatsapp' ? 'Create WhatsApp Order' : 'Mark Sold in Store'}
                      onPress={confirmSale}
                      style={styles.markSoldButton}
                    />
                    {saleChannel === 'store' && (
                      <TouchableOpacity style={styles.whatsappButton} onPress={sellViaWhatsApp} activeOpacity={0.85}>
                        <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
                        <Text style={styles.whatsappButtonText}>Just share this item on WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {mode === 'sell' && lookup.mode === 'quantity' && (lookup.availableQty ?? 0) <= 0 && (
                  <Text style={styles.helper}>No stock available to sell.</Text>
                )}

                <TouchableOpacity style={styles.linkButton} onPress={reset}>
                  <Text style={styles.linkButtonText}>Scan Again</Text>
                </TouchableOpacity>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl },
  cameraWrap: {
    height: 270,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  viewfinderWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  viewfinder: {
    width: 210,
    height: 140,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  permissionPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  permissionText: { ...typography.bodySm, color: '#fff', textAlign: 'center' },
  permissionButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  permissionButtonText: { ...typography.button, color: colors.text },
  manualPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 3,
    ...shadow.card,
  },
  manualInput: { ...typography.bodyMedium, color: colors.text, padding: 0 },
  resultCard: { marginTop: spacing.sm },
  skuLine: { ...typography.caption, color: colors.textLabel },
  productName: { ...typography.amount, color: colors.text, marginTop: spacing.sm },
  categoryLine: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.xs + 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  priceValue: { ...typography.display, color: colors.primary },
  label: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  salePriceInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 3,
    ...typography.body,
    color: colors.text,
  },
  helper: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.sm },
  customerForm: { marginTop: spacing.md, gap: spacing.sm },
  customerInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 1,
    ...typography.body,
    color: colors.text,
  },
  customerRow: { flexDirection: 'row', gap: spacing.sm },
  customerRowInput: { flex: 1 },
  overrideButton: { marginTop: spacing.lg },
  markSoldButton: { marginTop: spacing.md },
  whatsappButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.successBg, borderRadius: radius.pill,
    paddingVertical: spacing.md + 1, marginTop: spacing.sm + 2,
  },
  whatsappButtonText: { ...typography.bodySemibold, color: colors.success },
  linkButton: { marginTop: spacing.md + 2, alignItems: 'center' },
  linkButtonText: { ...typography.bodySmSemibold, color: colors.textMuted },
  error: {
    ...typography.bodySmSemibold,
    color: colors.error,
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  soldPanel: {
    marginTop: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.xxl,
    padding: spacing.xl + 6,
    alignItems: 'center',
  },
  soldHeading: { ...typography.display, color: colors.success, marginTop: spacing.md },
  soldMeta: { ...typography.bodyMedium, color: colors.success, marginTop: spacing.sm, textAlign: 'center' },
  soldAmount: { ...typography.display, color: colors.text, marginTop: spacing.xs },
  soldActions: { alignSelf: 'stretch', marginTop: spacing.lg },
  soldSecondAction: { marginTop: spacing.sm },
  scanNextButton: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 3,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  scanNextText: { ...typography.button, color: '#fff' },
});
