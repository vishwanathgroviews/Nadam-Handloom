// A category: photo, description and its subcategories with prices and badges;
// search and filters inside it. Owners: edit, add, reorder, delete (never erased:
// refused while it has subcategories). Search and filters run on the server; 20 at a
// time. Docs Module 3, section 6.2.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../../components/Screen';
import { T } from '../../../../../components/T';
import { Button, LinkButton } from '../../../../../components/Button';
import { Banner } from '../../../../../components/Banner';
import { SectionLabel } from '../../../../../components/Bits';
import { useFeedback } from '../../../../../components/Feedback';
import { SearchBox } from '../../../../../components/SearchBox';
import { FilterChips } from '../../../../../components/catalog/FilterChips';
import { SubGrid } from '../../../../../components/catalog/SubGrid';
import { HeroPhoto } from '../../../../../components/catalog/Thumb';
import { OfflineCopy } from '../../../../../components/catalog/OfflineCopy';
import { EmptyCard, ReadOnlyNote } from '../../../../../components/catalog/Notes';
import { useTheme } from '../../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../../api/catalog';
import { plural } from '../../../../../utils/catalog';
import { usePaged, nearEnd } from '../../../../../hooks/usePaged';
import { MoreFooter } from '../../../../../components/MoreFooter';

export default function Category() {
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { confirm, showToast } = useFeedback();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // what was searched: a moment after typing stops
  const [filter, setFilter] = useState('all');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const page = useCallback((offset) => catalog.getCategory(id, { q: query, filter, offset }), [id, query, filter]);
  const paged = usePaged(page, 'subcategories');
  const { load, error, data } = paged;
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cat = data?.category;
  const a = data?.savedAt ? {} : data?.actions || {};
  const shown = paged.items;

  function deleteCategory() {
    const n = cat.subcategoryCount;
    if (n) {
      confirm({ tone: 'warning', icon: 'alert', title: 'Can\'t delete yet', text: `${cat.name} still has ${plural(n, 'subcategory', 'subcategories')}. Delete them first, then the category.`, actions: [{ label: 'OK', kind: 'primary' }] });
      return;
    }
    confirm({
      tone: 'danger', icon: 'trash', title: `Delete ${cat.name}?`, text: 'It disappears from the app and the website. It isn\'t erased: old bills and history keep its name.',
      actions: [{ label: 'Delete', kind: 'dangerSolid', onPress: async () => {
        setBusy(true);
        try {
          await catalog.deleteCategory(cat.id);
          router.back();
          showToast(`${cat.name} deleted`, 'success');
        } catch (e) {
          showToast(e.message);
          load();
        } finally {
          setBusy(false);
        }
      } }, { label: 'Cancel' }],
    });
  }

  let body;
  if (error) {
    body = (
      <View style={{ gap: 10 }}>
        <Banner tone="error" title={error.code === 'NOT_FOUND' ? 'Not in the catalogue any more' : 'Couldn\'t load this category'} text={error.message} />
        {error.code === 'NOT_FOUND' ? null : <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />}
      </View>
    );
  } else if (!cat) {
    body = <View style={{ height: 200, borderRadius: 14, backgroundColor: c.surface3, opacity: 0.6 }} />;
  } else {
    body = (
      <>
        <OfflineCopy savedAt={data.savedAt} />
        {!data.actions?.edit ? <ReadOnlyNote /> : null}
        <HeroPhoto uri={cat.imageUrl} ratio={3 / 4} style={{ width: '58%', maxWidth: 260, alignSelf: 'center' }} />
        <T color="text2" numberOfLines={more ? undefined : 3}>{cat.description}</T>
        {cat.description.length > 140 ? <LinkButton title={more ? 'Less' : 'More'} onPress={() => setMore(!more)} style={{ marginTop: 4 }} /> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionLabel>Subcategories · {cat.subcategoryCount}</SectionLabel>
          {a.createSubcategory ? <Button title="New" icon="plus" small onPress={() => router.push(`/more/catalogue/sub-form?cat=${cat.id}`)} style={{ marginTop: 12 }} /> : null}
        </View>
        {cat.subcategoryCount > 6 ? <SearchBox value={q} onChange={setQ} placeholder={`Search in ${cat.name.toLowerCase()}`} /> : null}
        {cat.subcategoryCount ? <FilterChips value={filter} counts={data.counts} onChange={setFilter} /> : null}
        {!cat.subcategoryCount ? (
          <EmptyCard icon="tag" title="No subcategories yet" text={a.createSubcategory ? 'Add the first one: name, prices and a photo.' : 'Nothing in this category yet.'}>
            {a.createSubcategory ? <Button title="New subcategory" icon="plus" small onPress={() => router.push(`/more/catalogue/sub-form?cat=${cat.id}`)} style={{ marginTop: 6 }} /> : null}
          </EmptyCard>
        ) : shown.length ? (
          <>
            <SubGrid items={shown} onOpen={(s) => router.push(`/more/catalogue/sub/${s.id}`)} />
            <MoreFooter paged={paged} allText={`That's all ${paged.total} subcategories.`} />
          </>
        ) : (
          <EmptyCard icon="search" title="No subcategories match" text="Try another word or filter." />
        )}

        {a.reorder && cat.subcategoryCount > 1 ? <Button title="Reorder" icon="grip" kind="secondary" small onPress={() => router.push(`/more/catalogue/reorder?cat=${cat.id}`)} style={{ alignSelf: 'flex-start', marginTop: 14 }} /> : null}
        {a.delete ? <Button title="Delete category" icon="trash" kind="danger" loading={busy} onPress={deleteCategory} style={{ marginTop: 28 }} /> : null}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <TopBar title={cat?.name || 'Category'} onBack={() => router.back()} right={a.edit ? <Button title="Edit" icon="edit" kind="secondary" small onPress={() => router.push(`/more/catalogue/category-form?id=${cat.id}`)} style={{ marginRight: 8 }} /> : null} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        onScroll={(e) => { if (nearEnd(e)) paged.loadMore(); }} scrollEventThrottle={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {body}
      </ScrollView>
    </View>
  );
}
