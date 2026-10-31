// The photo row on the category and subcategory forms: current or new photo, and
// Add / Change (camera or library, then the crop). Nothing uploads until Save.
// A category is a tall card at the top of the website's home page (3:4, like a saree card,
// 27 Oct 2026): its camera shows that frame, and the crop has no "whole photo". A
// subcategory is a landscape tile (4:3).
import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useFeedback } from '../Feedback';
import { Button } from '../Button';
import { T } from '../T';
import { Thumb } from './Thumb';
import { PhotoCropper } from './PhotoCropper';
import { PhotoCamera } from './PhotoCamera';
import { TILE_RATIO, pickPhoto } from '../../utils/photo';
import { CARD_RATIO } from '../../utils/products';

export const PHOTO_SHAPES = {
  card: {
    ratio: CARD_RATIO, thumb: { width: 54, height: 72 }, framedCamera: true, allowWhole: false, smallBelow: 800,
    seen: 'Customers see it as a tall card at the top of the website\'s home page.',
    current: 'Customers see it as a tall card on the home page',
    hint: 'Drag the photo so the important part sits inside the frame. This is the card customers see on the website\'s home page.',
  },
  tile: {
    ratio: TILE_RATIO, thumb: { width: 72, height: 54 }, framedCamera: false, allowWhole: true, smallBelow: 0,
    seen: 'Customers see it as a landscape tile on the website.',
    current: 'Customers see it as a landscape tile',
    hint: undefined,
  },
};

export function PhotoField({ currentUrl, stagedUri, onStaged, shape = 'tile' }) {
  const { c, radius } = useTheme();
  const { confirm, showToast } = useFeedback();
  const [picked, setPicked] = useState(null);
  const [camera, setCamera] = useState(false);
  const s = PHOTO_SHAPES[shape];
  const shown = stagedUri || currentUrl;
  const settle = () => new Promise((r) => setTimeout(r, 350)); // let a dialog finish closing (iPhone can't open a picker or another screen over it)

  async function choose(source) {
    try {
      await settle();
      if (source === 'camera' && s.framedCamera) { setCamera(true); return; }
      const p = await pickPhoto(source);
      if (p) setPicked(p);
    } catch (e) {
      showToast(e.message);
    }
  }
  async function shot(p) {
    setCamera(false);
    await settle();
    setPicked(p);
  }
  function ask() {
    confirm({
      icon: 'camera', title: shown ? 'Change the photo' : 'Add a photo', text: s.seen,
      actions: [{ label: 'Take photo', kind: 'primary', onPress: () => choose('camera') }, { label: 'Choose from library', onPress: () => choose('library') }, { label: 'Cancel', kind: 'ghost' }],
    });
  }

  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <T variant="smallStrong" color="text2">Photo</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
        <Thumb uri={shown} width={s.thumb.width} height={s.thumb.height} />
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong">{stagedUri ? 'New photo ready' : currentUrl ? 'Current photo' : 'No photo yet'}</T>
          <T variant="caption" color="muted">{stagedUri ? 'Uploads when you press Save' : currentUrl ? s.current : 'The website shows an empty box without one'}</T>
        </View>
        <Button title={shown ? 'Change' : 'Add'} icon="camera" kind="secondary" small onPress={ask} />
      </View>
      {camera ? <PhotoCamera ratio={s.ratio} onCancel={() => setCamera(false)} onShot={shot} /> : null}
      {picked ? (
        <PhotoCropper photo={picked} ratio={s.ratio} hint={s.hint} allowWhole={s.allowWhole} smallBelow={s.smallBelow}
          onCancel={() => setPicked(null)} onDone={(uri) => { setPicked(null); onStaged(uri); }} />
      ) : null}
    </View>
  );
}
