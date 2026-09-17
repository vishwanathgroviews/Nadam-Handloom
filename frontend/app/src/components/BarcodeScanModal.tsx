import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scanLookup, ScanLookupResult } from '../api/inventory';
import { SingleFireLock } from '../utils/concurrencyGuards';
import CameraScanner from './CameraScanner';
import { colors, spacing } from '../utils/theme';

interface Props {
  visible: boolean;
  accessToken: string | null;
  onClose: () => void;
  // 'lookup' (default): resolves the scanned code to an existing product via
  // scanLookup and calls onFound. 'assign': skips the lookup entirely and
  // hands the raw scanned string to onScanned — used when the caller is
  // capturing a brand-new externally-printed barcode, not searching for one
  // already in the system.
  mode?: 'lookup' | 'assign';
  onFound?: (result: ScanLookupResult) => void;
  onScanned?: (code: string) => void;
  // Lookup mode only — called instead of showing the dead-end "no product
  // found" error, so a caller (e.g. the product list) can offer to create a
  // new product and attach this barcode to it. Omit to keep the plain error.
  onNotFound?: (code: string) => void;
  // Assign mode only — a short status line the caller updates after each
  // scan (e.g. "Added EXT-042 (5 scanned)" or "Already assigned to X"),
  // shown in place of the generic hint since the caller — not this
  // component — knows whether a scanned code turned out to be free or taken.
  statusText?: string | null;
  statusTone?: 'success' | 'error';
  /**
   * When set, the camera is not started and this message is shown in its
   * place — the caller is saying "there is already a code in hand". Used by
   * the fields that hold exactly one barcode (product barcode, DTDC AWB), so
   * a second tag cannot silently overwrite the one on screen.
   */
  suspendedMessage?: string | null;
}

// The shared "read a printed barcode" camera surface — same scanning
// ScannerScreen uses for offline sale, reused here so any screen that
// manages the catalog (product list, receiving stock) can jump straight to
// a product/code by scanning its tag instead of typing it.
export default function BarcodeScanModal({
  visible, accessToken, onClose, mode = 'lookup', onFound, onScanned, onNotFound, statusText, statusTone = 'success',
  suspendedMessage = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  // expo-camera's onBarcodeScanned keeps firing rapidly while the same label
  // stays in frame during one physical scan, and a React state update isn't
  // visible to a handler invoked before the next render commits — so a
  // state-based lock lets several overlapping fires race past the check
  // together. SingleFireLock is synchronous (see its own tests), so the
  // very first fire closes the gate before a second one can get through.
  const lockRef = useRef(new SingleFireLock());

  const handleScanned = useCallback(
    async (data: string) => {
      // CameraScanner has already required agreeing frames and canonicalised
      // the value; this lock only stops two confirmed scans overlapping while
      // the first is still being resolved against the server.
      if (!lockRef.current.tryAcquire()) return;

      if (mode === 'assign') {
        // A short debounce (not a hard lock like 'lookup') — the caller
        // expects to keep scanning further codes.
        onScanned?.(data);
        setTimeout(() => lockRef.current.release(), 600);
        return;
      }

      if (!accessToken) {
        lockRef.current.release();
        return;
      }
      setProcessing(true);
      setError('');
      try {
        const res = await scanLookup(accessToken, data);
        onFound?.(res.data);
      } catch (err: any) {
        if (onNotFound) {
          onNotFound(data);
          return;
        }
        setError(err.message || 'No product found for this code');
        lockRef.current.release();
      } finally {
        setProcessing(false);
      }
    },
    [accessToken, mode, onFound, onScanned, onNotFound]
  );

  const handleClose = useCallback(() => {
    lockRef.current.release();
    setError('');
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Barcode</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.scanBody}>
          <CameraScanner
            active={visible}
            onScan={handleScanned}
            busy={processing}
            height={220}
            suspendedMessage={suspendedMessage}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => { setError(''); lockRef.current.release(); }}>
                <Text style={styles.retryText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : mode === 'assign' && statusText ? (
            <Text style={[styles.hint, statusTone === 'error' ? styles.hintError : styles.hintSuccess]}>{statusText}</Text>
          ) : suspendedMessage ? null : (
            <Text style={styles.hint}>Point the camera at a product's barcode label.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  // Centers the (now compact) camera+hint block in the space below the
  // header, instead of a fixed-height camera leaving a large empty gap.
  scanBody: { flex: 1, justifyContent: 'center' },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 16 },
  hintSuccess: { color: colors.success, fontWeight: '600' },
  hintError: { color: colors.error, fontWeight: '600' },
  errorBox: { marginTop: 16, alignItems: 'center', gap: 8 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  retryText: { color: colors.primary, fontWeight: '700' },
});
