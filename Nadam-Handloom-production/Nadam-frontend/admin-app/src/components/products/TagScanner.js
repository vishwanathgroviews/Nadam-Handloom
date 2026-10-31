// The camera, reading saree tags. A tag is accepted only when the same code is read
// on two frames in a row (as in the old app, to stop misreads), then the scanner
// rests for a moment so one tag isn't taken twice. No permission yet: asks for it,
// and there is always "Type" as another way. Docs Module 4, sections 6.10 and 6A (T6).
import { useRef } from 'react';
import { Linking, Platform, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { T } from '../T';
import { tidyTag } from '../../utils/products';

// The shop prints Code128 / Code39 tags; retail barcodes and QR are read too.
const TYPES = ['code128', 'code39', 'code93', 'codabar', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'qr'];

export function TagScanner({ onCode, paused = false, torch = false, zoom = 0, style, children, mode = 'scan', cameraRef, askTitle = 'Allow the camera to scan tags', askNote = 'Or use "Type" to enter the number on the tag.' }) {
  const { c, radius } = useTheme();
  const focused = useIsFocused();
  const [perm, requestPerm] = useCameraPermissions();
  const seen = useRef({ code: null, at: 0, count: 0, restUntil: 0 });

  function onScanned({ data }) {
    const s = seen.current;
    const now = Date.now();
    if (now < s.restUntil) return;
    const code = tidyTag(data);
    if (!code) return;
    if (s.code === code && now - s.at < 1500) s.count += 1;
    else { s.code = code; s.count = 1; }
    s.at = now;
    if (s.count >= 2) {
      s.restUntil = now + 1800;
      s.code = null;
      onCode(code);
    }
  }

  if (!perm) return <View style={[{ backgroundColor: '#0c0d10' }, style]} />;
  if (!perm.granted) {
    return (
      <View style={[{ backgroundColor: '#14161b', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }, style]}>
        <Icon name="camera" size={36} color="#fff" />
        <T variant="bodyStrong" color="#fff" style={{ textAlign: 'center' }}>{askTitle}</T>
        {askNote ? <T variant="small" color="#d0d3d8" style={{ textAlign: 'center' }}>{askNote}</T> : null}
        <Button title={perm.canAskAgain ? 'Allow camera' : 'Open Settings'} small onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
      </View>
    );
  }
  return (
    <View style={[{ backgroundColor: '#0c0d10', overflow: 'hidden', borderRadius: radius.lg }, style]}>
      {focused ? (
        <CameraView
          ref={cameraRef}
          style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          facing="back"
          enableTorch={torch}
          zoom={zoom || (Platform.OS === 'ios' ? 0.08 : 0)}
          barcodeScannerSettings={{ barcodeTypes: TYPES }}
          onBarcodeScanned={paused || mode !== 'scan' ? undefined : onScanned}
        />
      ) : null}
      {children}
      {!focused ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.overlay }} /> : null}
    </View>
  );
}

// The white frame where the tag should be, with a gentle hint under it.
export function ScanFrame({ hint, style }) {
  return (
    <View pointerEvents="none" style={[{ alignItems: 'center', gap: 8 }, style]}>
      <View style={{ width: '100%', aspectRatio: 2.5, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: '6%', right: '6%', height: 2, backgroundColor: '#ff4d4d', opacity: 0.85 }} />
      </View>
      {hint ? <T variant="caption" color="#fff" style={{ textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>{hint}</T> : null}
    </View>
  );
}
