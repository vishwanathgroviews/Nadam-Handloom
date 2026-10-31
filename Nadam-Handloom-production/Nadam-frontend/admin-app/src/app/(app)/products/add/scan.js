// Adding sarees, step 3: scan each saree's tag while its photo is shown (owner's pick B:
// the camera fills the screen, the photo sits in a card). One tag per saree (T1); a set
// of identical sarees shares one photo: "Sarees in this photo" says how many tags to
// scan, and the next photo comes after the last one (sets, 15 Oct 2026, pick A). A tag
// already used anywhere is caught the moment it's scanned (T2); Undo last and Skip;
// "Type" for a tag that won't scan (T6). Docs Module 4, sections 5.1, 6A and 6B.
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Icon } from '../../../../components/Icon';
import { useFeedback } from '../../../../components/Feedback';
import { TagChip } from '../../../../components/products/TagChip';
import { ScanFrame, TagScanner } from '../../../../components/products/TagScanner';
import { TagEntryModal } from '../../../../components/products/TagEntryModal';
import { SetCount, SetTags } from '../../../../components/products/SetCount';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { useOnline } from '../../../../hooks/useOnline';
import { batchStore, useBatch } from '../../../../products/batch';
import { pendingTags } from '../../../../products/queue';
import * as products from '../../../../api/products';
import { batchSummary, indexWithTag, itemDone, MAX_SET, nextIndex, tagsOf, wantOf } from '../../../../utils/products';

const PROBLEM = {
  taken: (code) => `${code} is already used`,
  sold: (code) => `${code} was sold`,
  retired: (code) => `${code} was retired`,
};

function PhotoPair({ left, right, leftLabel, rightLabel }) {
  const { c } = useTheme();
  const box = (uri, label) => (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ aspectRatio: 3 / 4, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface3 }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      </View>
      <T variant="caption" color="muted">{label}</T>
    </View>
  );
  return <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>{box(left, leftLabel)}{box(right, rightLabel)}</View>;
}

export default function ScanBatch() {
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const { confirm, showToast } = useFeedback();
  const batch = useBatch();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [flash, setFlash] = useState(null);
  const [hintAt, setHintAt] = useState(-1);
  const [torch, setTorch] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const strip = useRef(null);

  const cur = batch?.cur ?? 0;
  const item = batch?.items[cur];
  const tags = tagsOf(item);
  const want = wantOf(item);
  // "Can't read it?" appears after 12 seconds on a photo still waiting for a tag.
  useEffect(() => {
    if (!item || itemDone(item)) return undefined;
    const t = setTimeout(() => setHintAt(cur), 12000);
    return () => clearTimeout(t);
  }, [cur, item]);
  useEffect(() => { strip.current?.scrollTo({ x: Math.max(0, cur * 50 - 120), animated: true }); }, [cur]);

  if (!batch) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 40, padding: 24, gap: 12 }}>
        <T variant="heading">No photos waiting</T>
        <T color="text2">This batch is finished or was closed. Start a new one from a subcategory.</T>
        <Button title="Back to Products" onPress={() => router.dismissTo('/products')} />
      </View>
    );
  }

  const sum = batchSummary(batch.items);
  // Questions stop the camera until they're answered.
  const ask = (d) => {
    setAsking(true);
    confirm({ sticky: true, ...d, actions: d.actions.map((a) => ({ ...a, onPress: () => { setAsking(false); a.onPress?.(); } })) });
  };

  // Puts a tag on photo i (replace: instead of its tag). The next photo comes once the
  // photo has all its tags.
  function assign(i, code, unchecked, { replace = false, want } = {}) {
    batchStore.update((b) => ({
      ...b,
      items: b.items.map((x, k) => (k === i ? { ...x, tags: replace ? [code] : [...tagsOf(x), code], want: want ?? wantOf(x), unchecked: !!unchecked || (!replace && !!x.unchecked), skipped: false } : x)),
      undo: [...b.undo.filter((u) => !(replace && u.i === i)), { i, code }],
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFlash({ i, code });
    setTimeout(() => {
      setFlash(null);
      const b = batchStore.getState().batch;
      if (b && itemDone(b.items[i])) moveOn(i);
    }, 700);
  }
  function moveOn(i) {
    const b = batchStore.getState().batch;
    if (!b) return;
    const k = nextIndex(b.items, i);
    if (k < 0) {
      router.push('/products/add/review');
      showToast(`All ${b.items.length} photos tagged. Check them, then save.`, 'success');
      return;
    }
    if (b.items[k].skipped && !b.items.some((x) => !itemDone(x) && !x.skipped)) showToast('Back to the skipped photos');
    batchStore.update((x) => ({ ...x, cur: k }));
  }
  // Takes one tag off photo i (✕ on a tag, Undo last, or the tag moved to another photo).
  const takeOff = (b, i, code) => ({
    ...b,
    items: b.items.map((y, k) => (k === i ? { ...y, tags: tagsOf(y).filter((t) => t !== code), unchecked: tagsOf(y).length > 1 && !!y.unchecked } : y)),
    undo: b.undo.filter((u) => !(u.i === i && u.code === code)),
  });
  // "Sarees in this photo": never fewer than the tags already on it.
  function setWant(n) {
    const b = batchStore.getState().batch;
    const i = b.cur;
    const have = tagsOf(b.items[i]).length;
    if (n < have) { showToast(`This photo has ${have} tags. Take one off first (tap its ✕).`); return; }
    batchStore.update((x) => ({ ...x, items: x.items.map((y, k) => (k === i ? { ...y, want: n } : y)) }));
    if (have && n === have) setTimeout(() => moveOn(i), 400);
  }

  async function onCode(code) {
    if (busy || asking || flash) return;
    const b = batchStore.getState().batch;
    const i = b.cur;
    const it = b.items[i];
    const has = tagsOf(it);
    if (has.includes(code)) { showToast(has.length > 1 ? `${code} is already on this photo. Scan the next saree's tag.` : `${code} is already this saree's tag`); return; }
    const other = indexWithTag(b.items, code, i);
    if (other >= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      ask({
        tone: 'warning', icon: 'alert', title: 'Already used in this batch', text: `You already gave ${code} to photo ${other + 1}. Each saree needs its own tag.`,
        content: <PhotoPair left={it.uri || it.src} right={b.items[other].uri || b.items[other].src} leftLabel={`This photo (${i + 1})`} rightLabel={`Photo ${other + 1} has ${code}`} />,
        actions: [
          { label: 'Scan a different tag', kind: 'primary' },
          { label: 'Move it to this photo', onPress: () => {
            batchStore.update((x) => takeOff(x, other, code));
            onFree(i, code, false);
            setTimeout(() => showToast(`Photo ${other + 1} now needs a tag`), 900);
          } },
        ],
      });
      return;
    }
    if (pendingTags().has(code)) {
      ask({ tone: 'warning', icon: 'alert', title: `${code} is being saved`, text: `${code} is on a saree that is uploading right now. Use a different tag.`, actions: [{ label: 'Scan a different tag', kind: 'primary' }] });
      return;
    }
    setBusy(true);
    let r;
    try {
      r = await products.checkTag(code);
    } catch (e) {
      // No internet: keep going; the server checks it again when it uploads.
      if (e.code === 'NETWORK' || e.code === 'TIMEOUT') r = { code, status: 'free', unchecked: true };
      else { setBusy(false); showToast(e.message); return; }
    }
    setBusy(false);
    if (r.status === 'invalid') { showToast('That doesn\'t look like a tag. Scan again or type it.'); return; }
    if (r.status !== 'free') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      ask({
        tone: 'warning', icon: 'alert', title: PROBLEM[r.status](code),
        text: r.status === 'taken' ? 'Each tag can be on only one saree. Is this the right tag for this saree?' : r.message,
        content: r.product ? <PhotoPair left={it.uri || it.src} right={r.product.imageUrl} leftLabel="This photo" rightLabel={`${{ sold: 'Sold', retired: 'Was on' }[r.status] || 'Already on'}: ${r.product.name} · ${r.product.sku}`} /> : null,
        actions: [{ label: 'Scan a different tag', kind: 'primary' }, ...(r.product && r.status === 'taken' ? [{ label: 'Open that saree', onPress: () => router.push(`/products/${r.product.productId}`) }] : [])],
      });
      return;
    }
    onFree(i, code, r.unchecked);
  }
  // A free tag for photo i: a one-saree photo that has its tag asks (wrong tag, or a
  // set?); a set that has all its tags asks whether there is one more.
  function onFree(i, code, unchecked) {
    const it = batchStore.getState().batch.items[i];
    const has = tagsOf(it);
    const w = wantOf(it);
    if (has.length >= MAX_SET) { showToast(`Up to ${MAX_SET} tags on one photo.`); return; }
    if (has.length && w === 1) {
      ask({
        icon: 'barcode', title: 'This photo already has a tag',
        content: (
          <View style={{ marginTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}><TagChip code={has[0]} tone="sold" big /><Icon name="right" size={18} color={c.muted} /><TagChip code={code} tone="ok" big /></View>
            <T variant="small" color="text2">Wrong tag? Replace {has[0]} with {code}. Or are there 2 sarees of this design in the photo? Keep both.</T>
          </View>
        ),
        actions: [
          { label: `Replace with ${code}`, kind: 'primary', onPress: () => assign(i, code, unchecked, { replace: true }) },
          { label: 'A set: keep both', onPress: () => assign(i, code, unchecked, { want: 2 }) },
          { label: `Keep ${has[0]}`, kind: 'ghost' },
        ],
      });
      return;
    }
    if (has.length >= w) {
      ask({
        icon: 'layers', title: `Photo ${i + 1} has its ${w} tags`,
        text: `You said ${w} sarees for this photo, and all ${w} are scanned. Is there one more?`,
        actions: [
          { label: `Make it a set of ${w + 1}`, kind: 'primary', onPress: () => assign(i, code, unchecked, { want: w + 1 }) },
          { label: 'No, it\'s for another photo', onPress: () => moveOn(i) },
          { label: 'Cancel', kind: 'ghost' },
        ],
      });
      return;
    }
    assign(i, code, unchecked);
  }

  function undo() {
    const b = batchStore.getState().batch;
    const last = [...b.undo].reverse().find((u) => tagsOf(b.items[u.i]).includes(u.code));
    if (!last) return;
    batchStore.update((x) => ({ ...takeOff(x, last.i, last.code), cur: last.i }));
    showToast(`${last.code} taken off photo ${last.i + 1}. Scan the right tag.`);
  }
  function removeTag(code) {
    const i = batchStore.getState().batch.cur;
    batchStore.update((x) => takeOff(x, i, code));
    showToast(`${code} taken off photo ${i + 1}`);
  }
  function skip() {
    const b = batchStore.getState().batch;
    const i = b.cur;
    const items = b.items.map((y, k) => (k === i ? { ...y, skipped: true } : y));
    const k = nextIndex(items, i);
    if (k < 0 || k === i) { showToast('This is the only photo left without its tags'); return; }
    batchStore.update((x) => ({ ...x, items, cur: k }));
    showToast('Skipped. It comes back at the end.');
  }
  function stop() {
    ask({
      icon: 'layers', title: 'Stop for now?',
      text: sum.tagged ? `${sum.tagged} of ${sum.total} photos have tags. They stay as a draft on this phone; continue any time from Products.` : 'Nothing is tagged yet. Close this batch?',
      actions: sum.tagged
        ? [{ label: 'Continue scanning', kind: 'primary' }, { label: 'Keep as draft and close', onPress: () => router.dismissTo('/products') }, { label: 'Discard this batch', kind: 'danger', onPress: () => { batchStore.discard(); router.dismissTo('/products'); } }]
        : [{ label: 'Continue scanning', kind: 'primary' }, { label: 'Close', onPress: () => { batchStore.discard(); router.dismissTo('/products'); } }],
    });
  }

  // The photo card: 44% of the camera's width, never taller than the camera area.
  const cardW = Math.max(90, Math.min(area.width * 0.44, (area.height - 20) * 0.75));
  const photoUri = item?.uri || item?.src;
  const light = { bg: 'rgba(255,255,255,0.14)', border: 'rgba(255,255,255,0.3)' };
  const ctrl = (icon, label, onPress, disabled) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled}
      style={{ flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: light.border, backgroundColor: light.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: disabled ? 0.4 : 1 }}>
      <Icon name={icon} size={18} color="#fff" />
      <T variant="smallStrong" color="#fff">{label}</T>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0d10' }}>
      <View style={{ backgroundColor: c.bg, paddingTop: insets.top }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop" onPress={stop} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" color={c.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" numberOfLines={1}>{batch.sub.name}</T>
            <T variant="caption" color="muted">Photo {cur + 1} of {sum.total} · {sum.done} done{sum.sets ? ` · ${sum.sarees} tags` : ''}{online ? '' : ' · offline'}</T>
          </View>
          <Button title="Review" kind="ghost" small onPress={() => router.push('/products/add/review')} />
        </View>
        <View style={{ height: 4, backgroundColor: c.surface3, marginHorizontal: 16, marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ width: `${(sum.done / sum.total) * 100}%`, height: '100%', backgroundColor: c.success }} />
        </View>
      </View>

      <View style={{ flex: 1, padding: 10 }} onLayout={(e) => setArea(e.nativeEvent.layout)}>
        <TagScanner onCode={onCode} paused={busy || asking || typing || !!flash} torch={torch} zoom={zoomed ? 0.3 : 0} style={{ flex: 1 }}>
          <View style={{ flex: 1, flexDirection: tablet ? 'row' : 'column', justifyContent: tablet ? 'flex-end' : 'flex-end', alignItems: tablet ? 'center' : 'stretch', padding: tablet ? '5%' : 16, paddingBottom: tablet ? '5%' : 28 }}>
            <ScanFrame hint={busy ? 'Checking…' : want > 1 ? (tags.length >= want ? `All ${want} tags scanned` : `Tag ${tags.length + 1} of ${want}: the next saree of the set`) : tags.length ? `Scan again only to replace ${tags[0]}` : 'Point at the tag of this saree'} style={{ width: tablet ? '44%' : '78%', alignSelf: 'center' }} />
          </View>
          <View style={{ position: 'absolute', left: 10, top: 10, width: cardW, aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', borderWidth: 3, borderColor: '#fff', backgroundColor: '#222' }}>
            {photoUri ? <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Photo ${cur + 1} of ${sum.total}`} /> : null}
            <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <T variant="caption" color="#fff">Photo {cur + 1} of {sum.total}</T>
            </View>
            {want > 1 ? (
              <View style={{ position: 'absolute', right: 6, top: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Icon name="layers" size={12} color={c.onPrimary} /><T variant="caption" color={c.onPrimary}>Set of {want}</T>
              </View>
            ) : null}
            {item?.lost ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 8 }}><T variant="caption" color="#fff" style={{ textAlign: 'center' }}>This photo is gone from the phone. Take it out in Review.</T></View> : null}
            {flash?.i === cur ? (
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(23,122,71,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#177A47', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}>
                  <Icon name="check" size={18} color="#fff" strokeWidth={3} /><T variant="bodyStrong" color="#fff">{flash.code}</T>
                </View>
              </View>
            ) : null}
          </View>
          <View style={{ position: 'absolute', right: 10, top: 10, gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Torch off' : 'Torch on'} onPress={() => setTorch((x) => !x)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: torch ? '#fff' : 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Icon name="flash" size={20} color={torch ? '#111' : '#fff'} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={zoomed ? 'Zoom out' : 'Zoom in for small tags'} onPress={() => setZoomed((x) => !x)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: zoomed ? '#fff' : 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Icon name="zoom" size={20} color={zoomed ? '#111' : '#fff'} /></Pressable>
          </View>
        </TagScanner>
      </View>

      <View style={{ paddingHorizontal: 10, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
        <SetCount value={want} scanned={tags.length} onChange={setWant} dark />
        {want === 1 && tags.length === 1 ? <View style={{ alignItems: 'center' }}><TagChip code={item.unchecked ? `${tags[0]} · checked when online` : tags[0]} tone={item.unchecked ? 'wait' : 'ok'} big /></View> : null}
        {want > 1 || tags.length > 1 ? <SetTags codes={tags} onRemove={removeTag} dark /> : null}
        {hintAt === cur && !itemDone(item) ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: radius.md, backgroundColor: c.warningSoft }}>
            <Icon name="alert" size={18} color={c.warning} />
            <T variant="small" color={c.warning} style={{ flex: 1 }}>Can&apos;t read this tag? Wipe the lens, hold the phone a hand&apos;s width away, try Zoom, or type the number.</T>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ctrl('undo', 'Undo last', undo, !batch.undo.some((u) => tagsOf(batch.items[u.i]).includes(u.code)))}
          {ctrl('keyboard', 'Type', () => setTyping(true))}
          {ctrl('skip', 'Skip', skip)}
        </View>
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {batch.items.map((x, i) => {
            const n = tagsOf(x).length;
            const w = wantOf(x);
            const ok = n > 0 && n >= w;
            return (
              <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`Photo ${i + 1}${n ? `, ${n} of ${w} tag${w > 1 ? 's' : ''}` : x.skipped ? ', skipped' : ', no tag yet'}`} onPress={() => batchStore.update((b) => ({ ...b, cur: i }))}
                style={{ width: 44, height: 58, borderRadius: 7, overflow: 'hidden', borderWidth: 2, borderColor: i === cur ? c.primary : 'transparent', backgroundColor: '#222' }}>
                {x.uri || x.src ? <Image source={{ uri: x.uri || x.src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                {w > 1 || n > 1 ? (
                  <View style={{ position: 'absolute', right: 2, bottom: 2, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: ok ? '#177A47' : '#A35F0A', alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ fontSize: 10, lineHeight: 14, fontFamily: 'PlusJakartaSans_700Bold' }} color="#fff">{n}/{w}</T>
                  </View>
                ) : n || x.skipped ? (
                  <View style={{ position: 'absolute', right: 2, bottom: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: n ? '#177A47' : '#A35F0A', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={n ? 'check' : 'skip'} size={10} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <TagEntryModal visible={typing} onClose={() => setTyping(false)} onSubmit={(code) => { setTyping(false); setTimeout(() => onCode(code), 250); }} />
    </View>
  );
}
