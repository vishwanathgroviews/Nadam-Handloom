// A subcategory: prices (store, website, MRP with the website's "% off"), Show on
// website, products, catalogue PDF, price history, delete (never erased; refused while
// any saree is in stock). Staff see it without controls. Docs Module 3, section 6.3.
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Switch, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../../components/Screen';
import { T } from '../../../../../components/T';
import { Button } from '../../../../../components/Button';
import { Banner } from '../../../../../components/Banner';
import { Badge, Card, Row, SectionLabel } from '../../../../../components/Bits';
import { useFeedback } from '../../../../../components/Feedback';
import { HeroPhoto } from '../../../../../components/catalog/Thumb';
import { OfflineCopy } from '../../../../../components/catalog/OfflineCopy';
import { ReadOnlyNote } from '../../../../../components/catalog/Notes';
import { useTheme } from '../../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../../api/catalog';
import { dayText, discountPercent, plural, rupees } from '../../../../../utils/catalog';

const FIELD = { store: 'Store', website: 'Website', mrp: 'MRP' };

function PriceBox({ label, children }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, padding: 12, gap: 2 }}>
      <T variant="caption" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</T>
      {children}
    </View>
  );
}

export default function Subcategory() {
  const { id } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { confirm, showToast } = useFeedback();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await catalog.getSubcategory(id)); } catch (e) { setError(e); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const s = data?.subcategory;
  const a = data?.savedAt ? {} : data?.actions || {};

  function toggleWebsite(on) {
    confirm({
      tone: on ? 'info' : 'warning', icon: 'eye', title: on ? 'Show on the website?' : 'Hide from the website?',
      text: on ? `${s.name} and its ${plural(s.productCount, 'product')} appear on the website again straight away.` : `${s.name} and its ${plural(s.productCount, 'product')} disappear from the website straight away. You still see them in the app, and can show them again any time.`,
      actions: [{ label: on ? 'Show on website' : 'Hide from website', kind: 'primary', onPress: async () => {
        setBusy('web');
        try {
          setData({ ...(await catalog.updateSubcategory(s.id, { showOnWebsite: on })), savedAt: null });
          showToast(on ? 'Shown on the website' : 'Hidden from the website', 'success');
        } catch (e) { showToast(e.message); } finally { setBusy(null); }
      } }, { label: 'Cancel' }],
    });
  }

  function remove() {
    if (s.inStockCount > 0) {
      confirm({
        tone: 'warning', icon: 'alert', title: 'Can\'t delete yet',
        text: `${plural(s.inStockCount, 'saree is', 'sarees are')} from ${s.name} still in stock. Sell or move them first. You can hide it from the website instead.`,
        actions: [...(s.showOnWebsite ? [{ label: 'Hide from website instead', kind: 'primary', onPress: () => setTimeout(() => toggleWebsite(false), 350) }] : []), { label: 'OK', kind: s.showOnWebsite ? 'secondary' : 'primary' }],
      });
      return;
    }
    confirm({
      tone: 'danger', icon: 'trash', title: `Delete ${s.name}?`, text: 'It disappears from the app and the website. It isn\'t erased: old bills and history keep its name, and you can use the name again later.',
      actions: [{ label: 'Delete', kind: 'dangerSolid', onPress: async () => {
        setBusy('delete');
        try {
          await catalog.deleteSubcategory(s.id);
          router.back();
          showToast(`${s.name} deleted`, 'success');
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
        <Banner tone="error" title={error.code === 'NOT_FOUND' ? 'Not in the catalogue any more' : 'Couldn\'t load this subcategory'} text={error.message} />
        {error.code === 'NOT_FOUND' ? null : <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />}
      </View>
    );
  } else if (!s) {
    body = <View style={{ height: 220, borderRadius: 14, backgroundColor: c.surface3, opacity: 0.6 }} />;
  } else {
    const off = discountPercent(s.mrp, s.websitePrice);
    body = (
      <>
        <OfflineCopy savedAt={data.savedAt} />
        {!data.actions?.edit ? <ReadOnlyNote /> : null}
        <HeroPhoto uri={s.imageUrl}>
          {!s.showOnWebsite ? <View style={{ position: 'absolute', left: 10, top: 10 }}><Badge text="Hidden from website" tone="warning" /></View> : null}
        </HeroPhoto>
        <T variant="caption" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.categoryName}</T>
        <T variant="heading">{s.name}</T>
        <T color="text2" style={{ marginTop: 6 }}>{s.description}</T>

        <SectionLabel>Prices</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 1, backgroundColor: c.border, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
          <PriceBox label="Store"><T variant="barTitle">{rupees(s.storePrice)}</T></PriceBox>
          <PriceBox label="Website"><T variant="barTitle">{rupees(s.websitePrice)}</T></PriceBox>
          <PriceBox label="MRP">
            {s.mrp ? <T variant="bodyStrong" color="text2" style={{ textDecorationLine: 'line-through' }}>{rupees(s.mrp)}</T> : <T variant="barTitle" color="muted">—</T>}
            {off ? <T variant="caption" color="success" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{off}% off</T> : null}
          </PriceBox>
        </View>
        <T variant="small" color="text2" style={{ marginTop: 8 }}>On the website: <T variant="smallStrong">{rupees(s.websitePrice)}</T>{off ? <T variant="small" color="muted"> <T variant="small" color="muted" style={{ textDecorationLine: 'line-through' }}>{rupees(s.mrp)}</T> <T variant="smallStrong" color="success">{off}% off</T></T> : null}</T>
        {s.mrp != null && s.mrp <= s.websitePrice ? <Banner tone="warning" title="MRP is not above the website price" text="The website shows no discount. Edit the prices to fix the MRP." style={{ marginTop: 10 }} /> : null}

        <SectionLabel>Website</SectionLabel>
        <Card>
          <Row icon="eye" title={a.toggleWebsite ? 'Show on website' : s.showOnWebsite ? 'Shown on the website' : 'Hidden from the website'}
            subtitle={s.showOnWebsite ? 'Customers can see it and its products' : 'Customers can\'t see it or its products'}
            right={a.toggleWebsite ? <Switch value={s.showOnWebsite} disabled={busy === 'web'} onValueChange={toggleWebsite} trackColor={{ true: c.success, false: c.surface3 }} accessibilityLabel="Show on website" /> : null} />
          <Row icon="box" title={plural(s.productCount, 'saree')} subtitle={`${s.inStockCount} in stock · see them or add more`} onPress={() => router.push(`/products/sub/${s.id}?back=${encodeURIComponent(`/more/catalogue/sub/${s.id}`)}`)} last />
        </Card>

        <SectionLabel>Catalogue PDF</SectionLabel>
        <Card>
          <Row icon="pdf" title={s.catalogue ? `Made ${dayText(s.catalogue.generatedAt)} · ${plural(s.catalogue.productCount, 'saree')}` : 'No PDF yet'}
            subtitle={s.pdfReadyCount ? `${plural(s.pdfReadyCount, 'saree')} in stock with a photo` : 'No sarees in stock with a photo'}
            onPress={() => router.push(`/more/catalogue/pdf?id=${s.id}`)} last />
        </Card>

        <SectionLabel>Price history</SectionLabel>
        {s.priceHistory.length ? (
          <Card>
            {s.priceHistory.slice(0, 5).map((h, i) => (
              <Row key={h.at + i} icon="history" title={h.changes.map((ch) => `${FIELD[ch.field]} ${rupees(ch.from)} → ${rupees(ch.to)}`).join(' · ')}
                subtitle={`${new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}${h.by ? ` · ${h.by.name}` : ''}`} last={i === Math.min(4, s.priceHistory.length - 1)} />
            ))}
          </Card>
        ) : <T variant="small" color="muted" style={{ marginLeft: 4 }}>No price changes recorded yet.</T>}

        {a.delete ? <Button title="Delete subcategory" icon="trash" kind="danger" loading={busy === 'delete'} onPress={remove} style={{ marginTop: 28 }} /> : null}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <TopBar title={s?.name || 'Subcategory'} onBack={() => router.back()} right={a.edit ? <Button title="Edit" icon="edit" kind="secondary" small onPress={() => router.push(`/more/catalogue/sub-form?id=${s.id}`)} style={{ marginRight: 8 }} /> : null} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {body}
      </ScrollView>
    </View>
  );
}
