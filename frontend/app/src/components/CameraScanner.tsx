import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SUPPORTED_BARCODE_TYPES } from '../utils/barcodeTypes';
import { ScanStabilizer } from '../utils/scanStabilizer';
import { normalizeBarcode } from '../utils/barcode';
import { colors, radius } from '../utils/theme';

interface Props {
  /** The caller's own "should the camera be running" condition (a modal being open, a screen being on its scanning step). */
  active: boolean;
  /** Fires once per confirmed physical scan, with the canonical code. */
  onScan: (code: string) => void;
  /** Dimmed spinner over the preview while the caller resolves the code. */
  busy?: boolean;
  /** Preview height; the viewfinder frame scales with it. */
  height?: number;
  /** Shown instead of the preview when the caller has suspended scanning (e.g. the field already holds a code). */
  suspendedMessage?: string | null;
}

/**
 * The one camera surface in the app. Every scanner (Scan to Sell, product
 * barcode assignment, receiving stock, the DTDC AWB field) goes through it.
 *
 * Two hard-won rules live here rather than in each caller:
 *
 * 1. **Exactly one CameraView may be mounted at a time.** Android gives the
 *    camera to a single consumer; a second preview opened while another is
 *    still mounted renders black and never recovers. That is precisely what
 *    happened once Scan to Sell became a bottom tab: a tab screen stays
 *    mounted after you leave it, so its preview still held the camera when a
 *    scanner was opened anywhere else. Gating on useIsFocused() (plus the
 *    caller's own `active`) unmounts the preview the moment its screen is not
 *    the visible one, which both frees the camera and stops it burning
 *    battery in the background.
 *
 * 2. **A scan counts only when consecutive frames agree** — see
 *    ScanStabilizer for why a single frame is not evidence.
 */
export default function CameraScanner({
  active, onScan, busy = false, height = 240, suspendedMessage = null,
}: Props) {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const stabilizer = useRef(new ScanStabilizer());

  const live = active && isFocused && !suspendedMessage;

  // Ask the moment the camera is wanted, rather than making the user find an
  // in-app button first.
  useEffect(() => {
    if (live && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [live, permission, requestPermission]);

  // A half-finished run of agreeing frames must not survive the preview being
  // torn down, or the first frame after reopening could complete a run
  // started against a completely different label.
  useEffect(() => {
    if (!live) stabilizer.current.reset();
  }, [live]);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const confirmed = stabilizer.current.offer(normalizeBarcode(data));
      if (confirmed) onScan(confirmed);
    },
    [onScan]
  );

  if (suspendedMessage) {
    return (
      <View style={[styles.wrap, styles.suspended, { height }]}>
        <Text style={styles.suspendedText}>{suspendedMessage}</Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.wrap, { height }]}>
        <ActivityIndicator style={styles.centered} color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.wrap, { height }]}>
        <View style={styles.permissionPrompt}>
          <Text style={styles.permissionText}>Camera access is needed to scan barcodes.</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      {live ? (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODE_TYPES }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          {/* A 1D barcode is wide and short — the guide frames that shape
              rather than a square. */}
          <View style={styles.viewfinderWrap} pointerEvents="none">
            <View style={styles.viewfinder} />
          </View>
        </>
      ) : (
        // Nothing is rendered in the camera's place while it is not ours to
        // hold; a black rectangle here is a deliberate paused state, not a
        // dead preview.
        <View style={styles.centered}>
          <Text style={styles.pausedText}>Camera paused</Text>
        </View>
      )}
      {busy && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xxl, overflow: 'hidden', backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pausedText: { color: 'rgba(255,255,255,0.55)', fontSize: 12.5 },
  viewfinderWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  viewfinder: { width: 250, height: 110, borderRadius: radius.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  permissionPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 13 },
  permissionButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 20 },
  permissionButtonText: { color: '#fff', fontWeight: '700' },
  processingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  suspended: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg },
  suspendedText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },
});
