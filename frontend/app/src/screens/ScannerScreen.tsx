import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { AppStackParamList, RootTabParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import {
  scanLookup,
  scanSell,
  ScanLookupResult,
  ScanSellResult,
  ScanSellItemInput,
  WhatsappCustomerInput,
} from '../api/inventory';
import { useIsOnline } from '../utils/network';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import CameraScanner from '../components/CameraScanner';
import OfflineBanner from '../components/OfflineBanner';
import { savePdfBytes, printPdf, sharePdf } from '../utils/pdf';
import { colors, radius, shadow, spacing, typography } from '../utils/theme';
import { openWhatsAppChat } from '../utils/whatsapp';
import { cleanMobile, invoiceCaption } from '../utils/invoiceShare';
import {
  addLine,
  billItemCount,
  billTotal as sumBill,
  findLine,
  lineTotal,
  lineUnitPrice,
  toSellItems,
  BillLine,
} from '../utils/bill';
import { sendPdfToWhatsAppChat, WhatsAppNotInstalledError } from '../utils/whatsappPdf';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge, SegmentedControl } from '../components/ui/Chip';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, 'ScannerTab'>,
  NativeStackScreenProps<AppStackParamList>
>;

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

// Whether the customer wants a GST invoice. "Not required" still records the
// whole sale (stock, order, analytics) — it just never becomes an invoice,
// so it stays out of the invoice list and the sales-summary PDF.
type InvoiceChoice = 'required' | 'not_required';
const INVOICE_OPTIONS: { key: InvoiceChoice; label: string }[] = [
  { key: 'required', label: 'Invoice Required' },
  { key: 'not_required', label: 'Invoice Not Required' },
];

/** A scanned product that can go straight onto the bill. */
const isSellable = (lookup: ScanLookupResult) =>
  lookup.status === 'in_stock' && (lookup.mode !== 'quantity' || (lookup.availableQty ?? 0) > 0);

// Two fields, not eight: these orders are taken down mid-chat, and the
// customer has usually already sent their address as one block of text.
// Splitting it across name/line/city/state/pincode boxes meant retyping it
// piece by piece, and the courier label only needs the block back anyway.
const EMPTY_CUSTOMER = {
  phone: '',
  address: '',
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
  const tabBarHeight = useBottomTabBarHeight();
  const isOnline = useIsOnline();
  const [mode, setMode] = useState<Mode>('sell');
  const [phase, setPhase] = useState<Phase>('scanning');
  const [manualCode, setManualCode] = useState('');
  const [lookup, setLookup] = useState<ScanLookupResult | null>(null);
  const [sellResult, setSellResult] = useState<ScanSellResult | null>(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [scannedLock, setScannedLock] = useState(false);
  const [salePriceInput, setSalePriceInput] = useState('');
  // The bill being built. "Add More" sends staff back to the camera with
  // these lines intact, and Complete Sale turns the whole list into ONE
  // order with ONE invoice.
  const [bill, setBill] = useState<BillLine[]>([]);
  // No default. Pre-selecting Offline Store meant a WhatsApp order rung up
  // without anyone touching the selector was closed out as a counter sale and
  // never reached To Ship. Staff have to choose, every sale — the server
  // enforces the same rule (inventory.schema.ts).
  const [saleChannel, setSaleChannel] = useState<SaleChannel | null>(null);
  const [channelMissing, setChannelMissing] = useState(false);
  // No default either, for the same reason: staff must say on every bill
  // whether the customer wants an invoice.
  const [invoiceChoice, setInvoiceChoice] = useState<InvoiceChoice | null>(null);
  const [invoiceChoiceMissing, setInvoiceChoiceMissing] = useState(false);
  // A counter customer's mobile, typed only so their invoice can be sent to
  // them on WhatsApp. It stays in this screen's memory: it is never sent to
  // the server (runSell has no field for it on a store sale, and the server
  // drops customer details on store sales anyway), never written to the
  // phone's storage, and is cleared when the next sale starts.
  const [invoiceMobile, setInvoiceMobile] = useState('');
  const [invoiceMobileError, setInvoiceMobileError] = useState('');
  // Only used for a WhatsApp sale — it's a remote order, so it can't be
  // completed without somewhere to send the parcel.
  const [customer, setCustomer] = useState({ ...EMPTY_CUSTOMER });
  const [busySharing, setBusySharing] = useState(false);
  // Kept apart from `error`: that one means "the scan/sale failed" and takes
  // over the whole result area. A print/share problem happens after the sale
  // is already done, so it has to show inside the Sold panel instead of
  // replacing it with something that reads like the sale didn't go through.
  const [shareError, setShareError] = useState('');
  // Said quietly under the camera — "that tag is already on the bill" is
  // something to know, not a failure that should clear anything away.
  const [scanNotice, setScanNotice] = useState('');
  // "Add More" put the camera back on screen but left the page scrolled
  // where the bill had been, so staff were looking at empty space below a
  // camera they could not see and nothing seemed to happen. Every step of
  // the sale now starts at the top of the screen.
  const scrollRef = useRef<ScrollView>(null);
  // Read by runLookup, which adds a scanned product to the bill the moment
  // it's found — the latest bill, not the one from when the callback was made.
  const billRef = useRef<BillLine[]>([]);
  billRef.current = bill;

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
    setBill([]);
    setSaleChannel(null);
    setChannelMissing(false);
    setInvoiceChoice(null);
    setInvoiceChoiceMissing(false);
    setInvoiceMobile('');
    setInvoiceMobileError('');
    setScanNotice('');
    setCustomer({ ...EMPTY_CUSTOMER });
  }, []);

  // Back to the camera with the bill kept — the "Add More" path.
  const scanAnother = useCallback(() => {
    setPhase('scanning');
    setLookup(null);
    setError('');
    setErrorCode('');
    setManualCode('');
    setScannedLock(false);
    setSalePriceInput('');
    setScanNotice('');
  }, []);

  // Out of the camera (or out of an error) and back to the bill, with every
  // line still on it. Nothing here clears the bill — only Scan Next, after a
  // completed sale, does that.
  const backToBill = useCallback(() => {
    setPhase('result');
    setLookup(null);
    setError('');
    setErrorCode('');
    setScannedLock(false);
    setSalePriceInput('');
    setScanNotice('');
  }, []);

  const billTotal = useMemo(() => sumBill(bill), [bill]);
  const itemCount = useMemo(() => billItemCount(bill), [bill]);

  const updateLinePrice = useCallback((code: string, value: string) => {
    setBill((prev) => prev.map((line) => (line.code === code ? { ...line, priceInput: value } : line)));
  }, []);

  const removeLine = useCallback((code: string) => {
    setBill((prev) => prev.filter((line) => line.code !== code));
  }, []);

  const updateCustomer = useCallback(
    (field: keyof typeof EMPTY_CUSTOMER, value: string) =>
      setCustomer((prev) => ({ ...prev, [field]: value })),
    []
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [phase, bill.length]);

  // Scan to Sell is one step: a product that can be sold goes straight onto
  // the bill, with its selling price filled in and editable there. Only a
  // product that can't be sold (already sold, reserved online, damaged…)
  // stops on a card that says why.
  const addLookupToBill = useCallback((found: ScanLookupResult) => {
    const code = found.barcode || found.sku;
    if (!code) return;
    const { bill: next, outcome } = addLine(billRef.current, {
      code,
      productName: found.productName,
      categoryName: found.categoryName,
      storePrice: String(found.storePrice),
      // Filled in with the store price so the selling price is visible on
      // the bill — staff overwrite it there if they agree a different one.
      priceInput: String(found.storePrice),
      // A barcoded piece is one physical saree; a quantity product can go on
      // the same line more than once.
      serialized: found.mode !== 'quantity',
    });
    billRef.current = next;
    setBill(next);
    setScanNotice(
      outcome === 'duplicate'
        ? `${found.productName} is already on this bill.`
        : outcome === 'quantity'
          ? `${found.productName} — now ${findLine(next, code)?.quantity} on the bill.`
          : `Added ${found.productName}.`
    );
    setLookup(null);
    setError('');
    setErrorCode('');
    setManualCode('');
    setSalePriceInput('');
    setScannedLock(false);
    setPhase('result');
  }, []);

  const runLookup = useCallback(
    async (code: string) => {
      if (!accessToken) return;
      setPhase('processing');
      setError('');
      try {
        const res = await scanLookup(accessToken, code);
        if (mode === 'sell' && isSellable(res.data)) {
          addLookupToBill(res.data);
          return;
        }
        setLookup(res.data);
        setPhase('result');
      } catch (err: any) {
        setError(err.message || 'No product found for this code');
        setPhase('result');
      }
    },
    [accessToken, mode, addLookupToBill]
  );

  const runSell = useCallback(
    async (lines: BillLine[], override = false) => {
      if (!accessToken) return;
      if (lines.length === 0) {
        setError('Add at least one product to the bill first.');
        setPhase('result');
        return;
      }

      // Checked here, before anything is sent, and shown next to the selector
      // rather than as a result-screen error: the bill has to stay on screen
      // so the choice can simply be made and the sale completed.
      if (!saleChannel || !invoiceChoice) {
        setChannelMissing(!saleChannel);
        setInvoiceChoiceMissing(!invoiceChoice);
        return;
      }

      // A WhatsApp order is going to be couriered, so it can't be recorded
      // without a number to message and an address to ship to.
      let customerPayload: WhatsappCustomerInput | undefined;
      if (saleChannel === 'whatsapp') {
        if (!customer.phone.trim() || customer.address.trim().length < 5) {
          setError("Enter the customer's mobile number and full delivery address first.");
          setPhase('result');
          return;
        }
        customerPayload = {
          phone: customer.phone.trim(),
          address: customer.address.trim(),
        };
      }

      setPhase('processing');
      setError('');
      setErrorCode('');
      // Every line of the bill goes in one request — the server claims them
      // all in a single transaction and writes ONE order with ONE invoice
      // (inventory.service.ts). Prices and quantities come from the bill as
      // staff last edited them.
      const items: ScanSellItemInput[] = toSellItems(lines, override);

      try {
        const res = await scanSell(accessToken, items, {
          channel: saleChannel,
          invoiceRequired: invoiceChoice === 'required',
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
    [accessToken, saleChannel, invoiceChoice, customer]
  );

  // Same print/share path the Invoices screen uses —
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

  // One tap: opens the customer's WhatsApp chat with the invoice PDF already
  // attached (staff press WhatsApp's own Send). The number goes only to
  // WhatsApp on this phone — never to the server.
  const shareInvoiceOnWhatsApp = useCallback(async () => {
    const invoice = sellResult?.invoice;
    if (!invoice) return;
    const mobile = cleanMobile(invoiceMobile);
    if (!mobile) {
      setInvoiceMobileError("Enter the customer's 10-digit mobile number.");
      return;
    }
    setInvoiceMobileError('');
    setShareError('');
    setBusySharing(true);
    try {
      const res = await fetch(invoice.url);
      if (!res.ok) throw new Error('Could not download the invoice PDF');
      const bytes = new Uint8Array(await res.arrayBuffer());
      const filename = `${invoice.invoiceNumber}.pdf`;
      const uri = savePdfBytes(bytes, filename);
      try {
        await sendPdfToWhatsAppChat(uri, mobile, filename, invoiceCaption(invoice));
      } catch (err) {
        if (!(err instanceof WhatsAppNotInstalledError)) throw err;
        // No WhatsApp on this phone: still get the PDF out, via the share menu.
        setShareError('WhatsApp is not installed on this phone — choose another app to send the invoice.');
        await sharePdf(uri);
      }
    } catch (err: any) {
      setShareError(err?.message || 'Could not share the invoice');
    } finally {
      setBusySharing(false);
    }
  }, [sellResult, invoiceMobile]);

  // Puts the product just scanned onto the bill, carrying over whatever
  // price was typed on the confirm step, and stays on the bill. It
  // deliberately does NOT reopen the camera: re-arming the scanner meant the
  // item you just added scrolled out of view behind a live viewfinder, and
  // the same label still sitting under the lens got picked up again. Staff
  // choose what happens next from the bill itself — "Add More" goes back to
  // the camera, "Complete Sale" finishes.
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

  // CameraScanner only calls this once several frames have agreed on the same
  // value, so what arrives here is a confirmed, canonical code rather than one
  // frame's guess. The lock still guards against a second confirmation landing
  // while the first lookup is in flight.
  const handleBarcodeScanned = useCallback(
    (code: string) => {
      if (scannedLock || phase !== 'scanning') return;
      // The tag just added is usually still under the camera when it
      // re-arms. Reading it again is not a mistake worth stopping for: the
      // camera stays live, says so, and waits for the next tag. (A product
      // counted by quantity does go through, since scanning it again really
      // does mean one more of them.)
      const already = findLine(bill, code);
      if (mode === 'sell' && already?.serialized) {
        setScanNotice(`${already.productName} is already on this bill — scan the next tag.`);
        return;
      }
      setScanNotice('');
      setScannedLock(true);
      handleCode(code);
    },
    [scannedLock, phase, handleCode, bill, mode]
  );

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    handleCode(manualCode.trim());
  };

  const completeSale = () => {
    if (!isOnline) return setError('You are offline — selling needs a live connection.');
    runSell(bill, false);
  };

  const overrideSale = () => {
    if (!isOnline) return setError('You are offline — selling needs a live connection.');
    runSell(bill, true);
  };

  // Shares this item's details to WhatsApp — for negotiating/confirming an
  // order over chat before (or instead of) recording it as sold here. Since
  // this is triggered from an anonymous in-store scan (no customer on
  // record), it opens WhatsApp's own contact picker rather than a fixed
  // number.
  const shareLineOnWhatsApp = (line: BillLine) => {
    openWhatsAppChat(
      null,
      `Hi! Checking on this for you:\n\n${line.productName}\n${line.categoryName}\nPrice: ₹${lineUnitPrice(line)}\n\nShall I go ahead with the order?`
    );
  };

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + spacing.xl }]}
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
            <View style={styles.cameraSlot}>
              <CameraScanner
                active={phase === 'scanning'}
                onScan={handleBarcodeScanned}
                height={270}
              />
            </View>

            {scanNotice ? (
              <Text style={styles.scanNotice} accessibilityLiveRegion="polite">{scanNotice}</Text>
            ) : null}

            <View style={styles.manualPill}>
              <TextInput
                style={styles.manualInput}
                placeholder="Or type the barcode, or just its number"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                returnKeyType="search"
                value={manualCode}
                onChangeText={setManualCode}
                onSubmitEditing={handleManualSubmit}
              />
              {/* Uses whatever is typed in the box — the same as the
                  keyboard's search key, for staff who look for a button. */}
              <TouchableOpacity
                style={[styles.manualAddButton, !manualCode.trim() && styles.manualAddButtonDisabled]}
                onPress={handleManualSubmit}
                disabled={!manualCode.trim()}
                hitSlop={8}
                accessibilityLabel="Use this code"
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* The bill does not disappear while staff are scanning the next
                item — it stays here as a running strip, one tap from being
                opened in full. */}
            {mode === 'sell' && bill.length > 0 && (
              <TouchableOpacity style={styles.billStrip} onPress={backToBill} activeOpacity={0.85}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                <Text style={styles.billStripText}>
                  Bill · {itemCount} item{itemCount === 1 ? '' : 's'} · ₹{billTotal.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.billStripAction}>View bill</Text>
              </TouchableOpacity>
            )}
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
                {/* With items already on the bill, the way out of an error is
                    back to that bill — every line still on it. Starting over
                    (which clears the bill) is only offered when there is
                    nothing to lose. */}
                {bill.length > 0 && !sellResult ? (
                  <>
                    <Button title="Back to Bill" variant="secondary" onPress={backToBill} style={styles.overrideButton} />
                    <TouchableOpacity style={styles.linkButton} onPress={scanAnother}>
                      <Text style={styles.linkButtonText}>Scan Another Item</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.linkButton} onPress={reset}>
                    <Text style={styles.linkButtonText}>Scan Again</Text>
                  </TouchableOpacity>
                )}
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
                <Text style={styles.soldAmount}>
                  ₹{(sellResult.invoice ? Number(sellResult.invoice.totalAmount) : sellResult.total).toLocaleString('en-IN')}
                </Text>
                {!sellResult.invoiceRequired && (
                  <Text style={styles.soldMeta}>Recorded without an invoice.</Text>
                )}
                {sellResult.channel === 'whatsapp' && (
                  <Text style={styles.soldMeta}>
                    It's in To Ship now — add the DTDC AWB there to send {customer.phone || 'the customer'} their
                    tracking update and invoice.
                  </Text>
                )}

                {shareError ? <Text style={styles.error}>{shareError}</Text> : null}

                {sellResult.channel === 'store' && sellResult.invoice ? (
                  <View style={styles.whatsappShareBlock}>
                    {/* The number can still be typed here if it wasn't given
                        before the sale — it is used only for this message. */}
                    {!cleanMobile(invoiceMobile) || invoiceMobileError ? (
                      <TextInput
                        style={styles.customerInput}
                        placeholder="Customer mobile number"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="phone-pad"
                        maxLength={14}
                        value={invoiceMobile}
                        onChangeText={(v) => {
                          setInvoiceMobile(v);
                          setInvoiceMobileError('');
                        }}
                      />
                    ) : null}
                    {invoiceMobileError ? <Text style={styles.fieldError}>{invoiceMobileError}</Text> : null}
                    <TouchableOpacity
                      style={[styles.whatsappInvoiceButton, busySharing && styles.whatsappInvoiceBusy]}
                      onPress={shareInvoiceOnWhatsApp}
                      activeOpacity={0.85}
                      disabled={busySharing}
                    >
                      {busySharing ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                          <Text style={styles.whatsappInvoiceText}>Share Invoice on WhatsApp</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.helper}>The number is not saved anywhere.</Text>
                  </View>
                ) : null}

                {busySharing ? (
                  <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
                ) : !sellResult.invoiceRequired ? null : sellResult.invoice ? (
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

                {mode === 'sell' && lookup.status !== 'in_stock' && (
                  <Text style={styles.helper}>This item can't be added to the bill.</Text>
                )}

                {mode === 'sell' && lookup.mode === 'quantity' && (lookup.availableQty ?? 0) <= 0 && (
                  <Text style={styles.helper}>No stock available to sell.</Text>
                )}

                <TouchableOpacity style={styles.linkButton} onPress={bill.length > 0 ? backToBill : reset}>
                  <Text style={styles.linkButtonText}>
                    {bill.length > 0 ? 'Back to Bill' : 'Scan Again'}
                  </Text>
                </TouchableOpacity>
              </Card>
            ) : null}

            {/* The bill under construction. Survives "Add More", and becomes
                ONE order with ONE invoice when Complete Sale runs. */}
            {mode === 'sell' && bill.length > 0 && !sellResult && (
              <Card style={styles.resultCard}>
                <Text style={styles.billHeading}>
                  Bill — {itemCount} item{itemCount === 1 ? '' : 's'}
                </Text>
                {scanNotice ? <Text style={styles.scanNotice}>{scanNotice}</Text> : null}
                <Text style={styles.helper}>
                  Each item shows its selling price. Bargained? Change the price against that item — the
                  catalogue price never changes.
                </Text>


                {bill.map((line) => (
                  <View key={line.code} style={styles.billLine}>
                    <View style={styles.billLineTop}>
                      <View style={styles.billLineInfo}>
                        <Text style={styles.billLineName} numberOfLines={2}>
                          {line.productName}
                          {line.quantity > 1 ? ` × ${line.quantity}` : ''}
                        </Text>
                        <Text style={styles.billLineMeta}>
                          {line.code} · store ₹{line.storePrice}
                          {line.quantity > 1 ? ` · ₹${lineTotal(line).toLocaleString('en-IN')}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => shareLineOnWhatsApp(line)}
                        hitSlop={8}
                        accessibilityLabel={`Share ${line.productName} on WhatsApp`}
                      >
                        <Ionicons name="logo-whatsapp" size={19} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeLine(line.code)}
                        hitSlop={10}
                        accessibilityLabel={`Remove ${line.productName} from the bill`}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.iconMuted} />
                      </TouchableOpacity>
                    </View>
                    {/* Every item keeps its own price box, so a discount
                        given on one saree stays on that saree. Full width
                        under the item, so it is easy to tap and read. */}
                    <Text style={styles.billLinePriceLabel}>Selling price ₹</Text>
                    <TextInput
                      style={styles.billLinePrice}
                      placeholder={line.storePrice}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={line.priceInput}
                      onChangeText={(v) => updateLinePrice(line.code, v)}
                      accessibilityLabel={`Price for ${line.productName}`}
                    />
                  </View>
                ))}

                {/* Straight after the items, where staff look for it —
                    there is no limit on how many products one bill holds. */}
                <TouchableOpacity style={styles.addMoreButton} onPress={scanAnother} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addMoreText}>Add More Items</Text>
                </TouchableOpacity>

                {/* Receipt-style dashed rule closing off the item list, the
                    way the printed bill does — a dashed border rather than a
                    row of typed dashes so it spans the card exactly at any
                    width and never wraps onto a second line. */}
                <View style={styles.billSeparator} />

                <View style={styles.billTotalRow}>
                  <Text style={styles.billTotalLabel}>Total</Text>
                  <Text style={styles.billTotalValue}>₹{billTotal.toLocaleString('en-IN')}</Text>
                </View>

                <View style={styles.billSeparator} />

                <Text style={styles.label}>
                  Where is this sale happening? <Text style={styles.requiredMark}>*</Text>
                </Text>
                <SegmentedControl
                  options={SALE_CHANNEL_OPTIONS}
                  value={saleChannel}
                  onChange={(key) => {
                    setSaleChannel(key);
                    setChannelMissing(false);
                  }}
                  invalid={channelMissing}
                />
                {channelMissing && (
                  <Text style={styles.fieldError} accessibilityLiveRegion="polite">
                    Choose Offline Store or Through WhatsApp to complete this sale.
                  </Text>
                )}

          {saleChannel === 'store' && (
            <View style={styles.customerForm}>
              <TextInput
                style={styles.customerInput}
                placeholder="Customer mobile (to send the invoice on WhatsApp)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={14}
                value={invoiceMobile}
                onChangeText={(v) => {
                  setInvoiceMobile(v);
                  setInvoiceMobileError('');
                }}
              />
              <Text style={styles.helper}>
                Optional. Used only to send the invoice on WhatsApp — it is not saved anywhere.
              </Text>
            </View>
          )}

          {saleChannel === 'whatsapp' && (
            <View style={styles.customerForm}>
              <Text style={styles.helper}>
                A WhatsApp order still has to be packed and couriered — it goes into To Ship, and the
                shipment update and invoice are sent to this number once you add the AWB.
              </Text>
              <TextInput
                style={styles.customerInput}
                placeholder="Mobile number *"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={customer.phone}
                onChangeText={(v) => updateCustomer('phone', v)}
              />
              <TextInput
                style={[styles.customerInput, styles.addressInput]}
                placeholder="Full delivery address *"
                placeholderTextColor={colors.textMuted}
                value={customer.address}
                onChangeText={(v) => updateCustomer('address', v)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.helper}>
                Paste the whole address the customer sent — name, street, city, state and pincode together.
              </Text>
            </View>
          )}

                <Text style={styles.label}>
                  Does the customer need an invoice? <Text style={styles.requiredMark}>*</Text>
                </Text>
                <SegmentedControl
                  options={INVOICE_OPTIONS}
                  value={invoiceChoice}
                  onChange={(key) => {
                    setInvoiceChoice(key);
                    setInvoiceChoiceMissing(false);
                  }}
                  invalid={invoiceChoiceMissing}
                />
                {invoiceChoiceMissing && (
                  <Text style={styles.fieldError} accessibilityLiveRegion="polite">
                    Choose Invoice Required or Invoice Not Required to complete this sale.
                  </Text>
                )}
                {invoiceChoice === 'not_required' && (
                  <Text style={styles.helper}>
                    The sale is still recorded in full and counts in analytics — it just won't appear in
                    Invoices or the sales summary.
                  </Text>
                )}

                <Button
                  title={saleChannel === 'whatsapp' ? 'Create WhatsApp Order' : 'Complete Sale'}
                  onPress={completeSale}
                  style={styles.markSoldButton}
                />
                <Text style={styles.helper}>
                  {invoiceChoice === 'not_required'
                    ? 'One order number for everything on this bill.'
                    : 'One order number and one invoice for everything on this bill.'}
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  billHeading: { ...typography.bodySemibold, color: colors.text, marginBottom: spacing.sm },
  scanNotice: {
    ...typography.bodySm, color: colors.primary, marginTop: spacing.sm,
    textAlign: 'center',
  },
  billStrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryBg, borderRadius: radius.lg,
  },
  billStripText: { ...typography.bodySmSemibold, color: colors.text, flex: 1 },
  billStripAction: { ...typography.bodySmSemibold, color: colors.primary },
  billLine: {
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  billLineTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  billLineInfo: { flex: 1, minWidth: 0 },
  billLineName: { ...typography.bodySm, color: colors.text },
  billLineMeta: { ...typography.bodySm, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  billLinePriceLabel: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  billLinePrice: {
    alignSelf: 'stretch', minHeight: 48, backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    ...typography.body, fontSize: 17, color: colors.text,
  },
  requiredMark: { color: colors.error },
  fieldError: { ...typography.bodySm, color: colors.error, marginTop: spacing.sm },
  billSeparator: {
    borderBottomWidth: 1.5,
    borderStyle: 'dashed',
    borderBottomColor: colors.divider,
    marginTop: spacing.md,
  },
  billTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  billTotalLabel: { ...typography.bodySemibold, color: colors.textLabel },
  billTotalValue: { ...typography.h2, color: colors.text },
  addMoreButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.sm, paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.primaryBg,
  },
  addMoreText: { ...typography.bodySemibold, color: colors.primary },
  container: { flex: 1, paddingHorizontal: spacing.md },
  scrollContent: { paddingBottom: spacing.xxl },
  cameraSlot: { marginTop: spacing.lg, marginBottom: spacing.md },
  manualPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    ...shadow.card,
  },
  manualInput: { ...typography.bodyMedium, color: colors.text, padding: 0, flex: 1 },
  manualAddButton: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm,
  },
  manualAddButtonDisabled: { opacity: 0.35 },
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
  addressInput: { minHeight: 96, paddingTop: spacing.md },
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
  whatsappShareBlock: { alignSelf: 'stretch', marginTop: spacing.lg },
  whatsappInvoiceButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.success, borderRadius: radius.pill,
    paddingVertical: spacing.md + 2, marginTop: spacing.sm,
  },
  whatsappInvoiceText: { ...typography.bodySemibold, color: '#fff' },
  whatsappInvoiceBusy: { opacity: 0.7 },
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
