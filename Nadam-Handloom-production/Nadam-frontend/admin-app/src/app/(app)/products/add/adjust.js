// Adjust one photo's frame (only if the automatic fit cut something off): drag the
// photo inside the website's product card shape (3:4). Docs Module 4, decision 6.4.
import { useMemo, useState } from 'react';
import { Image, PanResponder, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { useFeedback } from '../../../../components/Feedback';
import { useTheme } from '../../../../theme/ThemeProvider';
import { batchStore, useBatch } from '../../../../products/batch';
import { CARD_RATIO } from '../../../../utils/products';

export default function AdjustPhoto() {
  const { item } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showToast } = useFeedback();
  const batch = useBatch();
  const it = batch?.items.find((x) => x.id === item);
  const frame = useMemo(() => { const w = Math.min(width - 48, 340); return { width: w, height: w / CARD_RATIO }; }, [width]);
  const size = it && it.w && it.h ? { width: it.w, height: it.h } : { width: 3, height: 4 };
  const scale = Math.max(frame.width / size.width, frame.height / size.height);
  const spareX = size.width * scale - frame.width;
  const spareY = size.height * scale - frame.height;
  const [shift, setShift] = useState(it?.shift || 0);
  const [drag] = useState(() => ({ start: it?.shift || 0, now: it?.shift || 0 }));
  const [busy, setBusy] = useState(false);
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { drag.start = drag.now; },
    onPanResponderMove: (_e, g) => {
      const spare = spareX > spareY ? spareX : spareY;
      const delta = spare > 0 ? -(spareX > spareY ? g.dx : g.dy) / (spare / 2) : 0;
      drag.now = Math.max(-1, Math.min(1, drag.start + delta));
      setShift(drag.now);
    },
    onPanResponderTerminationRequest: () => false,
  }));

  if (!it) return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}><TopBar title="Adjust photo" onBack={() => router.back()} /></View>;
  const left = -(spareX / 2) * (1 + (spareX > spareY ? shift : 0));
  const top = -(spareY / 2) * (1 + (spareY >= spareX ? shift : 0));

  async function use() {
    setBusy(true);
    try { await batchStore.refit(it.id, shift); router.back(); showToast('Photo adjusted', 'success'); } catch { showToast('Couldn\'t adjust the photo.'); setBusy(false); }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <TopBar title="Adjust photo" onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: 24, gap: 12 }}>
        <T color="text2">Drag the photo so the saree sits inside the frame. Customers see this shape on the website.</T>
        <View {...pan.panHandlers} accessibilityLabel="Photo. Drag to move it." style={{ width: frame.width, height: frame.height, alignSelf: 'center', overflow: 'hidden', borderRadius: radius.md, borderWidth: 2, borderColor: c.primary, backgroundColor: '#000' }}>
          <Image source={{ uri: it.src }} style={{ position: 'absolute', left, top, width: size.width * scale, height: size.height * scale }} />
        </View>
        <T variant="caption" color="muted" style={{ textAlign: 'center' }}>Saved small (80 KB or less) with location removed.</T>
      </View>
      <View style={{ paddingHorizontal: 24 }}><Button title="Use photo" icon="check" loading={busy} onPress={use} /></View>
    </View>
  );
}
