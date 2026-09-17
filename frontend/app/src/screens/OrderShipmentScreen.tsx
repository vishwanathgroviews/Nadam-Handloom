import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getAdminOrder, markOrderShipped, AdminOrderDetail, MarkShippedResult } from '../api/admin';
import { colors, radius, spacing, typography } from '../utils/theme';
import { openWhatsAppChat } from '../utils/whatsapp';
import { savePdfBytes, sharePdf } from '../utils/pdf';
import { DTDC_TRACKING_URL } from '../utils/constants';
import { buildShipmentMessage as composeShipmentMessage, dedupeProductLinks } from '../utils/shipmentMessage';
import { formatShipTo } from '../utils/shipTo';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import BarcodeScanModal from '../components/BarcodeScanModal';
import { normalizeBarcode } from '../utils/barcode';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AppStackParamList, 'OrderShipment'>;

const formatRupees = (amount: string | number): string => `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`;
export default function OrderShipmentScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [awbNumber, setAwbNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MarkShippedResult | null>(null);
  const [sharingInvoice, setSharingInvoice] = useState(false);
  const [awbScannerVisible, setAwbScannerVisible] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await getAdminOrder(accessToken, orderId);
      setOrder(res.data);
      if (res.data.shipment?.awbNumber) setAwbNumber(res.data.shipment.awbNumber);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const awbFieldHolds = awbNumber.trim().length > 0;

  // One scan fills the field and closes the camera — there is exactly one
  // AWB per parcel, so there is nothing to keep scanning for.
  const handleAwbScanned = useCallback((code: string) => {
    const cleaned = normalizeBarcode(code);
    if (!cleaned) return;
    setAwbNumber(cleaned);
    setScanStatus(`Scanned ${cleaned}`);
    setAwbScannerVisible(false);
    setError('');
  }, []);

  const handleMarkShipped = async () => {
    if (!accessToken) return;
    setError('');
    if (awbNumber.trim().length < 4) {
      setError('Enter a valid DTDC AWB number');
      return;
    }
    setSubmitting(true);
    try {
      const res = await markOrderShipped(accessToken, orderId, awbNumber.trim());
      setResult(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to mark order as shipped');
    } finally {
      setSubmitting(false);
    }
  };

  // Online orders carry a linked Address row; store and WhatsApp orders only
  // ever have the snapshot written onto the order itself, so fall back to it
  // — otherwise a WhatsApp order would show no delivery details at all.
  const shipTo = order
    ? order.address ?? {
        fullName: order.shippingAddress?.fullName ?? '',
        phone: order.shippingAddress?.phone ?? '',
        line1: order.shippingAddress?.line1 ?? '',
        line2: order.shippingAddress?.line2 ?? null,
        city: order.shippingAddress?.city ?? '',
        state: order.shippingAddress?.state ?? '',
        pincode: order.shippingAddress?.pincode ?? '',
      }
    : null;
  const hasShipTo = Boolean(shipTo?.fullName || shipTo?.line1 || shipTo?.phone);

  const handleCall = () => {
    if (shipTo?.phone) Linking.openURL(`tel:${shipTo.phone}`);
  };

  // No clipboard module is bundled with this app — the native share sheet
  // is the closest built-in way to hand the address off (it includes a
  // "Copy" action on iOS/Android) without adding a new dependency.
  const handleCopyAddress = () => {
    if (!shipTo) return;
    const message = [formatShipTo(shipTo), shipTo.phone ? `Phone: ${shipTo.phone}` : '']
      .filter(Boolean)
      .join('\n');
    Share.share({ message }).catch(() => {});
  };

  const invoiceUrl = result?.invoiceUrl ?? order?.invoice?.url ?? null;
  // Set once the AWB has actually been saved — either just now, or on a
  // previous visit to this screen.
  const savedAwb = result?.awbNumber ?? order?.shipment?.awbNumber ?? null;

  // Links back to what the customer actually bought. mark-shipped returns
  // these directly; before that, the order detail carries the same URL on
  // each item. Deduped, because two units of one product are one link.
  const productLinks = useMemo(
    () =>
      dedupeProductLinks(
        result?.productLinks?.length
          ? result.productLinks
          : (order?.items ?? [])
              .filter((item) => item.productUrl)
              .map((item) => ({ name: item.nameSnapshot, url: item.productUrl as string }))
      ),
    [result, order]
  );

  // Composed by utils/shipmentMessage.ts (unit-tested there) — the order
  // number, the DTDC tracking number and where to enter it, and a link to
  // each product page. The invoice goes as the PDF file itself, not a link.
  const buildShipmentMessage = useCallback(() => {
    if (!order) return '';
    return composeShipmentMessage({
      customerName: shipTo?.fullName ?? null,
      orderNumber: order.orderNumber,
      awbNumber: result?.awbNumber ?? order.shipment?.awbNumber ?? null,
      carrier: result?.carrier ?? order.shipment?.carrier ?? null,
      trackingUrl: result?.trackingUrl || DTDC_TRACKING_URL,
      productLinks,
    });
  }, [order, shipTo, result, productLinks, invoiceUrl]);

  // Downloads the invoice and writes it to the cache, ready to hand to a
  // share sheet. Returns null (having set an error) if there is nothing to
  // send, so callers can decide whether to carry on without it.
  const prepareInvoiceFile = useCallback(async (): Promise<string | null> => {
    if (!invoiceUrl) {
      setError('No invoice has been generated for this order yet.');
      return null;
    }
    const res = await fetch(invoiceUrl);
    if (!res.ok) throw new Error('Could not download the invoice PDF');
    const bytes = new Uint8Array(await res.arrayBuffer());
    const label = result?.invoiceNumber ?? order?.invoice?.invoiceNumber ?? order?.orderNumber ?? 'invoice';
    return savePdfBytes(bytes, `${label}.pdf`);
  }, [invoiceUrl, result, order]);

  const handleShareInvoice = useCallback(async () => {
    setSharingInvoice(true);
    setError('');
    try {
      const uri = await prepareInvoiceFile();
      if (uri) await sharePdf(uri);
    } catch (err: any) {
      setError(err.message || 'Could not share the invoice');
    } finally {
      setSharingInvoice(false);
    }
  }, [prepareInvoiceFile]);

  // Details only: opens the customer's chat with the tracking message and
  // the product links. Kept apart from the invoice because trying to push a
  // file and text through one hand-off does not reliably deliver both —
  // WhatsApp's URL scheme carries no attachment, and Android's share sheet
  // carries no text beside one.
  const handleShareDetails = useCallback(() => {
    if (!order) return;
    setError('');
    openWhatsAppChat(shipTo?.phone ?? result?.customerPhone ?? null, buildShipmentMessage());
  }, [order, shipTo, result, buildShipmentMessage]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Order" />
        <Text style={styles.error}>{error || 'Order not found'}</Text>
      </View>
    );
  }

  const alreadyShipped = order.shipment?.status && order.shipment.status !== 'not_shipped';

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={order.orderNumber}
          subtitle={`${order.authAccount?.phone || order.authAccount?.email || 'Customer'} · ${order.items.length} item${order.items.length !== 1 ? 's' : ''}`}
        />

      <Card style={styles.card}>
        <Text style={styles.cardLabel}>Items</Text>
        {/* Every line opens the product it was sold from — staff packing a
            parcel need the full listing (photos, SKU, barcode, stock) and
            were otherwise left retyping the name into the Products search. */}
        {order.items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.itemRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProductForm', { productId: item.productId })}
            accessibilityRole="button"
            accessibilityLabel={`View product details for ${item.nameSnapshot}`}
          >
            {item.imageSnapshot ? (
              <Image source={{ uri: item.imageSnapshot }} style={styles.itemThumb} />
            ) : (
              <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                <Ionicons name="image-outline" size={18} color={colors.iconMuted} />
              </View>
            )}
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName} numberOfLines={2}>{item.nameSnapshot}</Text>
              <Text style={styles.itemViewHint}>View product</Text>
            </View>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.iconMuted} />
          </TouchableOpacity>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Order total</Text>
          <Text style={styles.totalValue}>{formatRupees(order.total)}</Text>
        </View>
      </Card>

      {hasShipTo && shipTo && (
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Ship To</Text>
          <Text style={styles.addressText}>
            {shipTo.fullName}{'\n'}
            {shipTo.line1}{shipTo.line2 ? `, ${shipTo.line2}` : ''}{'\n'}
            {shipTo.city}, {shipTo.state} - {shipTo.pincode}
          </Text>
          {order.channel === 'whatsapp' && order.shippingAddress?.notes ? (
            <Text style={styles.orderNotes}>Note: {order.shippingAddress.notes}</Text>
          ) : null}
          <View style={styles.shipButtonsRow}>
            <Button title="Call" variant="secondary" onPress={handleCall} style={styles.shipButton} />
            <Button title="Copy address" variant="secondary" onPress={handleCopyAddress} style={styles.shipButton} />
          </View>
          {/* There is nothing to tell the customer until the parcel has a
              tracking number, so these appear only once the AWB is saved. */}
          {savedAwb ? (
            <>
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={handleShareDetails}
                activeOpacity={0.85}
              >
                <Ionicons name="logo-whatsapp" size={17} color={colors.success} />
                <Text style={styles.whatsappButtonText}>Share details on WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={handleShareInvoice}
                activeOpacity={0.85}
                disabled={sharingInvoice}
              >
                <Ionicons name="document-text-outline" size={17} color={colors.primary} />
                <Text style={styles.invoiceButtonText}>
                  {sharingInvoice ? 'Preparing invoice…' : 'Share invoice PDF'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.whatsappHint}>
                Two separate sends: the tracking message and product link{productLinks.length > 1 ? 's' : ''} first,
                then the invoice file into the same chat.
              </Text>
            </>
          ) : (
            <Text style={styles.whatsappHint}>
              Save the DTDC tracking number below to message the customer and share their invoice.
            </Text>
          )}
        </Card>
      )}

      {result ? (
        <View style={styles.successPanel}>
          <Ionicons name="checkmark-circle" size={38} color={colors.success} />
          <Text style={styles.successTitle}>On its way</Text>
          <Text style={styles.successMeta}>{result.carrier} · Tracking ID (AWB) {result.awbNumber}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(result.trackingUrl)} activeOpacity={0.7}>
            <Text style={styles.trackingLink}>Open tracking →</Text>
          </TouchableOpacity>

          {/* The whole point of a WhatsApp order: the buyer gets the tracking
              message and their invoice on the number they ordered from. */}
          <TouchableOpacity style={styles.successWhatsapp} onPress={handleShareDetails} activeOpacity={0.85}>
            <Ionicons name="logo-whatsapp" size={17} color="#fff" />
            <Text style={styles.successWhatsappText}>Share details on WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareInvoice} activeOpacity={0.7} disabled={sharingInvoice}>
            <Text style={styles.trackingLink}>
              {sharingInvoice ? 'Preparing invoice…' : 'Share invoice PDF'}
            </Text>
          </TouchableOpacity>
          {error ? <Text style={styles.successError}>{error}</Text> : null}
        </View>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>DTDC Shipment</Text>
          {alreadyShipped && (
            <Text style={styles.notice}>
              This order is already marked "{order.shipment?.status}". Entering a new AWB will update it.
            </Text>
          )}
          {/* The AWB is printed as a barcode on every DTDC label, so it is
              scanned the same way a product tag is (BarcodeScanModal in
              'assign' mode hands back the raw code rather than looking it up
              in the catalog). Typing it stays available for a smudged label. */}
          <View style={styles.awbRow}>
            <TextInput
              style={[styles.input, styles.awbInput]}
              placeholder="Scan or type AWB"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              value={awbNumber}
              onChangeText={setAwbNumber}
            />
            {/* Shut while the field already holds an AWB: a parcel has exactly
                one, so scanning a second label could only overwrite the one on
                screen without the person noticing. Clear it to scan again. */}
            <TouchableOpacity
              style={[styles.awbScanButton, awbFieldHolds && styles.awbScanButtonDisabled]}
              onPress={() => { setError(''); setAwbScannerVisible(true); }}
              activeOpacity={0.8}
              disabled={awbFieldHolds}
              accessibilityRole="button"
              accessibilityState={{ disabled: awbFieldHolds }}
              accessibilityLabel="Scan the DTDC shipment barcode"
            >
              <Ionicons name="barcode-outline" size={20} color={awbFieldHolds ? colors.iconMuted : colors.primary} />
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Mark as Shipped" onPress={handleMarkShipped} loading={submitting} style={styles.submitButton} />
        </Card>
      )}
      </ScrollView>

      <BarcodeScanModal
        visible={awbScannerVisible}
        accessToken={accessToken}
        mode="assign"
        onScanned={handleAwbScanned}
        statusText={scanStatus}
        suspendedMessage={
          awbFieldHolds
            ? `AWB ${awbNumber.trim()} is already entered. Clear the field to scan a different one.`
            : null
        }
        onClose={() => setAwbScannerVisible(false)}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  card: {
    marginBottom: spacing.md,
  },
  cardLabel: { ...typography.caption, color: colors.textLabel },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md + 2 },
  itemThumb: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.placeholderBg },
  itemThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemTextWrap: { flex: 1, minWidth: 0 },
  itemName: { ...typography.body, fontSize: 14, color: colors.text },
  itemViewHint: { ...typography.bodySm, fontSize: 11, color: colors.primary, marginTop: 2 },
  itemQty: { ...typography.bodySm, color: colors.textLabel },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg + 2,
    paddingTop: spacing.md + 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  totalLabel: { ...typography.bodySm, color: colors.textMuted },
  totalValue: { ...typography.amount, color: colors.text },
  whatsappHint: { ...typography.bodySm, fontSize: 11.5, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  addressText: { ...typography.body, fontSize: 14, lineHeight: 24, color: colors.text, marginTop: spacing.md - 2 },
  shipButtonsRow: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.lg },
  shipButton: { flex: 1 },
  whatsappButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.successBg, borderRadius: radius.pill,
    paddingVertical: spacing.md + 1, marginTop: spacing.sm + 2,
  },
  whatsappButtonText: { ...typography.bodySemibold, color: colors.success },
  invoiceButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primaryBg, borderRadius: radius.pill,
    paddingVertical: spacing.md + 1, marginTop: spacing.sm,
  },
  invoiceButtonText: { ...typography.bodySemibold, color: colors.primary },
  orderNotes: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.sm },
  successWhatsapp: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.success, borderRadius: radius.pill,
    paddingVertical: spacing.md + 1, paddingHorizontal: spacing.xl,
    marginTop: spacing.lg, alignSelf: 'stretch',
  },
  successWhatsappText: { ...typography.bodySemibold, color: '#fff' },
  successError: { ...typography.bodySm, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  successPanel: {
    backgroundColor: colors.successBg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: { ...typography.h1, color: colors.success, marginTop: spacing.sm + 2 },
  successMeta: { ...typography.bodySm, color: colors.success, marginTop: 6, textAlign: 'center' },
  trackingLink: { ...typography.bodySmSemibold, color: colors.primary, marginTop: spacing.md + 2 },
  notice: { ...typography.bodySm, color: colors.warning, marginBottom: spacing.sm + 2 },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 3,
    backgroundColor: colors.inputBg,
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  submitButton: { marginTop: spacing.xs },
  awbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  awbInput: { flex: 1 },
  awbScanButtonDisabled: { opacity: 0.45 },
  awbScanButton: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, marginBottom: spacing.md,
  },
  error: {
    ...typography.bodySm,
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});
