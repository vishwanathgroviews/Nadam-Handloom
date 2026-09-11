import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { scanLookup, receivePieces } from '../api/inventory';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import BarcodeScanModal from '../components/BarcodeScanModal';
import { normalizeBarcode } from '../utils/barcode';
import { colors, radius, spacing, typography } from '../utils/theme';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

type Props = NativeStackScreenProps<AppStackParamList, 'ReceiveStock'>;

export default function ReceiveStockScreen({ route, navigation }: Props) {
  const { productId, productName } = route.params;
  const { accessToken } = useAuth();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const tryAddCode = useCallback(
    async (rawCode: string) => {
      const code = normalizeBarcode(rawCode);
      if (!code || !accessToken) return;
      if (pending.includes(code)) {
        setStatusText(`Barcode already used — ${code} is already in this batch`);
        setStatusTone('error');
        return;
      }
      setChecking(true);
      try {
        const res = await scanLookup(accessToken, code);
        setStatusText(`Barcode already used — on "${res.data.productName}" (${res.data.status})`);
        setStatusTone('error');
      } catch {
        // scanLookup 404s when the code matches nothing yet — free to use.
        // The server re-checks for real at submit time regardless, so a
        // false "free" here (e.g. a dropped network call) is caught then.
        setPending((prev) => [...prev, code]);
        setStatusText(`Added ${code} (${pending.length + 1} scanned)`);
        setStatusTone('success');
      } finally {
        setChecking(false);
      }
    },
    [accessToken, pending]
  );

  const handleRemove = useCallback((code: string) => {
    setPending((prev) => prev.filter((c) => c !== code));
  }, []);

  const handleManualAdd = useCallback(() => {
    if (!manualCode.trim()) return;
    tryAddCode(manualCode);
    setManualCode('');
  }, [manualCode, tryAddCode]);

  const handleSubmit = useCallback(async () => {
    if (!accessToken || pending.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await receivePieces(accessToken, productId, pending);
      setPending([]);
      setStatusText(null);
      Alert.alert('Stock received', `${res.data.length} unit${res.data.length === 1 ? '' : 's'} added.`);
    } catch (err: any) {
      if (err.code === 'BARCODE_ALREADY_ASSIGNED' && Array.isArray(err.details)) {
        const takenCodes = new Set(err.details.map((d: any) => d.barcode));
        setPending((prev) => prev.filter((c) => !takenCodes.has(c)));
        setError(
          `Barcode already used — ${err.details.length} code(s) belong to another unit and were removed below. Review and submit again.`
        );
      } else if (err.code === 'DUPLICATE_IN_BATCH') {
        setError('Barcode already used — this batch has the same code twice. Remove the duplicate and try again.');
      } else {
        setError(err.message || 'Failed to receive stock');
      }
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, productId, pending]);

  return (
    <KeyboardAwareScreen style={styles.screen}>
      <ScreenHeader title="Scan Barcode" subtitle={productName} />

      <View style={styles.container}>
        <Text style={styles.helper}>
          Scan each unit's externally-printed barcode as it arrives — a handheld/USB scanner types straight into the
          field below and submits automatically. One barcode can only ever belong to one product.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.manualRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Scan with a handheld scanner, or type here"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoFocus
            blurOnSubmit={false}
            onSubmitEditing={handleManualAdd}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleManualAdd} disabled={!manualCode.trim()} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cameraLink} onPress={() => setScannerVisible(true)} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={15} color={colors.primary} />
          <Text style={styles.cameraLinkText}>Or use this phone's camera to scan instead</Text>
        </TouchableOpacity>

        {checking ? (
          <Text style={styles.helper}>Checking…</Text>
        ) : statusText ? (
          <View style={[styles.statusBanner, statusTone === 'error' ? styles.statusBannerError : styles.statusBannerSuccess]}>
            <Ionicons
              name={statusTone === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={16}
              color={statusTone === 'error' ? colors.error : colors.success}
            />
            <Text style={[styles.statusBannerText, { color: statusTone === 'error' ? colors.error : colors.success }]}>
              {statusText}
            </Text>
          </View>
        ) : null}

        <Text style={[typography.caption, styles.sectionLabel]}>{pending.length} scanned</Text>
        <Card style={styles.listCard}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {pending.length === 0 ? (
              <Text style={styles.emptyText}>No units scanned yet.</Text>
            ) : (
              pending.map((code, i) => (
                <View key={code} style={[styles.pendingRow, i === pending.length - 1 && styles.pendingRowLast]}>
                  <Text style={styles.pendingCode}>{code}</Text>
                  <TouchableOpacity onPress={() => handleRemove(code)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </Card>

        <Button
          title={`Add ${pending.length} Unit${pending.length === 1 ? '' : 's'} to Stock`}
          onPress={handleSubmit}
          loading={submitting}
          disabled={pending.length === 0}
          style={styles.submitButton}
        />
      </View>

      <BarcodeScanModal
        visible={scannerVisible}
        accessToken={accessToken}
        mode="assign"
        onScanned={tryAddCode}
        onClose={() => setScannerVisible(false)}
        statusText={checking ? 'Checking…' : statusText}
        statusTone={statusTone}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  helper: { ...typography.bodySm, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 },
  error: {
    ...typography.bodySm,
    color: colors.error,
    backgroundColor: colors.errorBg,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  manualRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cameraLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginTop: spacing.md, marginBottom: spacing.sm },
  cameraLinkText: { ...typography.bodySmSemibold, color: colors.primary },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.sm,
  },
  statusBannerError: { backgroundColor: colors.errorBg },
  statusBannerSuccess: { backgroundColor: colors.successBg },
  statusBannerText: { ...typography.bodySmSemibold, flex: 1 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { ...typography.bodySemibold, color: '#fff' },
  sectionLabel: { color: colors.textLabel, marginTop: spacing.lg, marginBottom: spacing.sm },
  listCard: { flex: 1, paddingVertical: 0, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  emptyText: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pendingRowLast: { borderBottomWidth: 0 },
  pendingCode: { ...typography.bodySemibold, color: colors.text },
  submitButton: { marginTop: 0 },
});
