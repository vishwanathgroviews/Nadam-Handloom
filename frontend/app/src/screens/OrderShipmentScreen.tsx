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
import { shareInvoiceWithMessage } from '../utils/shareInvoice';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
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
    const { fullName, line1, line2, city, state, pincode, phone } = shipTo;
    const message = `${fullName}\n${line1}${line2 ? `, ${line2}` : ''}\n${city}, ${state} - ${pincode}\nPhone: ${phone}`;
    Share.share({ message }).catch(() => {});
  };

  const invoiceUrl = result?.invoiceUrl ?? order?.invoice?.url ?? null;

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

  // The one WhatsApp action. The PDF is fetched first so a download failure
  // surfaces here rather than halfway through a share, then the message and
  // the file go out together — see utils/shareInvoice.ts for what "together"
  // means on each platform. With no invoice yet, the message still sends.
  const handleWhatsApp = useCallback(async () => {
    if (!order) return;
    setSharingInvoice(true);
    setError('');
    const phone = shipTo?.phone ?? result?.customerPhone ?? null;
    const message = buildShipmentMessage();
    try {
      if (!invoiceUrl) {
        openWhatsAppChat(phone, message);
        return;
      }
      const uri = await prepareInvoiceFile();
      if (!uri) return;
      await shareInvoiceWithMessage({ fileUri: uri, message, phone });
    } catch (err: any) {
      setError(err.message || 'Could not send the update on WhatsApp');
    } finally {
      setSharingInvoice(false);
    }
  }, [order, shipTo, result, buildShipmentMessage, invoiceUrl, prepareInvoiceFile]);

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
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {item.imageSnapshot ? (
              <Image source={{ uri: item.imageSnapshot }} style={styles.itemThumb} />
            ) : (
              <View style={[styles.itemThumb, styles.itemThumbEmpty]}>
                <Ionicons name="image-outline" size={18} color={colors.iconMuted} />
              </View>
            )}
            <Text style={styles.itemName} numberOfLines={2}>{item.nameSnapshot}</Text>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
          </View>
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
          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={handleWhatsApp}
            activeOpacity={0.85}
            disabled={sharingInvoice}
          >
            <Ionicons name="logo-whatsapp" size={17} color={colors.success} />
            <Text style={styles.whatsappButtonText}>
              {sharingInvoice ? 'Preparing…' : 'Send on WhatsApp'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.whatsappHint}>
            Sends tracking and the product page link{productLinks.length > 1 ? 's' : ''}, then attaches the invoice PDF.
          </Text>
          <TouchableOpacity
            style={styles.invoiceButton}
            onPress={handleShareInvoice}
            activeOpacity={0.85}
            disabled={sharingInvoice}
          >
            <Ionicons name="document-text-outline" size={17} color={colors.primary} />
            <Text style={styles.invoiceButtonText}>
              {sharingInvoice ? 'Preparing invoice…' : 'Share Invoice PDF'}
            </Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.successWhatsapp} onPress={handleWhatsApp} activeOpacity={0.85} disabled={sharingInvoice}>
            <Ionicons name="logo-whatsapp" size={17} color="#fff" />
            <Text style={styles.successWhatsappText}>
              {sharingInvoice ? 'Preparing…' : 'Send Update + Invoice'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShareInvoice} activeOpacity={0.7} disabled={sharingInvoice}>
            <Text style={styles.trackingLink}>Share invoice only</Text>
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
          <TextInput
            style={styles.input}
            placeholder="Scan or type AWB"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            value={awbNumber}
            onChangeText={setAwbNumber}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Mark as Shipped" onPress={handleMarkShipped} loading={submitting} style={styles.submitButton} />
        </Card>
      )}
      </ScrollView>
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
  itemName: { ...typography.body, fontSize: 14, color: colors.text, flex: 1 },
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
  error: {
    ...typography.bodySm,
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});
