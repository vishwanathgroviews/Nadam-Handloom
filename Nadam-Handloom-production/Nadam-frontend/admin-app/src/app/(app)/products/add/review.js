// Adding sarees, step 4: check every photo with its tags before saving (a set shows
// every tag). Tap one to scan or type a tag, change "Sarees in this photo", take a tag
// off, adjust the photo, or take it out. Save sends the tagged ones to the upload queue;
// photos without a tag stay as a draft.
// Docs Module 4, sections 5.1 and 7.3.
import { useState } from 'react';
import { FlatList, Image, Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Badge } from '../../../../components/Bits';
import { useFeedback } from '../../../../components/Feedback';
import { TagChip } from '../../../../components/products/TagChip';
import { TagEntryModal } from '../../../../components/products/TagEntryModal';
import { SetCount, SetTags } from '../../../../components/products/SetCount';
import { Icon } from '../../../../components/Icon';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { batchStore, useBatch } from '../../../../products/batch';
import { fitToCard } from '../../../../products/photos';
import { pendingTags, queue } from '../../../../products/queue';
import * as products from '../../../../api/products';
import { batchSummary, channelText, indexWithTag, itemDone, MAX_SET, plural, tagsOf, wantOf } from '../../../../utils/products';

// One photo's tags and count, live in the sheet (it re-reads the batch).
function PhotoTags({ i, showToast }) {
  const b = useBatch();
  const it = b?.items[i];
  if (!it) return null;
  const tags = tagsOf(it);
  const want = wantOf(it);
  const setWant = (n) => {
    if (n < tags.length) { showToast(`This photo has ${tags.length} tags. Take one off first (tap its ✕).`); return; }
    batchStore.update((x) => ({ ...x, items: x.items.map((y, k) => (k === i ? { ...y, want: n } : y)) }));
  };
  const remove = (code) => batchStore.update((x) => ({
    ...x,
    items: x.items.map((y, k) => (k === i ? { ...y, tags: tagsOf(y).filter((t) => t !== code), unchecked: tagsOf(y).length > 1 && !!y.unchecked } : y)),
    undo: x.undo.filter((u) => !(u.i === i && u.code === code)),
  }));
  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      {tags.length ? <SetTags codes={tags} onRemove={remove} center={false} unchecked={it.unchecked} /> : <TagChip code="No tag yet" tone="bad" />}
      {it.unchecked ? <T variant="caption" color="muted">Scanned offline: checked against the shop when the internet is back.</T> : null}
      <SetCount value={want} scanned={tags.length} onChange={setWant} />
    </View>
  );
}

export default function Review() {
  const { c } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { confirm, showToast } = useFeedback();
  const batch = useBatch();
  const [typingFor, setTypingFor] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!batch) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 40, padding: 24, gap: 12 }}>
        <T variant="heading">Nothing to check</T>
        <Button title="Back to Products" onPress={() => router.dismissTo('/products')} />
      </View>
    );
  }
  const sum = batchSummary(batch.items);
  const cols = tablet ? 5 : 3;
  const cellW = (Math.min(width - (tablet ? 96 : 0), 900) - 32 - (cols - 1) * 8) / cols;

  function sheet(i) {
    const it = batch.items[i];
    const tags = tagsOf(it);
    const set = wantOf(it) > 1;
    confirm({
      icon: set ? 'layers' : 'image', title: `Photo ${i + 1}`, content: <PhotoTags i={i} showToast={showToast} />,
      actions: [
        { label: set ? 'Scan more tags' : tags.length ? 'Change tag (scan)' : 'Scan its tag', kind: 'primary', onPress: () => { batchStore.update((b) => ({ ...b, cur: i })); router.back(); } },
        { label: set ? 'Type a tag number' : 'Type the number', onPress: () => setTimeout(() => setTypingFor(i), 300) },
        ...(it.lost ? [] : [{ label: 'Adjust photo', onPress: () => router.push(`/products/add/adjust?item=${it.id}`) }]),
        { label: 'Take out of this batch', kind: 'danger', onPress: () => setTimeout(() => takeOut(i), 350) },
        { label: 'Close', kind: 'ghost' },
      ],
    });
  }
  function takeOut(i) {
    const it = batch.items[i];
    confirm({
      tone: 'danger', icon: 'trash', title: `Take photo ${i + 1} out?`, text: tagsOf(it).length ? `${tagsOf(it).length > 1 ? `Its ${tagsOf(it).length} tags stay` : `Its tag ${tagsOf(it)[0]} stays`} free for other sarees. The photo stays in your gallery.` : 'It won\'t be saved. The photo stays in your gallery.',
      actions: [{ label: 'Take it out', kind: 'dangerSolid', onPress: () => {
        batchStore.update((b) => {
          const items = b.items.filter((_, k) => k !== i);
          return { ...b, items, cur: Math.min(b.cur, Math.max(0, items.length - 1)), undo: b.undo.filter((u) => u.i !== i).map((u) => (u.i > i ? { ...u, i: u.i - 1 } : u)) };
        });
        if (batch.items.length === 1) { batchStore.discard(); router.dismissTo('/products'); }
      } }, { label: 'Cancel' }],
    });
  }
  async function typed(i, code) {
    setTypingFor(null);
    const it = batchStore.getState().batch.items[i];
    const has = tagsOf(it);
    if (has.includes(code)) { showToast(`${code} is already on this photo`); return; }
    if (has.length >= MAX_SET) { showToast(`Up to ${MAX_SET} tags on one photo.`); return; }
    const other = indexWithTag(batch.items, code, i);
    if (other >= 0) { showToast(`${code} is on photo ${other + 1}. Each saree needs its own tag.`); return; }
    if (pendingTags().has(code)) { showToast(`${code} is on a saree being saved right now.`); return; }
    let r;
    try { r = await products.checkTag(code); } catch (e) { r = e.code === 'NETWORK' || e.code === 'TIMEOUT' ? { status: 'free', unchecked: true } : { status: 'error', message: e.message }; }
    if (r.status !== 'free') { confirm({ tone: 'warning', icon: 'alert', title: `${code} can't be used`, text: r.message, actions: [{ label: 'OK', kind: 'primary' }] }); return; }
    // A one-saree photo's tag is replaced; a set gets one more (its count grows if needed).
    const replace = wantOf(it) === 1 && has.length === 1;
    batchStore.update((b) => ({
      ...b,
      items: b.items.map((x, k) => {
        if (k !== i) return x;
        const tags = replace ? [code] : [...tagsOf(x), code];
        return { ...x, tags, want: Math.max(wantOf(x), tags.length), unchecked: !!r.unchecked || (!replace && !!x.unchecked), skipped: false };
      }),
      undo: [...b.undo.filter((u) => !(replace && u.i === i)), { i, code }],
    }));
    showToast(replace ? `Photo ${i + 1}: ${has[0]} → ${code}` : `Photo ${i + 1}: ${code} added`, 'success');
  }

  function save() {
    if (!sum.tagged) return;
    const short = batch.items.findIndex((x) => tagsOf(x).length && !itemDone(x));
    if (short >= 0) {
      const x = batch.items[short];
      const have = tagsOf(x).length;
      const want = wantOf(x);
      confirm({
        tone: 'warning', icon: 'layers', title: `Photo ${short + 1}: ${have} of ${want} tags`,
        text: `You said ${want} sarees for this photo but scanned ${have}. Scan the other ${want - have}, or save it as a set of ${have}?`,
        actions: [
          { label: `Scan the other ${want - have}`, kind: 'primary', onPress: () => { batchStore.update((b) => ({ ...b, cur: short })); router.back(); } },
          { label: have > 1 ? `Save it as a set of ${have}` : 'Save it as 1 saree', onPress: () => { batchStore.update((b) => ({ ...b, items: b.items.map((y, k) => (k === short ? { ...y, want: have } : y)) })); setTimeout(save, 350); } },
          { label: 'Cancel', kind: 'ghost' },
        ],
      });
      return;
    }
    if (sum.missing) {
      confirm({
        tone: 'warning', icon: 'alert', title: `${plural(sum.missing, 'photo has', 'photos have')} no tag`, text: `Save the ${plural(sum.sarees, 'tagged saree')} now? The other photo${sum.missing > 1 ? 's stay' : ' stays'} here as a draft, to scan later.`,
        actions: [
          { label: 'Go back and scan', kind: 'primary', onPress: () => { const k = batch.items.findIndex((x) => !tagsOf(x).length); batchStore.update((b) => ({ ...b, cur: k })); router.back(); } },
          { label: `Save ${sum.sarees}, keep ${sum.missing} as draft`, onPress: send },
        ],
      });
      return;
    }
    send();
  }
  async function send() {
    setSaving(true);
    try {
      const b = batchStore.getState().batch;
      const tagged = b.items.filter((x) => tagsOf(x).length && !x.lost);
      const ready = [];
      for (const x of tagged) {
        const uri = x.uri || await fitToCard(x.src, { width: x.w, height: x.h, shift: x.shift || 0, name: x.id });
        ready.push({ photoUri: uri, tags: tagsOf(x) });
      }
      queue.add(ready, { batchId: b.id, subcategoryId: b.sub.id, subcategoryName: b.sub.name, channel: b.channel });
      batchStore.keepUntagged();
      // The camera steps leave the back history; a leftover draft waits on the Products tab.
      if (router.canDismiss()) router.dismissAll();
      router.push(`/products/add/saving?batch=${b.id}`);
    } catch (e) {
      showToast(e.message || 'Couldn\'t prepare the photos.');
    } finally { setSaving(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 900, alignSelf: 'center' }}>
        <TopBar title="Check before saving" onBack={() => router.back()} />
      </View>
      <FlatList
        data={batch.items}
        numColumns={cols}
        key={cols}
        keyExtractor={(x) => x.id}
        columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
        ListHeaderComponent={(
          <View style={{ marginBottom: 10, gap: 8 }}>
            <T variant="small" color="muted">{batch.sub.name}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Badge text={plural(sum.total, 'photo')} />
              <Badge text={plural(sum.sarees, 'saree')} tone="success" />
              {sum.sets ? <Badge text={plural(sum.sets, 'set')} tone="owner" /> : null}
              {sum.short ? <Badge text={`${plural(sum.short, 'set')} not finished`} tone="warning" /> : null}
              {sum.missing ? <Badge text={`${sum.missing} need${sum.missing === 1 ? 's' : ''} a tag`} tone="danger" /> : null}
              {sum.unchecked ? <Badge text={`${sum.unchecked} checked when online`} tone="warning" /> : null}
              <Badge text={channelText(batch.channel)} tone="neutral" />
            </View>
            <T variant="caption" color="muted">Each tag is one saree. A photo with several tags is a set: one listing, that many in stock. Tap a photo to change its tags, fix the photo, or take it out. Nothing is saved yet.</T>
          </View>
        )}
        renderItem={({ item: x, index: i }) => {
          const tags = tagsOf(x);
          const want = wantOf(x);
          const short = tags.length > 0 && tags.length < want;
          const shown = tags.length > 6 ? tags.slice(0, 5) : tags;
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`Photo ${i + 1}, ${tags.length ? `${plural(tags.length, 'tag')}: ${tags.join(', ')}` : 'no tag'}`} onPress={() => sheet(i)}
              style={{ width: cellW, borderRadius: 10, borderWidth: 2, borderColor: !tags.length ? c.danger : short || x.unchecked ? c.warning : want > 1 ? c.primary : c.border, backgroundColor: c.surface, overflow: 'hidden' }}>
              <View style={{ aspectRatio: 3 / 4, backgroundColor: c.surface3 }}>
                {x.uri || x.src ? <Image source={{ uri: x.uri || x.src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
                <View style={{ position: 'absolute', left: 4, top: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 7 }}><T variant="caption" color="#fff">{i + 1}</T></View>
                {want > 1 || tags.length > 1 ? (
                  <View style={{ position: 'absolute', right: 4, top: 4, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 6 }}>
                    <Icon name="layers" size={11} color={c.onPrimary} /><T variant="caption" color={c.onPrimary}>{short ? `${tags.length}/${want}` : tags.length}</T>
                  </View>
                ) : null}
              </View>
              <View style={{ padding: 5, alignItems: 'center', gap: 3 }}>
                {tags.length ? shown.map((t) => <TagChip key={t} code={t} tone={x.unchecked || short ? 'wait' : 'ok'} />) : <TagChip code={x.lost ? 'Photo gone' : 'No tag'} tone="bad" />}
                {shown.length < tags.length ? <T variant="caption" color="muted">+{tags.length - shown.length} more</T> : null}
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingTop: 4, width: '100%', maxWidth: 900, alignSelf: 'center' }}
      />
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 10, borderTopWidth: 1, borderTopColor: c.border, width: '100%', maxWidth: 900, alignSelf: 'center' }}>
        <Button title={`Save ${plural(sum.sarees, 'saree')}${sum.sets ? ` · ${plural(sum.tagged, 'photo')}` : ''}`} icon="upload" loading={saving} disabled={!sum.tagged} onPress={save} />
        <Button title={sum.missing ? `Scan the missing tag${sum.missing > 1 ? 's' : ''}` : 'Back to scanning'} icon="barcode" kind="secondary" onPress={() => router.back()} />
      </View>
      <TagEntryModal visible={typingFor !== null} title={typingFor !== null ? `Tag for photo ${typingFor + 1}` : ''} onClose={() => setTypingFor(null)} onSubmit={(code) => typed(typingFor, code)} />
    </View>
  );
}
