// Adding sarees, step 1 (only when started from the Products tab): which subcategory?
// Chosen once for the whole batch; recent ones first. With ?tag= (from Scan to find),
// it leads to Quick add with that tag ready. Docs Module 4, section 7.3.
// The subcategories come 20 at a time; the search runs on the server.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Banner } from '../../../../components/Banner';
import { Row, SectionLabel } from '../../../../components/Bits';
import { SearchBox } from '../../../../components/SearchBox';
import { Thumb } from '../../../../components/catalog/Thumb';
import { useTheme } from '../../../../theme/ThemeProvider';
import * as catalog from '../../../../api/catalog';
import { recentSubs } from '../../../../products/recent';
import { rupees } from '../../../../utils/catalog';
import { usePaged } from '../../../../hooks/usePaged';
import { MoreFooter } from '../../../../components/MoreFooter';

export default function PickSubcategory() {
  const { tag } = useLocalSearchParams();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [recent, setRecent] = useState([]); // the recently used subcategories, fetched one by one
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // what was searched: a moment after typing stops
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    recentSubs().then((ids) => Promise.all(ids.map((rid) => catalog.getSubcategory(rid).then((r) => r.subcategory, () => null)))).then((list) => setRecent(list.filter(Boolean)), () => {});
  }, []);

  const page = useCallback((offset) => catalog.searchSubcategories({ q: query, offset }), [query]);
  const paged = usePaged(page, 'subcategories');
  const { load } = paged;
  useEffect(() => { load(); }, [load]);
  const list = paged.items;
  const error = paged.error && !paged.data ? paged.error : null;
  const t = query;
  const recents = t ? [] : recent;
  const pick = (s) => router.replace(tag ? `/products/add/quick?id=${s.id}&tag=${encodeURIComponent(tag)}` : `/products/add/start?id=${s.id}`);
  const box = (i, n) => ({ backgroundColor: c.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border, borderTopWidth: i === 0 ? 1 : 0, borderBottomWidth: i === n - 1 ? 1 : 0, borderTopLeftRadius: i === 0 ? radius.lg : 0, borderTopRightRadius: i === 0 ? radius.lg : 0, borderBottomLeftRadius: i === n - 1 ? radius.lg : 0, borderBottomRightRadius: i === n - 1 ? radius.lg : 0, overflow: 'hidden' });
  const row = (s, i, n) => (
    <View key={s.id} style={box(i, n)}>
      <Row leading={<Thumb uri={s.imageUrl} />} title={s.name} subtitle={`${s.categoryName} · ${rupees(s.storePrice)} · ${s.productCount} sarees`} onPress={() => pick(s)} last={i === n - 1} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}><TopBar title="Add sarees" onBack={() => router.back()} /></View>
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View>
            {tag ? <Banner tone="info" icon="barcode" title={`New saree with tag ${tag}`} text="Choose its subcategory. Then take its photo." style={{ marginBottom: 12 }} />
              : <T color="text2" style={{ marginBottom: 12 }}>Which subcategory are these sarees from? You choose it once for the whole batch.</T>}
            {error ? <Banner tone="error" title="Couldn't load the catalogue" text={error.message} style={{ marginBottom: 12 }} /> : null}
            <SearchBox value={q} onChange={setQ} placeholder="Search subcategories" />
            {recents.length ? <><SectionLabel>Recent</SectionLabel>{recents.map((s, i) => row(s, i, recents.length))}</> : null}
            <SectionLabel>{t ? `${paged.total ?? list.length} match` : `All subcategories · ${paged.total ?? list.length}`}</SectionLabel>
          </View>
        )}
        renderItem={({ item, index }) => row(item, index, list.length)}
        onEndReached={paged.loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={paged.data ? <MoreFooter paged={paged} /> : null}
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 + insets.bottom, width: '100%', maxWidth: 760, alignSelf: 'center' }}
      />
    </View>
  );
}
