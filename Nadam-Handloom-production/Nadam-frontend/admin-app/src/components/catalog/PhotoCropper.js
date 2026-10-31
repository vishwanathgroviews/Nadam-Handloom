// Crop a photo to the website's tile shape (4:3, or 3:4 for a saree's product card and a
// category's card): drag the photo inside the frame.
// "Use the whole photo" skips the crop (not offered for categories, so every category photo
// fits its card). A photo too small for its place gets a warning. The result is a JPEG on
// the phone, uploaded when the form is saved.
import { useMemo, useState } from 'react';
import { Image, Modal, PanResponder, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { TopBar } from '../Screen';
import { Button } from '../Button';
import { T } from '../T';
import { TILE_RATIO, centredOffset, clampOffset, cropArea, cutPhoto } from '../../utils/photo';

export function PhotoCropper({ photo, onDone, onCancel, ratio = TILE_RATIO, hint = 'Drag the photo so the important part sits inside the frame. This is the tile customers see on the website.', note = 'Saved small (80 KB or less) with location data removed. Uploads when you press Save.', allowWhole = true, smallBelow = 0 }) {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const frame = useMemo(() => {
    const w = Math.min(screenW - 40, ratio < 1 ? 340 : 560);
    return { width: w, height: w / ratio };
  }, [screenW, ratio]);
  // Where the drag started and where the photo is now; kept outside render state so
  // the gesture handlers (made once) always see the latest position.
  const [drag] = useState(() => {
    const start = centredOffset(photo, frame);
    return { start, now: start };
  });
  const [offset, setOffset] = useState(drag.now);
  const [busy, setBusy] = useState(null);
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  const small = smallBelow > 0 && Math.max(frame.width, frame.height) / scale < smallBelow; // the crop's longer side, in the photo's pixels

  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { drag.start = drag.now; },
    onPanResponderMove: (_e, g) => {
      drag.now = clampOffset(photo, frame, { x: drag.start.x + g.dx, y: drag.start.y + g.dy });
      setOffset(drag.now);
    },
    onPanResponderTerminationRequest: () => false,
  }));

  async function finish(withCrop) {
    setBusy(withCrop ? 'crop' : 'whole');
    try {
      onDone(await cutPhoto(photo, withCrop ? cropArea(photo, frame, offset) : null));
    } catch {
      setBusy(null);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
        <TopBar title="Crop photo" onBack={onCancel} />
        <View style={{ paddingHorizontal: 20, flex: 1 }}>
          <T color="text2" style={{ marginBottom: 14 }}>{hint}</T>
          <View {...pan.panHandlers} accessibilityLabel="Photo to crop. Drag to move it." style={{ width: frame.width, height: frame.height, alignSelf: 'center', overflow: 'hidden', borderRadius: radius.md, borderWidth: 2, borderColor: c.primary, backgroundColor: '#000' }}>
            <Image source={{ uri: photo.uri }} style={{ position: 'absolute', left: offset.x, top: offset.y, width: photo.width * scale, height: photo.height * scale }} />
          </View>
          {small ? <T variant="smallStrong" color="warning" style={{ textAlign: 'center', marginTop: 10 }}>This photo is small, so it will look blurry on the website. A photo taken with the phone's camera works best.</T> : null}
          <T variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 10 }}>{note}</T>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Button title="Use this crop" icon="check" loading={busy === 'crop'} disabled={!!busy} onPress={() => finish(true)} />
          {allowWhole ? <Button title="Use the whole photo" kind="secondary" loading={busy === 'whole'} disabled={!!busy} onPress={() => finish(false)} /> : null}
        </View>
      </View>
    </Modal>
  );
}
