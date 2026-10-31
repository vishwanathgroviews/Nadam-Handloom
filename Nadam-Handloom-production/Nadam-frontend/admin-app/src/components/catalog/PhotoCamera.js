// Taking a category's photo with the frame on the camera, as for a saree (27 Oct 2026): the
// white frame is the card customers see at the top of the website's home page (3:4), so
// what is inside it is what they get. The crop screen opens next, centred on the frame.
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../T';
import { Icon } from '../Icon';
import { TagScanner } from '../products/TagScanner';

export function PhotoCamera({ ratio, hint = 'Fit what customers should see inside the frame', onShot, onCancel }) {
  const insets = useSafeAreaInsets();
  const camera = useRef(null);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    setProblem(null);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.9, exif: false });
      onShot({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch {
      setProblem('The photo didn\'t work. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#0c0d10', paddingTop: insets.top }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close the camera" onPress={onCancel} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" color="#fff" /></Pressable>
          <T variant="bodyStrong" color="#fff" style={{ flex: 1 }}>Category photo</T>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
          <TagScanner cameraRef={camera} mode="photo" torch={torch} style={{ flex: 1 }} askTitle="Allow the camera to take the photo" askNote={'Or close this and use "Choose from library".'}>
            <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ height: '86%', aspectRatio: ratio, maxWidth: '86%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }}>
                <T variant="caption" color="#fff" style={{ textAlign: 'center', paddingHorizontal: 8 }}>{hint}</T>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Torch off' : 'Torch on'} onPress={() => setTorch((x) => !x)} style={{ position: 'absolute', right: 10, top: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: torch ? '#fff' : 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="flash" size={20} color={torch ? '#111' : '#fff'} />
            </Pressable>
          </TagScanner>
        </View>
        <View style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 14), gap: 10, alignItems: 'center' }}>
          {problem ? <T variant="small" color="#ffb4a9" accessibilityRole="alert">{problem}</T> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={shoot} disabled={busy}
            style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : null}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
