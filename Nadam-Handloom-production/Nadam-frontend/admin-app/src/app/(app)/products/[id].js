// A saree (owners and staff): photos, its tag (or a set's tags) and what can be done
// with each (change a wrong tag, replace a damaged tag, saree damaged), Add more tags
// (more of the same design), price from the subcategory, where it sells, Best Seller,
// details, move, history, delete (never erased).
// Docs Module 4, sections 6A and 7.4.
import { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../hooks/useBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { Badge, Card, Row, SectionLabel } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { useFeedback } from '../../../components/Feedback';
import { TagChip } from '../../../components/products/TagChip';
import { ScanTagModal } from '../../../components/products/ScanTagModal';
import { AddTagsModal } from '../../../components/products/AddTagsModal';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import * as products from '../../../api/products';
import { CHANNELS, channelText, stockBadge, tagLockReason, tagStatusText } from '../../../utils/products';
import { discountPercent, rupees } from '../../../utils/catalog';

const PROBLEM_TITLE = { taken: 'is already used', sold: 'was sold', retired: 'was retired', invalid: 'doesn\'t look like a tag' };
const dayTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Saree() {
  const goBack = useBack();
  const { id } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { confirm, showToast } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scan, setScan] = useState(null); // { kind: 'change' | 'replace', tag, error, busy }
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await products.getProduct(id)); } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const p = data?.product;

  // Runs a change and shows the saree as the server now has it.
  async function act(fn, done) {
    try {
      setData(await fn());
      if (done) showToast(done, 'success');
    } catch (e) {
      confirm({ tone: 'warning', icon: 'alert', title: 'Couldn\'t do that', text: e.message, actions: [{ label: 'OK', kind: 'primary' }] });
      load();
    }
  }

  function tagSheet(t) {
    const [label] = tagStatusText(t);
    const lock = tagLockReason(t);
    const a = t.actions;
    const actions = [];
    if (a.backInStock) actions.push({ label: 'Back in stock', kind: 'primary', onPress: () => act(() => products.backInStock(p.id, t.id), 'Back in stock · selling again') });
    if (a.change) actions.push({ label: 'Change tag (wrong tag)', kind: 'primary', onPress: () => setTimeout(() => setScan({ kind: 'change', tag: t }), 300) });
    if (a.replace) actions.push({ label: 'Tag damaged: put on a new tag', onPress: () => setTimeout(() => setScan({ kind: 'replace', tag: t }), 300) });
    if (a.damaged) actions.push({ label: 'Saree damaged: not for sale', kind: 'danger', onPress: () => setTimeout(() => sareeDamaged(t), 350) });
    if (a.remove) actions.push({ label: 'Remove this tag', kind: 'danger', onPress: () => setTimeout(() => removeTag(t), 350) });
    actions.push({ label: 'Close', kind: 'ghost' });
    confirm({ icon: 'barcode', title: t.code, text: label, content: lock ? <Banner tone="info" icon="lock" text={lock} style={{ marginTop: 12 }} /> : null, actions });
  }

  function sareeDamaged(t) {
    confirm({
      tone: 'danger', icon: 'alertc', title: 'Saree damaged?', text: `It stops selling: off the website and the counter. Its tag ${t.code} stays with it. You can undo this with Back in stock.`,
      actions: [{ label: 'Mark damaged', kind: 'dangerSolid', onPress: () => act(() => products.markDamaged(p.id, t.id), 'Marked damaged · not for sale') }, { label: 'Cancel' }],
    });
  }
  function removeTag(t) {
    confirm({
      tone: 'danger', icon: 'trash', title: `Remove ${t.code}?`, text: `Only if this tag was added to this listing by mistake. ${t.code} becomes free to use on another saree.`,
      actions: [{ label: 'Remove tag', kind: 'dangerSolid', onPress: () => act(() => products.removeTag(p.id, t.id), `${t.code} removed`) }, { label: 'Cancel' }],
    });
  }

  // A tag was scanned or typed in the Change / Replace scanner: check it, then ask.
  async function onNewTag(code) {
    const { kind, tag } = scan;
    if (code === tag.code) { setScan({ ...scan, error: { title: `${code} is already this saree's tag`, text: 'Scan the new tag.' } }); return; }
    setScan({ ...scan, busy: true, error: null });
    let r;
    try { r = await products.checkTag(code); } catch (e) { setScan({ ...scan, busy: false, error: { title: 'Couldn\'t check the tag', text: e.message } }); return; }
    if (r.status !== 'free') { setScan({ ...scan, busy: false, error: { title: `${code} ${PROBLEM_TITLE[r.status] || 'can\'t be used'}`, text: r.message } }); return; }
    setScan(null);
    const change = kind === 'change';
    setTimeout(() => confirm({
      tone: change ? 'info' : 'warning', icon: change ? 'edit' : 'broken', title: change ? 'Change the tag?' : 'Replace the tag?',
      content: (
        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <TagChip code={tag.code} tone="sold" big /><Icon name="right" size={18} color={c.muted} /><TagChip code={code} tone="ok" big />
          </View>
          <T variant="small" color="text2">{change ? `${tag.code} becomes free, so it can go on its real saree.` : `${tag.code} is retired: it can never be used again, so an old torn sticker can't be mixed up with another saree.`}</T>
        </View>
      ),
      actions: [{ label: change ? `Change to ${code}` : `Replace with ${code}`, kind: 'primary', onPress: () => act(() => (change ? products.changeTag(p.id, tag.id, code) : products.replaceTag(p.id, tag.id, code)), change ? `Tag changed · ${tag.code} is free again` : `New tag ${code} · ${tag.code} retired`) }, { label: 'Cancel' }],
    }), 350);
  }

  function chooseChannel() {
    confirm({
      icon: 'eye', title: 'Where it sells', text: 'Only this saree.',
      actions: [...CHANNELS.map(([key, label]) => ({ label: `${label}${p.channel === key ? '  ✓' : ''}`, kind: p.channel === key ? 'primary' : 'secondary', onPress: () => (key === p.channel ? null : act(() => products.updateProduct(p.id, { channel: key }), `Now: ${label}`)) })), { label: 'Cancel', kind: 'ghost' }],
    });
  }

  function remove() {
    if (!data.actions.delete) {
      confirm({ tone: 'warning', icon: 'clock', title: 'Can\'t delete right now', text: 'A customer is paying for this saree online. Try again after the checkout ends (about 15 minutes).', actions: [{ label: 'OK', kind: 'primary' }] });
      return;
    }
    const unsold = p.tags.filter((t) => t.status === 'in_stock' || t.status === 'damaged').map((t) => t.code);
    const sold = p.tags.some((t) => t.status.startsWith('sold'));
    confirm({
      tone: 'danger', icon: 'trash', title: 'Delete this saree?',
      text: `It disappears from the app, the website and the counter. It isn't erased${sold ? ': its sale stays in the bills and reports' : ''}.${unsold.length ? ` ${unsold.join(', ')} ${unsold.length > 1 ? 'become' : 'becomes'} free to use on another saree.` : ''}`,
      actions: [{ label: 'Delete', kind: 'dangerSolid', onPress: async () => {
        setBusy('delete');
        try {
          const r = await products.deleteProduct(p.id);
          router.back();
          showToast(`Deleted${r.freedTags.length ? ` · ${r.freedTags.join(', ')} free again` : ''}`, 'success');
        } catch (e) {
          showToast(e.message);
          load();
        } finally { setBusy(null); }
      } }, { label: 'Cancel' }],
    });
  }

  let body;
  if (error) {
    body = (
      <View style={{ gap: 10 }}>
        <Banner tone={error.code === 'NOT_FOUND' ? 'info' : 'error'} title={error.code === 'NOT_FOUND' ? 'Not in the shop any more' : 'Couldn\'t load this saree'} text={error.message} />
        {error.code === 'NOT_FOUND' ? null : <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />}
      </View>
    );
  } else if (!p) {
    body = <View style={{ height: 320, borderRadius: radius.lg, backgroundColor: c.surface3, opacity: 0.6 }} />;
  } else {
    const s = p.subcategory;
    const off = discountPercent(s.mrp, s.websitePrice);
    const [stock, tone] = stockBadge(p.stock);
    const liveTags = p.tags.filter((t) => t.status !== 'retired');
    const inStock = liveTags.filter((t) => t.status === 'in_stock').length;
    const d = p.details;
    const detailText = ['color', 'fabric', 'borderStyle', 'technique', 'blouseType', 'zariTier', 'purity', 'pattern'].map((k) => d[k]).concat(d.occasion?.length ? [d.occasion.join(', ')] : []).filter(Boolean).join(' · ');
    body = (
      <>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Photos" onPress={() => router.push(`/products/photos?id=${p.id}`)}
            style={{ width: '58%', maxWidth: 260, aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
            {p.images[0] ? <Image source={{ uri: p.images[0].url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Icon name="image" size={40} color={c.muted} />}
          </Pressable>
          <View style={{ flex: 1, gap: 8 }}>
            {p.images.slice(1).map((img) => (
              <Pressable key={img.id} onPress={() => router.push(`/products/photos?id=${p.id}`)} accessibilityLabel="Extra photo" style={{ width: 64, aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden' }}>
                <Image source={{ uri: img.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
            {p.images.length < 5 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={() => router.push(`/products/photos?id=${p.id}`)}
                style={{ width: 64, aspectRatio: 3 / 4, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" color={c.primary} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <T variant="caption" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.category.name}</T>
        <T variant="heading">{p.name}</T>
        <T variant="smallStrong" color="text2">{p.sku}</T>
        <T variant="caption" color="muted">Added {new Date(p.addedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{p.addedBy ? ` by ${p.addedBy.name}` : ''}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <Badge text={stock} tone={tone} />
          {liveTags.length > 1 ? <Badge text={`Set of ${liveTags.length} · ${inStock} in stock`} tone="owner" /> : null}
          <Badge text={channelText(p.channel)} tone="neutral" />
          {p.bestSeller ? <Badge text="Best Seller" tone="staff" /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 11, borderRadius: radius.md, backgroundColor: c.surface2, marginTop: 10 }}>
          <Icon name={p.website.visible ? 'check' : 'eyeoff'} size={17} color={p.website.visible ? c.success : c.muted} />
          <T variant="small" color="text2" style={{ flex: 1 }}>{p.website.text}</T>
        </View>
        {p.storedName ? <T variant="caption" color="muted" style={{ marginTop: 6, marginLeft: 4 }}>The old app showed it as &quot;{p.storedName}&quot;. The name now follows its subcategory.</T> : null}

        <SectionLabel>{liveTags.length > 1 ? `Tags · a set of ${liveTags.length}, ${inStock} in stock` : p.tags.length > 1 ? `Tags · ${liveTags.length}` : 'Tag'}</SectionLabel>
        <Card>
          {p.tags.map((t, i) => {
            const [label, tTone] = tagStatusText(t);
            return (
              <Row key={t.id} last={i === p.tags.length - 1} onPress={() => tagSheet(t)} accessibilityLabel={`Tag ${t.code}, ${label}`}
                leading={<View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', opacity: t.status === 'retired' ? 0.5 : 1 }}><Icon name={t.status === 'retired' ? 'broken' : 'barcode'} size={20} color={c.text2} /></View>}
                title={(
                  <View style={{ gap: 4 }}>
                    <T variant="barTitle" numberOfLines={1} style={{ letterSpacing: 0.5, textDecorationLine: t.status === 'retired' ? 'line-through' : 'none', opacity: t.status === 'retired' ? 0.6 : 1 }}>{t.code}</T>
                    <Badge text={label} tone={tTone} />
                  </View>
                )} />
            );
          })}
        </Card>
        {liveTags.length > 1 ? <T variant="caption" color="muted" style={{ marginTop: 6, marginLeft: 4 }}>One photo, {liveTags.length} sarees of the same design. Each tag is one saree: it sells, changes or is replaced on its own. The listing stays on the website until the last one sells.</T> : null}
        <Button title="Add more tags (same design)" icon="plus" kind="secondary" onPress={() => setAdding(true)} style={{ marginTop: 10 }} />

        <SectionLabel>Price · from the subcategory</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 1, backgroundColor: c.border, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
          {[['Store', rupees(s.storePrice)], ['Website', rupees(s.websitePrice)]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, backgroundColor: c.surface, padding: 12 }}><T variant="caption" color="muted">{k.toUpperCase()}</T><T variant="barTitle">{v}</T></View>
          ))}
          <View style={{ flex: 1, backgroundColor: c.surface, padding: 12 }}>
            <T variant="caption" color="muted">MRP</T>
            {s.mrp ? <T variant="bodyStrong" color="text2" style={{ textDecorationLine: 'line-through' }}>{rupees(s.mrp)}</T> : <T variant="barTitle" color="muted">—</T>}
            {off ? <T variant="caption" color="success">{off}% off</T> : null}
          </View>
        </View>
        <T variant="caption" color="muted" style={{ marginTop: 6, marginLeft: 4 }}>Prices are set for all of {s.name} in the Catalogue.</T>

        <SectionLabel>Selling</SectionLabel>
        <Card>
          <Row icon="eye" title="Where it sells" subtitle={channelText(p.channel)} onPress={chooseChannel} />
          <Row icon="star" title="Best Seller" subtitle="Shown in the website's Best Sellers" last
            right={<Switch value={p.bestSeller} onValueChange={(v) => act(() => products.updateProduct(p.id, { bestSeller: v }), v ? 'Best Seller on' : 'Best Seller off')} trackColor={{ true: c.success, false: c.surface3 }} accessibilityLabel="Best Seller" />} />
        </Card>

        <SectionLabel>More</SectionLabel>
        <Card>
          <Row icon="sliders" title="Details" subtitle={detailText || 'Optional: colour, fabric, border, occasion…'} onPress={() => router.push(`/products/details?id=${p.id}`)} />
          <Row icon="image" title="Photos" subtitle={`${p.images.length} of 5`} onPress={() => router.push(`/products/photos?id=${p.id}`)} />
          <Row icon="move" title="Move to another subcategory" subtitle="Name and price change with it" onPress={() => router.push(`/products/move?id=${p.id}`)} last />
        </Card>

        <SectionLabel>History</SectionLabel>
        {p.history.length ? (
          <Card>
            {p.history.slice(0, 6).map((h, i) => <Row key={h.at + i} icon="history" title={h.text} subtitle={`${dayTime(h.at)}${h.by ? ` · ${h.by}` : ''}`} last={i === Math.min(5, p.history.length - 1)} />)}
          </Card>
        ) : <T variant="small" color="muted" style={{ marginLeft: 4 }}>Nothing recorded yet.</T>}

        <Button title="Delete saree" icon="trash" kind="danger" loading={busy === 'delete'} onPress={remove} style={{ marginTop: 28 }} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <TopBar title="Saree" onBack={goBack} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {body}
      </ScrollView>
      <AddTagsModal visible={adding} product={p} onClose={() => setAdding(false)} onAdded={(d, msg) => { setAdding(false); setData(d); showToast(msg, 'success'); }} />
      <ScanTagModal visible={!!scan} busy={scan?.busy}
        title={scan?.kind === 'replace' ? `Replace damaged tag ${scan?.tag.code}` : `Change tag ${scan?.tag.code || ''}`}
        text={scan?.kind === 'replace' ? 'Stick a new tag on the saree, then scan it.' : 'Scan the right tag for this saree.'}
        note={scan?.kind === 'replace' ? 'Same number printed again? Just stick it on: nothing to change here.' : null}
        error={scan?.error} onCode={onNewTag} onClose={() => setScan(null)} />
    </View>
  );
}
