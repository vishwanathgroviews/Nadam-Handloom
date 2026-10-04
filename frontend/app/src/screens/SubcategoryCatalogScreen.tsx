import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getCatalogPdfStatus, generateCatalogPdf, CatalogPdfStatus } from '../api/catalogPdf';
import { savePdfBytes } from '../utils/pdf';
import { cleanMobile } from '../utils/invoiceShare';
import { catalogCaption, catalogFilename } from '../utils/catalogShare';
import { canSendPdfToWhatsAppChat, sharePdfOnWhatsApp } from '../utils/whatsappPdf';
import { useIsOnline } from '../utils/network';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import OfflineBanner from '../components/OfflineBanner';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'SubcategoryCatalog'>;

export default function SubcategoryCatalogScreen({ route }: Props) {
  const { subcategoryId, subcategoryName } = route.params;
  const { accessToken } = useAuth();
  const isOnline = useIsOnline();
  const directChat = canSendPdfToWhatsAppChat();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CatalogPdfStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState('');
  // The copy of the live catalog already on this phone, tagged with the
  // generation it belongs to so a catalog regenerated since (here or on
  // another phone) is fetched again rather than sending the stale file.
  const [localPdf, setLocalPdf] = useState<{ uri: string; generatedAt: string } | null>(null);
  const [lastProductCount, setLastProductCount] = useState<number | null>(null);

  const loadStatus = useCallback(async (): Promise<CatalogPdfStatus | null> => {
    if (!accessToken) return null;
    setLoading(true);
    try {
      const res = await getCatalogPdfStatus(accessToken, subcategoryId);
      setStatus(res.data);
      return res.data;
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog status');
      return null;
    } finally {
      setLoading(false);
    }
  }, [accessToken, subcategoryId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Generating only makes the PDF. Sending it is the Share button's job, so
  // staff can type the customer's number first and are never dropped into a
  // share menu they did not ask for.
  const handleGenerate = useCallback(async () => {
    if (!accessToken) return;
    if (!isOnline) return setError('You are offline — generating the catalog needs a live connection.');

    setGenerating(true);
    setError('');
    try {
      const result = await generateCatalogPdf(accessToken, subcategoryId);
      const uri = savePdfBytes(result.bytes, catalogFilename(subcategoryName ?? ''));
      setLastProductCount(result.productCount ?? null);
      const fresh = await loadStatus();
      setLocalPdf(fresh ? { uri, generatedAt: fresh.generatedAt } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate the catalog PDF');
    } finally {
      setGenerating(false);
    }
  }, [accessToken, isOnline, subcategoryId, subcategoryName, loadStatus]);

  // Sends the catalog that already exists, without making a new one. On
  // Android it opens the customer's WhatsApp chat with the PDF attached; the
  // number goes only to WhatsApp on this phone. iPhone has no such route, so
  // there it opens the share menu and no number is asked for.
  const handleShare = useCallback(async () => {
    if (!status) return;
    const customerMobile = cleanMobile(mobile);
    if (directChat && !customerMobile) {
      setMobileError("Enter the customer's 10-digit mobile number.");
      return;
    }
    const onPhone = localPdf?.generatedAt === status.generatedAt ? localPdf.uri : null;
    if (!onPhone && !isOnline) return setError('You are offline — sharing the catalog needs a live connection.');

    setMobileError('');
    setError('');
    setSharing(true);
    try {
      const filename = catalogFilename(subcategoryName ?? '');
      let uri = onPhone;
      if (!uri) {
        const res = await fetch(status.url);
        if (!res.ok) throw new Error('Could not download the catalog PDF');
        uri = savePdfBytes(new Uint8Array(await res.arrayBuffer()), filename);
        setLocalPdf({ uri, generatedAt: status.generatedAt });
      }
      const sentVia = await sharePdfOnWhatsApp(uri, customerMobile, filename, catalogCaption(subcategoryName ?? ''));
      if (sentVia === 'share_menu_no_whatsapp') {
        setError('WhatsApp is not installed on this phone — choose another app to send the catalog.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not share the catalog');
    } finally {
      setSharing(false);
    }
  }, [status, mobile, directChat, localPdf, isOnline, subcategoryName]);

  return (
    <KeyboardAwareScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Catalog PDF" backLabel="Subcategories" subtitle={subcategoryName || 'This subcategory'} />
        <Text style={styles.helper}>
          Generates a PDF with every active product's photo in this subcategory, to send to a customer on WhatsApp.
          A new one deletes the old PDF and replaces it — there's only ever one live catalog per subcategory.
        </Text>

        {!isOnline && <OfflineBanner />}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <Card style={styles.statusCard}>
            {status ? (
              <>
                <View style={styles.statusRow}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  <Text style={styles.statusLine}>Last generated {new Date(status.generatedAt).toLocaleString()}</Text>
                </View>
                <Text style={styles.statusSubline}>{status.productCount} product photo(s)</Text>
              </>
            ) : (
              <Text style={styles.statusLine}>No catalog PDF generated yet.</Text>
            )}
          </Card>
        )}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {localPdf && lastProductCount != null && (
          <Text style={styles.helper}>Just generated: {lastProductCount} product photo(s).</Text>
        )}

        {generating ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : loading ? null : status ? (
          <View style={styles.actionColumn}>
            {directChat ? (
              <>
                <TextInput
                  style={styles.mobileInput}
                  placeholder="Customer mobile number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={14}
                  value={mobile}
                  onChangeText={(v) => {
                    setMobile(v);
                    setMobileError('');
                  }}
                />
                {mobileError ? <Text style={styles.fieldError}>{mobileError}</Text> : null}
              </>
            ) : null}
            <Button
              title={directChat ? 'Share on WhatsApp' : 'Share'}
              onPress={handleShare}
              loading={sharing}
              style={directChat ? styles.secondActionButton : undefined}
            />
            <Text style={styles.shareHint}>
              {directChat
                ? "Opens the customer's WhatsApp chat with the catalog attached. The number is not saved anywhere."
                : "Choose WhatsApp in the menu, then the customer's chat."}
            </Text>
            <Button
              title="Generate New"
              onPress={handleGenerate}
              variant="secondary"
              disabled={!isOnline || sharing}
              style={styles.secondActionButton}
            />
          </View>
        ) : (
          <View style={styles.actionColumn}>
            <Button title="Generate Catalog" onPress={handleGenerate} disabled={!isOnline} />
          </View>
        )}
      </ScrollView>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  helper: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: spacing.sm + 2 },
  statusCard: {
    marginTop: spacing.xs,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusLine: { ...typography.bodySm, color: colors.text },
  statusSubline: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.xs, marginLeft: 26 },
  actionColumn: { marginTop: spacing.xl },
  secondActionButton: { marginTop: spacing.sm + 2 },
  mobileInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 1,
    ...typography.body,
    color: colors.text,
  },
  fieldError: { ...typography.bodySm, color: colors.error, marginTop: spacing.sm },
  shareHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: spacing.sm },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginTop: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
});
