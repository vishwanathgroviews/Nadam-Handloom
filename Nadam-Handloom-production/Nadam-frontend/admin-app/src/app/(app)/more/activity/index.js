// Activity log (Module 10, owners; picks A: rows under each day with coloured icons,
// and B: everything in one Filter sheet). Search by tag, order, design or person; 50
// lines at a time; a grouped line opens its entries; an entry opens its details.
// Docs Module 10, section 5.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { Icon } from '../../../../components/Icon';
import { SearchBox } from '../../../../components/SearchBox';
import { T } from '../../../../components/T';
import { LockNote } from '../../../../components/sales/SaleParts';
import { EntryRow, EntrySheet } from '../../../../components/activity/Parts';
import { FilterSheet } from '../../../../components/activity/FilterSheet';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { useBack } from '../../../../hooks/useBack';
import { useCan, PERMISSION } from '../../../../auth/permissions';
import { setGroup } from '../../../../activity/group';
import * as activity from '../../../../api/activity';
import { todayIst } from '../../../../utils/invoices';
import { DEFAULT_VIEW, filterSummary, withDays } from '../../../../utils/activity';
import { usePaged } from '../../../../hooks/usePaged';

export default function Activity() {
  const goBack = useBack();
  const params = useLocalSearchParams();
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.ACTIVITY_VIEW);
  const [view, setView] = useState({ ...DEFAULT_VIEW, kind: params.kind || 'all', period: params.period || '30d' });
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(false);
  const [open, setOpen] = useState(null);
  const asked = useRef(0);
  const peoplePage = useCallback((offset) => activity.people(offset), []);
  const people = usePaged(peoplePage, 'people'); // for the Filter sheet, 20 at a time

  // Search after a short pause in typing.
  useEffect(() => { const id = setTimeout(() => setQ(text), 400); return () => clearTimeout(id); }, [text]);
  const query = { kind: view.kind, person: view.person, period: view.period, from: view.custom?.from, to: view.custom?.to, important: view.important, q };
  const key = JSON.stringify(query);
  const load = useCallback(async () => {
    const mine = ++asked.current;
    setError(null);
    setMoreError(null);
    try {
      const r = await activity.list(JSON.parse(key));
      if (mine === asked.current) setData({ key, ...r });
    } catch (e) {
      if (mine === asked.current) setError(e);
    }
  }, [key]);
  useFocusEffect(useCallback(() => { if (owner) load(); }, [owner, load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function loadMore() {
    if (!data?.next || more) return;
    setMore(true);
    setMoreError(null);
    try {
      const r = await activity.list({ ...JSON.parse(key), before: data.next });
      setData((d) => (d && d.key === key ? { ...d, entries: [...d.entries, ...r.entries.filter((x) => !d.entries.some((y) => y.id === x.id))], next: r.next } : d));
    } catch (e) {
      setMoreError(e.message); // shown under the list (the old app hid it)
    } finally {
      setMore(false);
    }
  }
  function openFilters() {
    setFilters(true);
    if (!people.data) people.load();
  }
  function tap(e) {
    if (e.group) { setGroup(e); router.push('/more/activity/group'); } else setOpen(e);
  }

  if (!owner) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <TopBar title="Activity" onBack={goBack} />
        <View style={{ padding: 20 }}><LockNote text="Activity shows everyone's actions, so it is for owners." /></View>
      </View>
    );
  }
  const current = data && data.key === key ? data : null;
  const rows = current ? withDays(current.entries, todayIst()) : [];
  const sum = filterSummary(view);
  const header = (
    <View style={{ paddingTop: 4 }}>
      <SearchBox value={text} onChange={setText} placeholder="Tag, order, design or person" label="Search activity" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Button title={sum.count ? `Filter (${sum.count})` : 'Filter'} kind="secondary" icon="sliders" small onPress={openFilters} />
        <T variant="caption" color={sum.count ? 'text2' : 'muted'} style={{ flex: 1, fontFamily: sum.count ? 'PlusJakartaSans_600SemiBold' : undefined }} numberOfLines={2}>{sum.text}</T>
      </View>
      {error && !current ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Banner tone="error" title="Couldn't load Activity" text={error.code === 'NETWORK' || error.code === 'TIMEOUT' ? 'No internet. Activity needs internet.' : error.message} />
          <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {!current && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      {current && !current.entries.length ? (
        <View style={{ marginTop: 12, minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, padding: 16 }}>
          <Icon name={q ? 'search' : 'history'} size={32} color={c.muted} />
          <T variant="bodyStrong" color="text2">{q ? `Nothing matches "${q}"` : 'Nothing here'}</T>
          <T variant="small" color="muted" style={{ textAlign: 'center' }}>{q ? 'Try a tag like NH2264, an order number or a name.' : 'No activity for these filters.'}</T>
        </View>
      ) : null}
    </View>
  );
  const footer = current?.entries.length ? (
    <View style={{ paddingVertical: 16, gap: 8, alignItems: 'center' }}>
      {more ? <T variant="small" color="muted">Loading more…</T> : null}
      {moreError ? <Banner tone="error" title="Couldn't load more" text={moreError} /> : null}
      {moreError ? <Button title="Try again" kind="secondary" small onPress={loadMore} /> : null}
      {!current.next ? <T variant="caption" color="muted" style={{ textAlign: 'center' }}>Kept for years: sales, prices, stock, orders and team records are never deleted; sign-ins are kept 1 year.</T> : null}
    </View>
  ) : null;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Activity" onBack={goBack} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        contentContainerStyle={{ paddingHorizontal: tablet ? 40 : 20, paddingBottom: space.scroll, width: '100%', maxWidth: 760, alignSelf: 'center' }}
        renderItem={({ item, index }) => {
          if (item.header) return <T variant="label" color="muted" style={{ marginTop: 18, marginBottom: 8, marginLeft: 4 }}>{item.header}</T>;
          const next = rows[index + 1];
          const prev = rows[index - 1];
          const first = !prev || prev.header;
          const last = !next || next.header;
          return (
            <View style={{ backgroundColor: c.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border, borderTopWidth: first ? 1 : 0, borderBottomWidth: last ? 1 : 0, borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0, borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0, overflow: 'hidden' }}>
              <EntryRow e={item.entry} onPress={() => tap(item.entry)} last={last} />
            </View>
          );
        }}
      />
      {filters ? <FilterSheet view={view} people={people.items} morePeople={people.hasMore ? people.loadMore : null} loadingPeople={people.more} onClose={() => setFilters(false)} onApply={(v) => { setView(v); setFilters(false); }} /> : null}
      <EntrySheet e={open} onClose={() => setOpen(null)} />
    </View>
  );
}
