// A saree's photos (decision 6.3): up to 5. The first is the main one (the list, the
// website's card, the catalogue PDF); the website shows the others on the saree's page.
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { Badge } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { useFeedback } from '../../../components/Feedback';
import { PhotoCropper } from '../../../components/catalog/PhotoCropper';
import { useTheme, useIsTablet } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import * as products from '../../../api/products';
import { pickPhoto } from '../../../utils/photo';
import { CARD_RATIO } from '../../../utils/products';

export default function Photos() {
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { width } = useWindowDimensions();
  const { confirm, showToast } = useFeedback();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [crop, setCrop] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try { setP((await products.getProduct(id)).product); } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cols = tablet ? 5 : 3;
  const cellW = (Math.min(width - (tablet ? 96 : 0), 760) - 40 - (cols - 1) * 10) / cols;

  async function run(key, fn, done) {
    setBusy(key);
    try { setP((await fn()).product); if (done) showToast(done, 'success'); } catch (e) { showToast(e.message); load(); } finally { setBusy(null); }
  }
  function add() {
    confirm({
      icon: 'camera', title: 'Add a photo', text: 'Border, pallu or blouse close-ups help customers.',
      actions: [
        { label: 'Take photo', kind: 'primary', onPress: () => choose('camera') },
        { label: 'Choose from gallery', onPress: () => choose('library') },
        { label: 'Cancel', kind: 'ghost' },
      ],
    });
  }
  async function choose(source) {
    try { const ph = await pickPhoto(source); if (ph) setCrop(ph); } catch (e) { showToast(e.message); }
  }
  function makeMain(img) {
    const ids = [img.id, ...p.images.filter((x) => x.id !== img.id).map((x) => x.id)];
    run(img.id, () => products.orderPhotos(id, ids), 'Main photo changed');
  }
  function remove(img) {
    if (p.images.length === 1) { showToast('A saree needs at least one photo. Add another first.'); return; }
    confirm({ tone: 'danger', icon: 'trash', title: 'Remove this photo?', text: 'It disappears from the website straight away.', actions: [{ label: 'Remove', kind: 'dangerSolid', onPress: () => run(img.id, () => products.deletePhoto(id, img.id), 'Photo removed') }, { label: 'Cancel' }] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}><TopBar title="Photos" onBack={() => router.back()} /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <T color="text2" style={{ marginBottom: 14 }}>Up to 5. The first is the main photo: the list, the website card and the PDF use it.</T>
        {error ? <Banner tone="error" title="Couldn't load" text={error.message} style={{ marginBottom: 12 }} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(p?.images || []).map((img, i) => (
            <View key={img.id} style={{ width: cellW, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden', opacity: busy === img.id ? 0.5 : 1 }}>
              <Image source={{ uri: img.url }} style={{ width: '100%', aspectRatio: 3 / 4 }} resizeMode="cover" />
              {i === 0 ? <View style={{ position: 'absolute', left: 5, top: 5 }}><Badge text="Main" tone="staff" /></View> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 4 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Make photo ${i + 1} the main one`} disabled={i === 0 || !!busy} onPress={() => makeMain(img)} hitSlop={6} style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}>
                  <Icon name="star" size={18} color={c.text2} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} disabled={!!busy} onPress={() => remove(img)} hitSlop={6} style={{ padding: 6 }}>
                  <Icon name="trash" size={18} color={c.text2} />
                </Pressable>
              </View>
            </View>
          ))}
          {p && p.images.length < 5 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Add photo" onPress={add} disabled={!!busy}
              style={{ width: cellW, aspectRatio: 3 / 4, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" color={c.primary} />
              <T variant="caption" color="primary">{busy === 'add' ? 'Adding…' : 'Add photo'}</T>
            </Pressable>
          ) : null}
        </View>
        <T variant="caption" color="muted" style={{ marginTop: 14 }}>Each photo is stored small (80 KB or less) with location removed.</T>
        <Button title="Done" kind="secondary" onPress={() => router.back()} style={{ marginTop: 18 }} />
      </ScrollView>
      {crop ? (
        <PhotoCropper photo={crop} ratio={CARD_RATIO} hint="Drag the photo so the saree sits inside the frame. This is the product card customers see on the website."
          note="Saved small (80 KB or less) with location data removed. Added as soon as you tap Use."
          onCancel={() => setCrop(null)} onDone={(uri) => { setCrop(null); run('add', () => products.addPhoto(id, uri), 'Photo added'); }} />
      ) : null}
    </View>
  );
}
