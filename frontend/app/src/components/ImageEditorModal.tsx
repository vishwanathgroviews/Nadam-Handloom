import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../utils/theme';
import {
  Rect,
  Corner,
  fullRect,
  aspectRect,
  moveRect,
  resizeFromCorner,
  toSourcePixels,
  isWholeImage,
} from '../utils/cropMath';

interface Props {
  visible: boolean;
  /** The photo just taken or picked. */
  uri: string | null;
  onCancel: () => void;
  /** The cropped/rotated photo, as a new local file. */
  onDone: (uri: string) => void;
}

type AspectKey = 'free' | 'square' | 'portrait';
const ASPECTS: { key: AspectKey; label: string; ratio: number | null }[] = [
  { key: 'free', label: 'Free', ratio: null },
  { key: 'square', label: 'Square', ratio: 1 },
  { key: 'portrait', label: '3:4', ratio: 3 / 4 },
];

// Working copy never wider than this — a 12-megapixel camera frame is far
// more than a product photo needs, and every rotate re-encodes the file.
const MAX_WORKING_EDGE = 2400;
const HANDLE = 34;

interface Working {
  uri: string;
  width: number;
  height: number;
}

/**
 * Crop and rotate a product photo before it is staged for upload.
 *
 * Built from PanResponder rather than a native cropper library so it needs no
 * extra native module: drag inside the frame to move it, drag a corner to
 * resize it, and the rotate buttons turn the photo a quarter at a time. The
 * crop is applied to the real pixels only when Done is pressed.
 */
export default function ImageEditorModal({ visible, uri, onCancel, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [working, setWorking] = useState<Working | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [aspect, setAspect] = useState<AspectKey>('free');

  // PanResponders are created once, so they read live values through refs.
  const rectRef = useRef<Rect | null>(null);
  const boundsRef = useRef({ width: 0, height: 0 });
  const ratioRef = useRef<number | null>(null);
  const startRef = useRef<Rect | null>(null);

  const setCrop = useCallback((next: Rect) => {
    rectRef.current = next;
    setRect(next);
  }, []);

  // Normalise the incoming photo: bakes in the camera's EXIF orientation (so
  // "up" on screen is "up" in the file) and caps its size.
  useEffect(() => {
    if (!visible || !uri) return;
    let cancelled = false;
    setWorking(null);
    setRect(null);
    setAspect('free');
    ratioRef.current = null;
    setError('');
    setBusy(true);
    (async () => {
      try {
        let result = await ImageManipulator.manipulateAsync(uri, [], {
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        const longest = Math.max(result.width, result.height);
        if (longest > MAX_WORKING_EDGE) {
          const resize =
            result.width >= result.height ? { width: MAX_WORKING_EDGE } : { height: MAX_WORKING_EDGE };
          result = await ImageManipulator.manipulateAsync(result.uri, [{ resize }], {
            compress: 0.95,
            format: ImageManipulator.SaveFormat.JPEG,
          });
        }
        if (!cancelled) setWorking({ uri: result.uri, width: result.width, height: result.height });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not open this photo');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, uri]);

  // Where the photo sits on screen: fitted inside the editing area.
  const display = working && area
    ? (() => {
        const scale = Math.min(area.width / working.width, area.height / working.height);
        const width = working.width * scale;
        const height = working.height * scale;
        return { scale, width, height, left: (area.width - width) / 2, top: (area.height - height) / 2 };
      })()
    : null;

  // A fresh photo (or a rotated one) starts with the whole image selected.
  useEffect(() => {
    if (!display) return;
    boundsRef.current = { width: display.width, height: display.height };
    const ratio = ratioRef.current;
    setCrop(ratio ? aspectRect(boundsRef.current, ratio) : fullRect(boundsRef.current));
    // Only when the photo or its displayed size changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working?.uri, display?.width, display?.height]);

  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = rectRef.current;
      },
      onPanResponderMove: (_e, g) => {
        if (!startRef.current) return;
        setCrop(moveRect(startRef.current, g.dx, g.dy, boundsRef.current));
      },
    })
  ).current;

  const cornerResponders = useRef(
    (['tl', 'tr', 'bl', 'br'] as Corner[]).reduce(
      (acc, corner) => {
        acc[corner] = PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            startRef.current = rectRef.current;
          },
          onPanResponderMove: (_e, g) => {
            if (!startRef.current) return;
            setCrop(resizeFromCorner(startRef.current, corner, g.dx, g.dy, boundsRef.current, ratioRef.current));
          },
        });
        return acc;
      },
      {} as Record<Corner, ReturnType<typeof PanResponder.create>>
    )
  ).current;

  const chooseAspect = (key: AspectKey) => {
    const ratio = ASPECTS.find((a) => a.key === key)!.ratio;
    setAspect(key);
    ratioRef.current = ratio;
    if (display) setCrop(ratio ? aspectRect(boundsRef.current, ratio) : fullRect(boundsRef.current));
  };

  const rotate = async (degrees: 90 | -90) => {
    if (!working || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await ImageManipulator.manipulateAsync(working.uri, [{ rotate: degrees }], {
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      setWorking({ uri: result.uri, width: result.width, height: result.height });
    } catch (err: any) {
      setError(err?.message || 'Could not rotate the photo');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!display) return;
    chooseAspect('free');
  };

  const finish = async () => {
    if (!working || !display || !rect || busy) return;
    if (isWholeImage(rect, boundsRef.current)) {
      onDone(working.uri);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const crop = toSourcePixels(rect, display.scale, { width: working.width, height: working.height });
      const result = await ImageManipulator.manipulateAsync(working.uri, [{ crop }], {
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onDone(result.uri);
    } catch (err: any) {
      setError(err?.message || 'Could not crop the photo');
    } finally {
      setBusy(false);
    }
  };

  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!area || area.width !== width || area.height !== height) setArea({ width, height });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onCancel} hitSlop={10} accessibilityLabel="Cancel editing">
            <Text style={styles.topAction}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Crop &amp; Rotate</Text>
          <TouchableOpacity onPress={finish} hitSlop={10} disabled={busy || !rect} accessibilityLabel="Use this photo">
            <Text style={[styles.topAction, styles.doneAction, (busy || !rect) && styles.disabled]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.area} onLayout={onAreaLayout}>
          {working && display && (
            <View
              style={{ position: 'absolute', left: display.left, top: display.top, width: display.width, height: display.height }}
            >
              <Image source={{ uri: working.uri }} style={{ width: display.width, height: display.height }} />
              {rect && (
                <>
                  {/* Dim everything outside the crop frame. */}
                  <View style={[styles.shade, { left: 0, top: 0, right: 0, height: rect.y }]} />
                  <View style={[styles.shade, { left: 0, top: rect.y + rect.height, right: 0, bottom: 0 }]} />
                  <View style={[styles.shade, { left: 0, top: rect.y, width: rect.x, height: rect.height }]} />
                  <View
                    style={[styles.shade, { left: rect.x + rect.width, top: rect.y, right: 0, height: rect.height }]}
                  />

                  <View
                    {...moveResponder.panHandlers}
                    style={[styles.frame, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}
                  >
                    <View style={[styles.gridV, { left: '33.33%' }]} />
                    <View style={[styles.gridV, { left: '66.66%' }]} />
                    <View style={[styles.gridH, { top: '33.33%' }]} />
                    <View style={[styles.gridH, { top: '66.66%' }]} />
                  </View>

                  {(['tl', 'tr', 'bl', 'br'] as Corner[]).map((corner) => (
                    <View
                      key={corner}
                      {...cornerResponders[corner].panHandlers}
                      style={[
                        styles.handleHit,
                        {
                          left: (corner[1] === 'l' ? rect.x : rect.x + rect.width) - HANDLE / 2,
                          top: (corner[0] === 't' ? rect.y : rect.y + rect.height) - HANDLE / 2,
                        },
                      ]}
                    >
                      <View style={styles.handleDot} />
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.aspectRow}>
          {ASPECTS.map((a) => (
            <TouchableOpacity
              key={a.key}
              onPress={() => chooseAspect(a.key)}
              style={[styles.aspectChip, aspect === a.key && styles.aspectChipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.aspectText, aspect === a.key && styles.aspectTextActive]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toolRow}>
          <TouchableOpacity style={styles.tool} onPress={() => rotate(-90)} disabled={busy} accessibilityLabel="Rotate left">
            <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
            <Text style={styles.toolText}>Rotate left</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={reset} disabled={busy} accessibilityLabel="Reset crop">
            <Ionicons name="scan-outline" size={22} color="#fff" />
            <Text style={styles.toolText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={() => rotate(90)} disabled={busy} accessibilityLabel="Rotate right">
            <Ionicons name="arrow-redo-outline" size={22} color="#fff" />
            <Text style={styles.toolText}>Rotate right</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#141011' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  title: { ...typography.bodySemibold, color: '#fff' },
  topAction: { ...typography.bodySemibold, color: '#fff' },
  doneAction: { color: '#E0B460' },
  disabled: { opacity: 0.4 },
  area: { flex: 1, margin: spacing.lg },
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { position: 'absolute', borderWidth: 2, borderColor: '#fff' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.6)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.6)' },
  handleHit: {
    position: 'absolute', width: HANDLE, height: HANDLE,
    alignItems: 'center', justifyContent: 'center',
  },
  handleDot: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
    borderWidth: 2, borderColor: colors.primary,
  },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.bodySm, color: '#FFB4B4', textAlign: 'center', marginBottom: spacing.sm },
  aspectRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  aspectChip: {
    paddingVertical: spacing.xs + 3, paddingHorizontal: spacing.lg,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  aspectChipActive: { backgroundColor: '#fff' },
  aspectText: { ...typography.bodySmSemibold, color: '#fff' },
  aspectTextActive: { color: colors.text },
  toolRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.lg },
  tool: { alignItems: 'center', gap: 4, paddingVertical: spacing.sm, minWidth: 90 },
  toolText: { ...typography.bodySm, color: '#fff' },
});
