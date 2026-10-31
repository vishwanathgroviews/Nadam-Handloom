// One person's sales in the period (Module 9, 6.7, owners): bills, sarees, ₹, the share
// of store price they sold at, the designs they sold most and their last bills.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../../components/Screen';
import { StatusBanner } from '../../../../../components/StatusBanner';
import { Banner } from '../../../../../components/Banner';
import { Badge } from '../../../../../components/Bits';
import { T } from '../../../../../components/T';
import { DesignRow, Kpis, Panel } from '../../../../../components/analytics/Parts';
import { LockNote } from '../../../../../components/sales/SaleParts';
import { useTheme } from '../../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../../hooks/useTabBarSpace';
import { useBack } from '../../../../../hooks/useBack';
import { useCan, PERMISSION } from '../../../../../auth/permissions';
import { useAnalyticsView, queryOf } from '../../../../../analytics/view';
import * as analytics from '../../../../../api/analytics';
import { rupees } from '../../../../../utils/catalog';
import { plural } from '../../../../../utils/sales';
import { PAYMENT, ROLE, maxOf } from '../../../../../utils/analytics';

export default function Person() {
  const goBack = useBack();
  const { id } = useLocalSearchParams();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.ANALYTICS_VIEW);
  const v = useAnalyticsView();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const q = JSON.stringify(queryOf(v));
  useFocusEffect(useCallback(() => { if (owner) analytics.person(id, JSON.parse(q)).then(setData, (e) => setError(e.message)); }, [owner, id, q]));
  const p = data?.person;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title={p ? p.name : 'Person'} onBack={goBack} right={p ? <View style={{ marginRight: 14 }}><Badge text={ROLE[p.role]} tone={p.role === 'owner' ? 'owner' : 'staff'} /></View> : null} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll, gap: 12, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        {!owner ? <LockNote text="Each person's sales are for owners." /> : null}
        {error ? <Banner tone="error" title="Couldn't load" text={error} /> : null}
        {data ? (
          <>
            <T variant="caption" color="muted">{data.range.label}</T>
            <Panel>
              <Kpis items={[
                { label: 'Sales', value: rupees(data.totals.amount) },
                { label: 'Bills', value: String(data.totals.bills) },
                { label: 'Sarees', value: String(data.totals.sarees) },
                { label: 'Of store price', value: data.totals.paidPct != null ? `${data.totals.paidPct}%` : '—' },
              ]} />
            </Panel>
            <Panel title="Designs they sold most">
              {data.designs.length ? data.designs.map((d, i) => <DesignRow key={d.id || d.name} d={d} max={maxOf(data.designs, 'sarees')} by="sarees" last={i === data.designs.length - 1} />) : <T variant="small" color="muted">Nothing sold by {p.name.split(' ')[0]} in this period.</T>}
            </Panel>
            {data.recent.length ? (
              <Panel title="Last bills">
                {data.recent.map((b, i) => (
                  <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/scan/sale/${b.id}`)} android_ripple={{ color: c.surface2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i === data.recent.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                      <View style={{ flex: 1 }}>
                        <T variant="smallStrong">{b.date}, {b.time} · {plural(b.sarees, 'saree')}</T>
                        <T variant="caption" color="muted">{(PAYMENT[b.payment] || ['Not recorded'])[0]}{b.paidPct != null ? ` · ${b.paidPct}% of store price` : ''}</T>
                      </View>
                      <T variant="smallStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(b.total)}</T>
                    </View>
                  </Pressable>
                ))}
              </Panel>
            ) : null}
          </>
        ) : owner && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      </ScrollView>
    </View>
  );
}
