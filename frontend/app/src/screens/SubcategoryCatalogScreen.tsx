import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { getCatalogPdfStatus, generateCatalogPdf, CatalogPdfStatus } from '../api/catalogPdf';
import { savePdfBytes, printPdf, sharePdf } from '../utils/pdf';
import { useIsOnline } from '../utils/network';
import OfflineBanner from '../components/OfflineBanner';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { colors, radius, spacing, typography } from '../utils/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'SubcategoryCatalog'>;

export default function SubcategoryCatalogScreen({ route, navigation }: Props) {
  const { subcategoryId, subcategoryName } = route.params;
  const { accessToken } = useAuth();
  const isOnline = useIsOnline();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CatalogPdfStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastPdfUri, setLastPdfUri] = useState<string | null>(null);
  const [lastProductCount, setLastProductCount] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await getCatalogPdfStatus(accessToken, subcategoryId);
      setStatus(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog status');
    } finally {
      setLoading(false);
    }
  }, [accessToken, subcategoryId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleGenerate = useCallback(
    async (action: 'print' | 'share') => {
      if (!accessToken) return;
      if (!isOnline) return setError('You are offline — generating the catalog needs a live connection.');

      setGenerating(true);
      setError('');
      try {
        const result = await generateCatalogPdf(accessToken, subcategoryId);
        const uri = savePdfBytes(result.bytes, `catalog-${subcategoryId}-${Date.now()}.pdf`);
        setLastPdfUri(uri);
        setLastProductCount(result.productCount ?? null);
        await loadStatus();
        if (action === 'print') await printPdf(uri);
        else await sharePdf(uri);
      } catch (err: any) {
        setError(err.message || 'Failed to generate the catalog PDF');
      } finally {
        setGenerating(false);
      }
    },
    [accessToken, isOnline, subcategoryId, loadStatus]
  );

  const hasExisting = Boolean(status);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Catalog PDF" backLabel="Subcategories" subtitle={subcategoryName || 'This subcategory'} />
      <Text style={styles.helper}>
        Generates a PDF with every active product's photo in this subcategory, ready to share with a customer over
        WhatsApp or save. Generating a new one deletes the old PDF and replaces it — there's only ever one live
        catalog per subcategory.
      </Text>

      {!isOnline && <OfflineBanner />}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
      ) : (
        <Card style={styles.statusCard}>
          {hasExisting && status ? (
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
      {lastPdfUri && lastProductCount != null && (
        <Text style={styles.helper}>Just generated: {lastProductCount} product photo(s).</Text>
      )}

      {generating ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
      ) : (
        <View style={styles.actionColumn}>
          <Button
            title={hasExisting ? 'Generate New & Print' : 'Generate & Print'}
            onPress={() => handleGenerate('print')}
            disabled={!isOnline}
          />
          <Button
            title={hasExisting ? 'Generate New & Share' : 'Generate & Share'}
            onPress={() => handleGenerate('share')}
            disabled={!isOnline}
            variant="secondary"
            style={styles.secondActionButton}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  helper: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: spacing.sm + 2 },
  statusCard: {
    marginTop: spacing.xs,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusLine: { ...typography.bodySm, color: colors.text },
  statusSubline: { ...typography.bodySm, color: colors.textMuted, marginTop: spacing.xs, marginLeft: 26 },
  actionColumn: { marginTop: spacing.xl },
  secondActionButton: { marginTop: spacing.sm + 2 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorBg, borderRadius: radius.md,
    padding: spacing.sm + 2, marginTop: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1 },
});
