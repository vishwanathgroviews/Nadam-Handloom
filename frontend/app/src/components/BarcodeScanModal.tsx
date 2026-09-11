import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { scanLookup, ScanLookupResult } from '../api/inventory';
import { SUPPORTED_BARCODE_TYPES } from '../utils/barcodeTypes';
import { SingleFireLock } from '../utils/concurrencyGuards';
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
}

// The shared "read a printed barcode" camera surface — same scanning
// ScannerScreen uses for offline sale, reused here so any screen that
// manages the catalog (product list, receiving stock) can jump straight to
// a product/code by scanning its tag instead of typing it.
export default function BarcodeScanModal({
  visible, accessToken, onClose, mode = 'lookup', onFound, onScanned, onNotFound, statusText, statusTone = 'success',
}: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  // expo-camera's onBarcodeScanned keeps firing rapidly while the same label
  // stays in frame during one physical scan, and a React state update isn't
  // visible to a handler invoked before the next render commits — so a
  // state-based lock lets several overlapping fires race past the check
  // together. SingleFireLock is synchronous (see its own tests), so the
  // very first fire closes the gate before a second one can get through.
  const lockRef = useRef(new SingleFireLock());

  // Prompts for camera access the moment the scanner opens, instead of
  // waiting for the user to notice and tap an in-app "Allow Camera" button
  // first — so the camera is live as soon as this modal appears, on every
  // open after the very first one.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!lockRef.current.tryAcquire()) return;

      if (mode === 'assign') {
        // A short debounce lock (not a hard lock like 'lookup') — the same
        // physical label re-fires the scan event rapidly while the camera
        // holds on it, but the caller expects to keep scanning further codes.
        onScanned?.(data);
        setTimeout(() => lockRef.current.release(), 1000);
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
          <View style={styles.cameraWrap}>
            {!permission ? (
              <ActivityIndicator style={{ marginTop: 60 }} color="#fff" />
            ) : permission.granted ? (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
                  onBarcodeScanned={handleScanned}
                />
                {/* A 1D barcode is wide and short, not square — this guide
                    frames roughly that shape instead of a full-bleed camera
                    view sized for scanning anything. */}
                <View style={styles.viewfinderWrap} pointerEvents="none">
                  <View style={styles.viewfinder} />
                </View>
              </>
            ) : (
              <View style={styles.permissionPrompt}>
                <Text style={styles.permissionText}>Camera access is needed to scan barcodes.</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                  <Text style={styles.permissionButtonText}>Allow Camera</Text>
                </TouchableOpacity>
              </View>
            )}
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => { setError(''); lockRef.current.release(); }}>
                <Text style={styles.retryText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : mode === 'assign' && statusText ? (
            <Text style={[styles.hint, statusTone === 'error' ? styles.hintError : styles.hintSuccess]}>{statusText}</Text>
          ) : (
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
  cameraWrap: { height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  viewfinderWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  viewfinder: { width: 260, height: 90, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  permissionPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 13 },
  permissionButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  permissionButtonText: { color: '#fff', fontWeight: '700' },
  processingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 16 },
  hintSuccess: { color: colors.success, fontWeight: '600' },
  hintError: { color: colors.error, fontWeight: '600' },
  errorBox: { marginTop: 16, alignItems: 'center', gap: 8 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  retryText: { color: colors.primary, fontWeight: '700' },
});
