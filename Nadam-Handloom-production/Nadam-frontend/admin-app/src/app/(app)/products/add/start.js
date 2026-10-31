// Adding sarees, step 2: the subcategory (name, price and description come from it),
// where they sell (once for the batch), then Choose photos (the main way, up to 50)
// or Quick add. Docs Module 4, sections 5 and 7.3.
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Facts, SectionLabel } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { useFeedback } from '../../../../components/Feedback';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import * as catalog from '../../../../api/catalog';
import * as products from '../../../../api/products';
import { batchStore, useBatch } from '../../../../products/batch';
import { markSubUsed } from '../../../../products/recent';
import { CHANNELS, plural, tagsOf } from '../../../../utils/products';
import { rupees } from '../../../../utils/catalog';

const MAX_BATCH = 50;

export default function StartAdding() {
  const { id } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const { confirm, showToast } = useFeedback();
  const draft = useBatch();
  const [sub, setSub] = useState(null);
  const [totals, setTotals] = useState(null);
  const [channel, setChannel] = useState('both');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    catalog.getSubcategory(id).then((r) => setSub(r.subcategory), setError);
    products.listProducts({ limit: 1 }).then((r) => setTotals(r.totals), () => {});
  }, [id]);

  const full = totals && totals.inStock >= totals.limit;
  const near = totals && !full && totals.inStock >= totals.limit * 0.98;

  async function choosePhotos() {
    const tagged = draft ? draft.items.filter((i) => tagsOf(i).length).length : 0;
    if (tagged) {
      confirm({
        tone: 'warning', icon: 'layers', title: 'Replace your draft?', text: `You have a draft with ${plural(tagged, 'tagged photo')} (${draft.sub.name}). Start a new batch instead?`,
        actions: [{ label: 'Continue the draft', kind: 'primary', onPress: () => router.replace('/products/add/scan') }, { label: 'Start new (the draft is dropped)', kind: 'danger', onPress: () => setTimeout(pick, 350) }, { label: 'Cancel', kind: 'ghost' }],
      });
      return;
    }
    pick();
  }
  async function pick() {
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_BATCH, orderedSelection: true, quality: 1, exif: false });
      if (res.canceled || !res.assets?.length) return;
      const assets = res.assets.slice(0, MAX_BATCH);
      if (res.assets.length > MAX_BATCH) showToast(`Up to ${MAX_BATCH} at a time: the first ${MAX_BATCH} are in this batch.`);
      batchStore.start({ sub: { id: sub.id, name: sub.name, categoryName: sub.categoryName, storePrice: sub.storePrice, websitePrice: sub.websitePrice }, channel, assets });
      markSubUsed(sub.id);
      router.replace('/products/add/scan');
    } catch (e) { showToast(e.message || 'Couldn\'t open the gallery.'); } finally { setBusy(false); }
  }

  const option = (main, icon, title, text, onPress, extra) => (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={!sub || full || busy}
      style={{ flex: tablet ? 1 : undefined, flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: radius.lg, borderWidth: 1.5, borderColor: main ? c.primary : c.border, backgroundColor: main ? c.primarySoft : c.surface, opacity: !sub || full ? 0.5 : 1 }}>
      <View style={{ width: 46, height: 46, borderRadius: radius.md, backgroundColor: main ? c.primary : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={main ? c.onPrimary : c.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="bodyStrong">{title}</T>
        <T variant="small" color="text2">{text}</T>
        {extra}
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}><TopBar title="Add sarees" onBack={() => router.back()} /></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 + insets.bottom, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        {error ? <Banner tone="error" title="Couldn't load the subcategory" text={error.message} style={{ marginBottom: 12 }} /> : null}
        {full ? <Banner tone="error" title="The limit is reached" text={`${totals.inStock.toLocaleString('en-IN')} of ${totals.limit.toLocaleString('en-IN')} sarees in stock. Sold-out sarees don't count, so selling frees up space.`} style={{ marginBottom: 12 }} /> : null}
        {near ? <Banner tone="warning" title="Nearly at the limit" text={`${totals.inStock.toLocaleString('en-IN')} of ${totals.limit.toLocaleString('en-IN')} sarees in stock. Sold-out sarees don't count.`} style={{ marginBottom: 12 }} /> : null}
        {sub ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <View style={{ width: 72, height: 54, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface3, alignItems: 'center', justifyContent: 'center' }}>
              {sub.imageUrl ? <Image source={{ uri: sub.imageUrl }} style={{ width: '100%', height: '100%' }} /> : <Icon name="image" color={c.muted} />}
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption" color="muted" numberOfLines={1} style={{ textTransform: 'uppercase' }}>{sub.categoryName}</T>
              <T variant="bodyStrong" numberOfLines={2}>{sub.name}</T>
              <T variant="caption" color="muted">Store {rupees(sub.storePrice)} · Web {rupees(sub.websitePrice)}</T>
            </View>
            <Button title="Change" kind="ghost" small onPress={() => router.replace('/products/add/pick')} />
          </View>
        ) : <View style={{ height: 80, borderRadius: radius.lg, backgroundColor: c.surface3, opacity: 0.6 }} />}
        <T variant="caption" color="muted" style={{ marginTop: 6, marginLeft: 4 }}>Name, price and description come from this subcategory, for every saree.</T>

        <SectionLabel>Where they sell</SectionLabel>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
          {CHANNELS.map(([key, label]) => {
            const on = channel === key;
            return (
              <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setChannel(key)}
                style={{ flex: 1, minHeight: 42, borderRadius: radius.md - 3, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent', paddingHorizontal: 4 }}>
                <T variant="smallStrong" color={on ? 'text' : 'text2'} style={{ textAlign: 'center' }}>{label}</T>
              </Pressable>
            );
          })}
        </View>
        <T variant="caption" color="muted" style={{ marginTop: 6, marginLeft: 4 }}>For the whole batch. You can change one saree later.</T>

        <SectionLabel>How do you want to add?</SectionLabel>
        <View style={{ gap: 12, flexDirection: tablet ? 'row' : 'column' }}>
          {option(true, 'image', 'Choose photos from the gallery', `Best for 5 or more. Up to ${MAX_BATCH} at a time.`, choosePhotos, (
            <View style={{ gap: 4, marginTop: 4 }}>
              {['Pick the photos', 'Each photo shows: scan that saree\'s tag', 'Check, then Save all'].map((s, i) => <T key={s} variant="small" color="text2">{i + 1}. {s}</T>)}
            </View>
          ))}
          {option(false, 'camera', 'Quick add with the camera', 'For 1–3 sarees: photo → scan → next.', () => router.push(`/products/add/quick?id=${id}&channel=${channel}`))}
        </View>
        <Facts style={{ marginTop: 16 }} items={['Take the photos first, in good light, one saree per photo.', 'Keep the sarees close, in the same order as the photos: each one is quicker to find.', 'Works without internet: it uploads later.']} />
      </ScrollView>
    </View>
  );
}
