// Home (Module 8, picks A and A): how the day is going and what needs doing.
// Owners: today's sales (Counter / WhatsApp / Online, yesterday, the month) with an eye
// button to hide the amounts; Staff: their own sarees and bills, never the shop's totals.
// Then Needs attention (each line only when there is something), four shortcuts, the
// last 3 sales. Updates on open, on pull-down and every minute while open; offline it
// keeps the last numbers with "Updated 7:52 pm". Docs Module 8, sections 5–8.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBanner } from '../../../components/StatusBanner';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Avatar, Badge, Card, SectionLabel } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/T';
import { Thumb } from '../../../components/catalog/Thumb';
import { useTheme, useIsTablet } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { useOnline } from '../../../hooks/useOnline';
import { useSession } from '../../../auth/session';
import { useBill } from '../../../sales/bill';
import { useBatch } from '../../../products/batch';
import { useUploads } from '../../../products/queue';
import { homePrefs, useHomePrefs, lastHome, keepHome } from '../../../home/prefs';
import { analyticsView } from '../../../analytics/view';
import * as home from '../../../api/home';
import { PAY, plural } from '../../../utils/sales';
import { CHANNELS, attentionList, clockTime, greeting, money, updatedText } from '../../../utils/home';
import { useOnResume } from '../../../gate/store';

const REFRESH_MS = 60000; // decision 6.10

function SalesCard({ s, hide, c, radius }) {
  const t = s.today;
  const bar = CHANNELS.filter(([k]) => t.byChannel[k].amount > 0);
  const colour = { store: c.primary, whatsapp: c.success, online: c.accent };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Today's sales${hide ? '' : `, ${money(t.amount)}`}, ${plural(t.bills, 'bill')}. Open the list`} onPress={() => router.push('/scan/today?back=home')}
      style={({ pressed }) => ({ padding: 16, gap: 8, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: pressed ? c.primary : c.border })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T variant="smallStrong">Today&apos;s sales</T>
        <T variant="caption" color="muted">{plural(t.bills, 'bill')} · {plural(t.sarees, 'saree')}</T>
      </View>
      <T variant="title" style={{ fontVariant: ['tabular-nums'] }}>{money(t.amount, hide)}</T>
      {t.bills ? (
        <>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, backgroundColor: c.surface3 }}>
            {bar.map(([k]) => <View key={k} style={{ flex: t.byChannel[k].amount, minWidth: 6, backgroundColor: colour[k] }} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
            {CHANNELS.map(([k, label]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colour[k] }} />
                <T variant="small" color="text2">{label} <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>{money(t.byChannel[k].amount, hide)}</T></T>
              </View>
            ))}
          </View>
        </>
      ) : <T variant="small" color="muted">No sales yet today</T>}
      <Pressable accessibilityRole="link" accessibilityLabel={`${s.month.name} so far. Open Analytics`} hitSlop={6}
        onPress={() => { analyticsView.set({ period: 'month', custom: null, channel: 'all', tab: 'sales' }); router.push('/more/analytics?back=home'); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: c.border, paddingTop: 8 }}>
        <T variant="caption" color="muted" style={{ flex: 1, fontVariant: ['tabular-nums'] }}>Yesterday {money(s.yesterday.amount, hide)} · {s.month.name} so far {money(s.month.amount, hide)}</T>
        <T variant="caption" color="primary" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Analytics</T>
        <Icon name="right" size={14} color={c.primary} />
      </Pressable>
    </Pressable>
  );
}

function StaffCard({ mine, c, radius }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/scan/today?back=home')}
      style={({ pressed }) => ({ padding: 16, gap: 6, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: pressed ? c.primary : c.border })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T variant="smallStrong">Your sales today</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="lock" size={14} color={c.muted} /><T variant="caption" color="muted">No money totals</T></View>
      </View>
      {mine.bills ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <T variant="title">{plural(mine.sarees, 'saree')}</T>
          <T variant="small" color="muted">sold · {plural(mine.bills, 'bill')}</T>
        </View>
      ) : <T variant="small" color="muted">No sales yet today</T>}
      <T variant="caption" color="muted">Owners see the shop&apos;s totals.</T>
    </Pressable>
  );
}

function AttentionRows({ list, onOpen, c, radius }) {
  const tones = { warning: [c.warningSoft, c.warning], danger: [c.dangerSoft, c.danger], info: [c.infoSoft, c.info], accent: [c.accentSoft, c.accent], primary: [c.primarySoft, c.primary] };
  if (!list.length) {
    return (
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: radius.lg, backgroundColor: c.successSoft }}>
        <Icon name="check" color={c.success} />
        <View style={{ flex: 1 }}>
          <T variant="smallStrong">All caught up</T>
          <T variant="caption" color="text2">Nothing waiting. New orders and anything unfinished show here.</T>
        </View>
      </View>
    );
  }
  return (
    <Card>
      {list.map((a, i) => {
        const [bg, fg] = tones[a.tone] || tones.primary;
        return (
          <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.subtitle}`} onPress={() => onOpen(a)} android_ripple={{ color: c.surface2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
              <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={a.icon} size={19} color={fg} /></View>
              <View style={{ flex: 1 }}>
                <T variant="smallStrong">{a.title}</T>
                <T variant="caption" color={a.warn ? 'warning' : 'muted'} style={a.warn ? { fontFamily: 'PlusJakartaSans_700Bold' } : null}>{a.subtitle}</T>
              </View>
              <Icon name="right" size={18} color={c.muted} />
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

function Shortcuts({ c, radius }) {
  const items = [['Sell', 'scan', '/scan'], ['Price check', 'tag', '/scan/price-check?back=home'], ['Add sarees', 'plus', '/products/add/pick'], ["Today's sales", 'receipt', '/scan/today?back=home']];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map(([label, icon, href], i) => (
        <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => router.push(href)}
          style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: pressed ? c.primary : c.border })}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? c.primary : c.primarySoft }}>
            <Icon name={icon} size={20} color={i === 0 ? c.onPrimary : c.primary} />
          </View>
          <T variant="caption" style={{ textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold' }} numberOfLines={2}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

function Recent({ list, owner, hide, c, radius }) {
  if (!list.length) {
    return (
      <View style={{ minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, padding: 16 }}>
        <Icon name="history" size={30} color={c.muted} />
        <T variant="smallStrong" color="text2">No sales yet today</T>
        <T variant="caption" color="muted">{owner ? 'Sales from every phone show here.' : 'Your sales show here.'}</T>
      </View>
    );
  }
  return (
    <Card>
      {list.map((s, i) => (
        <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.time}, ${plural(s.sarees, 'saree')}${hide ? '' : `, ${money(s.total)}`}`}
          onPress={() => router.push(s.channel === 'online' ? `/orders/order/${s.id}?back=home` : `/scan/sale/${s.id}?back=home`)} android_ripple={{ color: c.surface2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
            <Thumb uri={s.imageUrl} width={38} height={50} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <T variant="smallStrong">{s.time} · {plural(s.sarees, 'saree')}</T>
                {s.channel === 'whatsapp' ? <Badge text="WhatsApp" tone="success" /> : s.channel === 'online' ? <Badge text="Online" tone="info" /> : null}
              </View>
              <T variant="caption" color="muted" numberOfLines={1}>{s.channel === 'online' ? `${s.customer || 'Website customer'} · paid online` : `${PAY[s.paymentMethod] || 'Payment not recorded'}${owner && s.soldBy ? ` · ${s.soldBy.name}` : ''}`}</T>
            </View>
            <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>{money(s.total, hide)}</T>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

export default function Home() {
  const s = useSession();
  const { c, radius } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const online = useOnline();
  const prefs = useHomePrefs();
  const bill = useBill();
  const batch = useBatch();
  const uploads = useUploads();
  const userId = s.user?.id;
  const kept = lastHome(userId);
  const [data, setData] = useState(kept?.data ?? null);
  const [at, setAt] = useState(kept?.at ?? 0);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, tick] = useState(0);
  const busy = useRef(false);

  useEffect(() => { homePrefs.load(); }, []);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await home.getHome();
      const now = Date.now();
      keepHome(userId, r, now);
      setData(r);
      setAt(now);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      busy.current = false;
    }
  }, [userId]);
  // On open and every minute while Home is on screen (6.10).
  useFocusEffect(useCallback(() => {
    load();
    const id = setInterval(() => { load(); tick((n) => n + 1); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]));
  useOnResume(load);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const owner = data ? data.scope === 'everyone' : s.user?.role === 'owner';
  const hide = owner && prefs.hide;
  const list = attentionList({ data, bill, batch, uploads, online, summarySeen: prefs.summarySeen });
  function open(a) {
    if (a.seen) homePrefs.markSummarySeen(a.seen);
    router.push(a.href);
  }
  const first = (s.user?.name || '').split(' ')[0];
  const stale = !!error && !!data;

  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 14 }}>
      <Avatar name={s.user?.name} />
      <View style={{ flex: 1 }}>
        <T variant="heading" numberOfLines={2}>{greeting(new Date().getHours())}{first ? `, ${first}` : ''}</T>
        <T variant="small" color={stale ? 'warning' : 'muted'} style={stale ? { fontFamily: 'PlusJakartaSans_600SemiBold' } : null}>
          {data ? `${data.day} · Updated ${stale ? clockTime(at) : updatedText(at)}` : 'Nandam Handlooms · Mangalagiri'}
        </T>
      </View>
      {owner ? (
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: hide }} accessibilityLabel={hide ? 'Show amounts' : 'Hide amounts'} onPress={() => homePrefs.setHide(!prefs.hide)} hitSlop={6}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: hide ? c.primarySoft : c.surface, borderWidth: hide ? 0 : 1, borderColor: c.border }}>
          <Icon name={hide ? 'eyeoff' : 'eye'} size={21} color={hide ? c.primary : c.text} />
        </Pressable>
      ) : <Badge text="Staff" tone="staff" />}
    </View>
  );

  const left = data ? (
    <>
      {owner ? <SalesCard s={data.sales} hide={hide} c={c} radius={radius} /> : <StaffCard mine={data.sales.mine} c={c} radius={radius} />}
      <SectionLabel>Needs attention</SectionLabel>
      <AttentionRows list={list} onOpen={open} c={c} radius={radius} />
    </>
  ) : null;
  const right = data ? (
    <>
      <SectionLabel>Shortcuts</SectionLabel>
      <Shortcuts c={c} radius={radius} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>{owner ? 'Recent sales' : 'Your recent sales'}</SectionLabel>
        {data.recent.length ? <Pressable accessibilityRole="link" onPress={() => router.push('/scan/today?back=home')} hitSlop={8} style={{ marginTop: 14 }}><T variant="smallStrong" color="primary">See all</T></Pressable> : null}
      </View>
      <Recent list={data.recent} owner={owner} hide={hide} c={c} radius={radius} />
      {data.stock ? <T variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 16, fontVariant: ['tabular-nums'] }}>{data.stock.inStock.toLocaleString('en-IN')} sarees in stock · limit {data.stock.limit.toLocaleString('en-IN')}</T> : null}
    </>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <ScrollView contentContainerStyle={{ paddingHorizontal: tablet ? 40 : 20, paddingBottom: space.scroll }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {head}
        {!data && error ? (
          <View style={{ gap: 10 }}>
            <Banner tone="error" title="Couldn't load Home" text={`${error.message} Selling and orders need internet.`} />
            <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
            {list.length ? <><SectionLabel>On this phone</SectionLabel><AttentionRows list={list} onOpen={open} c={c} radius={radius} /></> : null}
            <SectionLabel>Shortcuts</SectionLabel>
            <Shortcuts c={c} radius={radius} />
          </View>
        ) : null}
        {!data && !error ? (
          <View style={{ gap: 12 }}>
            <View style={{ height: 170, borderRadius: radius.lg, backgroundColor: c.surface3 }} />
            <View style={{ height: 210, borderRadius: radius.lg, backgroundColor: c.surface2 }} />
          </View>
        ) : null}
        {data ? (
          tablet ? (
            <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}>
              <View style={{ flex: 1.1 }}>{left}</View>
              <View style={{ flex: 1, marginTop: -22 }}>{right}</View>
            </View>
          ) : <>{left}{right}</>
        ) : null}
      </ScrollView>
    </View>
  );
}
