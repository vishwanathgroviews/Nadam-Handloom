// Move a saree to another subcategory: its name and price become the new
// subcategory's (shown first); SKU, tag and web address stay. Docs Module 4, 6.11.
// The subcategories come 20 at a time; the search runs on the server.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Banner } from '../../../components/Banner';
import { Card, Row } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { SearchBox } from '../../../components/SearchBox';
import { useFeedback } from '../../../components/Feedback';
import { Thumb } from '../../../components/catalog/Thumb';
import { useTheme } from '../../../theme/ThemeProvider';
import * as products from '../../../api/products';
import * as catalog from '../../../api/catalog';
import { rupees } from '../../../utils/catalog';
import { usePaged } from '../../../hooks/usePaged';
import { MoreFooter } from '../../../components/MoreFooter';

export default function MoveSaree() {
  const { id } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { confirm, showToast } = useFeedback();
  const [p, setP] = useState(null);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // what was searched: a moment after typing stops
  const [pError, setPError] = useState(null);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { products.getProduct(id).then((a) => setP(a.product), setPError); }, [id]);

  const page = useCallback((offset) => catalog.searchSubcategories({ q: query, offset }), [query]);
  const paged = usePaged(page, 'subcategories');
  const { load } = paged;
  useEffect(() => { load(); }, [load]);
  const subs = paged.data ? paged.items : null;
  const list = (subs || []).filter((s) => s.id !== p?.subcategory.id);
  const error = pError || (paged.error && !paged.data ? paged.error : null);

  function choose(s) {
    const from = p.subcategory;
    const line = (label, a, b) => (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: radius.md, backgroundColor: c.surface2 }}>
        <T variant="caption" color="muted">{label}</T>
        <T variant="smallStrong"><T variant="small" color="muted" style={{ textDecorationLine: 'line-through' }}>{a}</T>  →  {b}</T>
      </View>
    );
    confirm({
      icon: 'move', title: `Move to ${s.name}?`, text: 'Customers see the new name and price straight away.',
      content: <View style={{ gap: 6, marginTop: 12 }}>{line('Store price', rupees(from.storePrice), rupees(s.storePrice))}{line('Website price', rupees(from.websitePrice), rupees(s.websitePrice))}</View>,
      actions: [{ label: 'Move', kind: 'primary', onPress: async () => {
        try {
          await products.updateProduct(id, { subcategoryId: s.id });
          router.back();
          showToast(`Moved to ${s.name}`, 'success');
        } catch (e) { showToast(e.message); }
      } }, { label: 'Cancel' }],
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}><TopBar title="Move saree" onBack={() => router.back()} /></View>
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View>
            {error ? <Banner tone="error" title="Couldn't load" text={error.message} style={{ marginBottom: 12 }} /> : null}
            {p ? (
              <Card style={{ marginBottom: 8 }}>
                <Row leading={<Thumb uri={p.images[0]?.url} width={42} height={56} />} title={p.subcategory.name} subtitle={`Now · ${p.sku} · ${rupees(p.subcategory.storePrice)}`} last />
              </Card>
            ) : null}
            <T variant="caption" color="muted" style={{ marginBottom: 12, marginLeft: 4 }}>Its name and price change to the new subcategory&apos;s. Its SKU, tag and web address stay the same.</T>
            <SearchBox value={q} onChange={setQ} placeholder="Search subcategories" />
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={{ backgroundColor: c.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border, borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: index === list.length - 1 ? 1 : 0, borderTopLeftRadius: index === 0 ? radius.lg : 0, borderTopRightRadius: index === 0 ? radius.lg : 0, borderBottomLeftRadius: index === list.length - 1 ? radius.lg : 0, borderBottomRightRadius: index === list.length - 1 ? radius.lg : 0, overflow: 'hidden' }}>
            <Row leading={<Thumb uri={item.imageUrl} />} title={item.name} subtitle={`${item.categoryName} · ${rupees(item.storePrice)}`} onPress={() => choose(item)} last={index === list.length - 1} />
          </View>
        )}
        onEndReached={paged.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={subs ? <MoreFooter paged={paged} /> : null}
        ListEmptyComponent={subs ? <View style={{ alignItems: 'center', padding: 24, gap: 6 }}><Icon name="search" color={c.muted} /><T color="muted">No subcategory matches.</T></View> : null}
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 + insets.bottom, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      />
    </View>
  );
}
