// Quick add (1–3 sarees): take the saree's photo, scan its tag, it's saved in the
// background, and the camera is ready for the next one. Same tag checks as the batch.
// A set (several identical sarees): set "Sarees in this photo", scan each tag; it saves
// after the last one (sets, 15 Oct 2026).
// With ?tag= (a new tag found by Scan to find) the tag is used for the first saree.
// Docs Module 4, section 5.2.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Icon } from '../../../../components/Icon';
import { useFeedback } from '../../../../components/Feedback';
import { ScanFrame, TagScanner } from '../../../../components/products/TagScanner';
import { TagEntryModal } from '../../../../components/products/TagEntryModal';
import { SetCount, SetTags } from '../../../../components/products/SetCount';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useOnline } from '../../../../hooks/useOnline';
import * as catalog from '../../../../api/catalog';
import * as products from '../../../../api/products';
import { fitToCard } from '../../../../products/photos';
import { pendingTags, queue } from '../../../../products/queue';
import { markSubUsed } from '../../../../products/recent';
import { channelText, MAX_SET, newRef, plural } from '../../../../utils/products';

export default function QuickAdd() {
  const { id, tag: givenTag, channel: givenChannel } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { confirm, showToast } = useFeedback();
  const camera = useRef(null);
  const [batchId] = useState(() => newRef('q'));
  const [sub, setSub] = useState(null);
  const [step, setStep] = useState('photo');
  const [photo, setPhoto] = useState(null);
  const [nextTag, setNextTag] = useState(givenTag || null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [flash, setFlash] = useState(null);
  const [torch, setTorch] = useState(false);
  const [tags, setTags] = useState([]); // this photo's tags so far (a set)
  const [want, setWant] = useState(1); // "Sarees in this photo"
  const channel = givenChannel || 'both';

  useEffect(() => { catalog.getSubcategory(id).then((r) => setSub(r.subcategory), () => {}); markSubUsed(id); }, [id]);

  const ask = (d) => {
    setAsking(true);
    confirm({ sticky: true, ...d, actions: d.actions.map((a) => ({ ...a, onPress: () => { setAsking(false); a.onPress?.(); } })) });
  };

  async function shoot() {
    if (busy || !camera.current) return;
    setBusy(true);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.9, exif: false });
      const uri = await fitToCard(shot.uri, { width: shot.width, height: shot.height, name: newRef('qp') });
      setPhoto(uri);
      setStep('tag');
      if (nextTag) { const t = nextTag; setNextTag(null); setBusy(false); accept(t, uri); return; }
    } catch (e) {
      showToast(e.message || 'Couldn\'t take the photo. Try again.');
    }
    setBusy(false);
  }

  async function accept(code, uri = photo) {
    if (busy || asking || !uri) return;
    if (tags.includes(code)) { showToast(`${code} is already on this photo. Scan the next saree's tag.`); return; }
    if (tags.length >= MAX_SET) { showToast(`Up to ${MAX_SET} tags on one photo.`); return; }
    if (pendingTags().has(code)) { ask({ tone: 'warning', icon: 'alert', title: `${code} is being saved`, text: 'That tag is on a saree that is uploading right now. Use a different tag.', actions: [{ label: 'Scan a different tag', kind: 'primary' }] }); return; }
    setBusy(true);
    let r;
    try { r = await products.checkTag(code); } catch (e) { r = e.code === 'NETWORK' || e.code === 'TIMEOUT' ? { status: 'free', unchecked: true } : { status: 'error', message: e.message }; }
    setBusy(false);
    if (r.status !== 'free') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      ask({ tone: 'warning', icon: 'alert', title: r.status === 'taken' ? `${code} is already used` : `${code} can't be used`, text: r.message, actions: [{ label: 'Scan a different tag', kind: 'primary' }] });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const next = [...tags, code];
    if (next.length >= want) { finish(uri, next); return; }
    setTags(next);
    setFlash(code);
    setTimeout(() => setFlash(null), 700);
  }

  // The photo has all its tags: saved in the background, the camera is ready for the next.
  function finish(uri, list) {
    queue.add([{ photoUri: uri, tags: list }], { batchId, subcategoryId: id, subcategoryName: sub?.name || '', channel });
    setCount((n) => n + list.length);
    setFlash(list.length > 1 ? `Set of ${list.length}` : list[0]);
    setTimeout(() => { setFlash(null); setPhoto(null); setStep('photo'); setTags([]); setWant(1); }, 800);
    showToast(online ? `Saving · ${list.length > 1 ? `a set of ${list.length}` : list[0]}` : 'Kept on this phone · uploads when online', 'success');
  }
  function changeWant(n) {
    if (n < tags.length) { showToast(`This photo has ${tags.length} tags. Take one off first (tap its ✕).`); return; }
    setWant(n);
    if (tags.length && n === tags.length) finish(photo, tags);
  }

  function done() {
    if (tags.length) {
      ask({
        icon: 'layers', title: `${tags.length} of ${want} tags scanned`, text: `Save this photo as a set of ${tags.length}, or keep scanning?`,
        actions: [
          { label: 'Keep scanning', kind: 'primary' },
          { label: tags.length > 1 ? `Save as a set of ${tags.length}` : 'Save as 1 saree', onPress: () => { finish(photo, tags); setTimeout(leave, 900); } },
          { label: 'Don\'t save this photo', kind: 'danger', onPress: leave },
        ],
      });
      return;
    }
    leave();
  }
  function leave() {
    router.back();
    if (count) setTimeout(() => showToast(`${plural(count, 'saree')} added to ${sub?.name || 'the subcategory'}`, 'success'), 300);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0d10' }}>
      <View style={{ backgroundColor: c.bg, paddingTop: insets.top }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={done} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" color={c.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" numberOfLines={1}>Quick add · {sub?.name || ''}</T>
            <T variant="caption" color="muted">{channelText(channel)} · {plural(count, 'saree')} added</T>
          </View>
          <Button title="Done" kind="ghost" small onPress={done} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 }}>
        {[['photo', '1 Photo'], ['tag', want > 1 ? '2 Tags' : '2 Tag']].map(([k, label]) => (
          <View key={k} style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: step === k ? '#fff' : 'rgba(255,255,255,0.14)' }}>
            <T variant="smallStrong" color={step === k ? '#111' : '#fff'}>{label}</T>
          </View>
        ))}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <TagScanner cameraRef={camera} mode={step === 'tag' ? 'scan' : 'photo'} onCode={(code) => accept(code)} paused={busy || asking || typing || !!flash} torch={torch} style={{ flex: 1 }}>
          {step === 'photo' ? (
            <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ height: '86%', aspectRatio: 3 / 4, maxWidth: '86%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 12, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }}>
                <T variant="caption" color="#fff">{nextTag ? `Tag ${nextTag} is ready: take the saree's photo` : 'Fit the whole saree in the frame'}</T>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 28 }}>
              <ScanFrame hint={busy ? 'Checking…' : want > 1 ? `Tag ${tags.length + 1} of ${want}: the next saree of the set` : 'Now scan this saree\'s tag'} style={{ width: '78%', alignSelf: 'center' }} />
            </View>
          )}
          {photo ? (
            <View style={{ position: 'absolute', left: 10, top: 10, width: '34%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', borderWidth: 3, borderColor: '#fff' }}>
              <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              {flash ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,122,71,0.45)', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={36} color="#fff" strokeWidth={3} /><T variant="smallStrong" color="#fff">{flash}</T></View> : null}
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Torch off' : 'Torch on'} onPress={() => setTorch((x) => !x)} style={{ position: 'absolute', right: 10, top: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: torch ? '#fff' : 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="flash" size={20} color={torch ? '#111' : '#fff'} />
          </Pressable>
        </TagScanner>
      </View>
      <View style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 14), gap: 10 }}>
        {step === 'photo' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={shoot} disabled={busy}
            style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : null}
          </Pressable>
        ) : (
          <>
          <SetCount value={want} scanned={tags.length} onChange={changeWant} dark />
          {tags.length ? <SetTags codes={tags} onRemove={(code) => setTags((x) => x.filter((t) => t !== code))} dark /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => { setPhoto(null); setStep('photo'); }} style={{ flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="camera" size={18} color="#fff" /><T variant="smallStrong" color="#fff">Retake</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setTyping(true)} style={{ flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="keyboard" size={18} color="#fff" /><T variant="smallStrong" color="#fff">Type</T>
            </Pressable>
          </View>
          </>
        )}
      </View>
      <TagEntryModal visible={typing} onClose={() => setTyping(false)} onSubmit={(code) => { setTyping(false); setTimeout(() => accept(code), 250); }} />
    </View>
  );
}
