// Team (owners only): everyone who can use the admin app, with Team and Removed
// tabs and search (on the server), 20 at a time. Docs Module 2, section 5.1.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { Card } from '../../../../components/Bits';
import { Icon } from '../../../../components/Icon';
import { MemberRow } from '../../../../components/team/MemberRow';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTheme } from '../../../../theme/ThemeProvider';
import { listTeam } from '../../../../api/team';
import { teamSummary } from '../../../../utils/team';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { usePaged, nearEnd } from '../../../../hooks/usePaged';
import { MoreFooter } from '../../../../components/MoreFooter';

function Tabs({ tab, counts, onChange }) {
  const { c, radius } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.lg, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, marginBottom: 12 }}>
      {[['team', 'Team'], ['removed', 'Removed']].map(([key, label]) => {
        const on = tab === key;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(key)}
            style={{ flex: 1, minHeight: 42, borderRadius: radius.lg - 4, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? c.surface : 'transparent' }}>
            <T variant="smallStrong" color={on ? 'text' : 'text2'}>{label}</T>
            {counts ? <T variant="caption" color="muted">{counts[key]}</T> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyCard({ icon, title, text, children }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, marginTop: 12 }}>
      <Icon name={icon} size={36} color={c.muted} strokeWidth={1.5} />
      <T variant="bodyStrong" style={{ textAlign: 'center' }}>{title}</T>
      <T variant="small" color="muted" style={{ textAlign: 'center' }}>{text}</T>
      {children}
    </View>
  );
}

export default function Team() {
  const { c, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const [tab, setTab] = useState('team');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState(''); // what was searched: a moment after typing stops
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const page = useCallback((offset) => listTeam({ tab, q: query, offset }).then((r) => ({ ...r, tab })), [tab, query]);
  const paged = usePaged(page, 'members');
  const { load, error } = paged;
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A tab's list is shown once its own answer has come (no flash of the other tab).
  const current = paged.data?.tab === tab ? paged.data : null;
  const shown = current ? paged.items : [];

  if (error?.code === 'FORBIDDEN') return <OwnersOnly />;

  let body;
  if (error) {
    body = (
      <View style={{ gap: 10 }}>
        <Banner tone="error" title="Couldn't load the team" text={error.message} />
        <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  } else if (!current) {
    body = <Card>{[0, 1, 2, 3].map((i) => <View key={i} style={{ height: 58, margin: 8, borderRadius: 12, backgroundColor: c.surface3, opacity: 0.6 }} />)}</Card>;
  } else if (tab === 'removed' && !shown.length && !query) {
    body = <EmptyCard icon="users" title="Nobody has been removed" text="People you remove show here, with their history kept." />;
  } else if (!shown.length) {
    body = <EmptyCard icon="search" title={`No one matches "${query}"`} text="Try a first name or the last digits of the number." />;
  } else {
    body = (
      <>
        <Card>{shown.map((m, i) => <MemberRow key={m.id} member={m} last={i === shown.length - 1} onPress={() => router.push(`/more/team/${m.id}`)} />)}</Card>
        <MoreFooter paged={paged} allText={`That's all ${paged.total} ${paged.total === 1 ? 'person' : 'people'}.`} />
        {tab === 'team' && current.counts.team === 1 && !q ? (
          <EmptyCard icon="userplus" title="It's just you so far" text="Invite your staff or a second owner.">
            <Button title="Invite someone" icon="plus" small onPress={() => router.push('/more/team/invite')} style={{ marginTop: 6 }} />
          </EmptyCard>
        ) : null}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        <TopBar title="Team" onBack={() => router.back()} right={<Button title="Invite" icon="plus" small onPress={() => router.push('/more/team/invite')} style={{ marginRight: 8 }} />} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: space.scroll, width: '100%', maxWidth: 720, alignSelf: 'center' }}
        onScroll={(e) => { if (nearEnd(e)) paged.loadMore(); }} scrollEventThrottle={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Tabs tab={tab} counts={paged.data?.counts} onChange={setTab} />
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: c.borderStrong, borderRadius: radius.md, backgroundColor: c.surface, paddingHorizontal: 12, marginBottom: 10 }}>
          <Icon name="search" size={18} color={c.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search name or number" placeholderTextColor={c.muted} autoCorrect={false} returnKeyType="search"
            accessibilityLabel="Search the team" style={[type.body, { flex: 1, minHeight: 48, paddingHorizontal: 10, color: c.text }]} />
          {q ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={10}><Icon name="x" size={18} color={c.muted} /></Pressable> : null}
        </View>
        {tab === 'team' && current ? <T variant="small" color="muted" style={{ marginBottom: 8, marginLeft: 4 }}>{teamSummary(current.counts)}</T> : null}
        {current && tab === 'team' && !current.hasMainOwner ? <Banner tone="warning" title="No main owner yet" text="The main owner is set once when the new app goes live. Until then, owners can't hand over the title." style={{ marginBottom: 10 }} /> : null}
        {body}
      </ScrollView>
    </View>
  );
}
