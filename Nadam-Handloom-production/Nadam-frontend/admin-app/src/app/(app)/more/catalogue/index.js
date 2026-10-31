// Catalogue (owners and staff): categories in shop order, one search across every
// subcategory (name or price, on the server), and filters; 20 at a time. Docs Module 3, section 6.1.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Card } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { SearchBox } from '../../../../components/SearchBox';
import { FilterChips } from '../../../../components/catalog/FilterChips';
import { SubGrid } from '../../../../components/catalog/SubGrid';
import { Thumb } from '../../../../components/catalog/Thumb';
import { OfflineCopy } from '../../../../components/catalog/OfflineCopy';
import { EmptyCard, ReadOnlyNote } from '../../../../components/catalog/Notes';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../api/catalog';
import { plural } from '../../../../utils/catalog';
import { usePaged, nearEnd } from '../../../../hooks/usePaged';
import { MoreFooter } from '../../../../components/MoreFooter';

export default function Catalogue() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // what was searched: a moment after typing stops
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const searching = query.length > 0 || filter !== 'all';

  const catPage = useCallback((offset) => catalog.listCategories(offset), []);
  const cats = usePaged(catPage, 'categories'); // data: { counts, actions, savedAt } cover every subcategory
  const subPage = useCallback((offset) => catalog.searchSubcategories({ q: query, filter, offset }), [query, filter]);
  const found = usePaged(subPage, 'subcategories');
  const { load } = cats;
  const loadFound = found.load;
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => { if (searching) loadFound(); }, [searching, loadFound]));

  const data = cats.data ? { ...cats.data, categories: cats.items } : null;
  const error = cats.error;
  const results = found.items;
  const counts = cats.data?.counts || null;
  const canEdit = !!data?.actions?.create && !data?.savedAt;

  let body;
  if (error) {
    body = (
      <View style={{ gap: 10 }}>
        <Banner tone="error" title="Couldn't load the catalogue" text={error.message} />
        <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  } else if (!data || (searching && !found.data)) {
    body = <Card>{[0, 1, 2, 3, 4].map((i) => <View key={i} style={{ height: 62, margin: 8, borderRadius: 12, backgroundColor: c.surface3, opacity: 0.6 }} />)}</Card>;
  } else if (searching) {
    body = (
      <>
        {query ? <T variant="small" color="muted" style={{ marginBottom: 8, marginLeft: 4 }}>{plural(found.total ?? results.length, 'subcategory', 'subcategories')} match "{query}"</T> : null}
        {results.length ? (
          <>
            <SubGrid items={results} showCategory onOpen={(s) => router.push(`/more/catalogue/sub/${s.id}`)} />
            <MoreFooter paged={found} allText={`That's all ${found.total} subcategories.`} />
          </>
        ) : (
          <EmptyCard icon="search" title={query ? 'No subcategories match' : 'Nothing here'} text={query ? 'Try part of the name, like "checks", or a price like 2800.' : 'No subcategories in this filter.'} />
        )}
      </>
    );
  } else if (!data.categories.length) {
    body = (
      <EmptyCard icon="folder" title="No categories yet" text={canEdit ? 'Add your first category to start the catalogue.' : 'The owner hasn\'t added any categories yet.'}>
        {canEdit ? <Button title="New category" icon="plus" small onPress={() => router.push('/more/catalogue/category-form')} style={{ marginTop: 6 }} /> : null}
      </EmptyCard>
    );
  } else {
    body = (
      <>
      <Card>
        {data.categories.map((cat, i) => (
          <Pressable key={cat.id} accessibilityRole="button" accessibilityLabel={`${cat.name}, ${plural(cat.subcategoryCount, 'subcategory', 'subcategories')}`} onPress={() => router.push(`/more/catalogue/category/${cat.id}`)} android_ripple={{ color: c.surface2 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === data.categories.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
            <Thumb uri={cat.imageUrl} width={54} height={72} />
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong" numberOfLines={2}>{cat.name}</T>
              <T variant="small" color="muted" numberOfLines={2}>{plural(cat.subcategoryCount, 'subcategory', 'subcategories')} · {plural(cat.productCount, 'product')}</T>
            </View>
            <Icon name="right" size={18} color={c.muted} />
          </Pressable>
        ))}
      </Card>
      <MoreFooter paged={cats} allText={`That's all ${cats.total} categories.`} />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <TopBar title="Catalogue" onBack={() => router.back()} right={canEdit ? <Button title="New" icon="plus" small onPress={() => router.push('/more/catalogue/category-form')} style={{ marginRight: 8 }} /> : null} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        onScroll={(e) => { if (nearEnd(e)) (searching ? found : cats).loadMore(); }} scrollEventThrottle={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([load(), searching ? loadFound() : null]); setRefreshing(false); }} />}>
        <OfflineCopy savedAt={data?.savedAt} />
        {data && !data.actions?.create ? <ReadOnlyNote /> : null}
        <SearchBox value={q} onChange={setQ} placeholder="Search all subcategories or a price" label="Search all subcategories" />
        {!q.trim() && counts ? <FilterChips value={filter} counts={counts} onChange={setFilter} /> : null}
        {body}
        {canEdit && !searching && (cats.total ?? data.categories.length) > 1 ? <Button title="Reorder categories" icon="grip" kind="secondary" small onPress={() => router.push('/more/catalogue/reorder')} style={{ alignSelf: 'flex-start', marginTop: 14 }} /> : null}
      </ScrollView>
    </View>
  );
}
