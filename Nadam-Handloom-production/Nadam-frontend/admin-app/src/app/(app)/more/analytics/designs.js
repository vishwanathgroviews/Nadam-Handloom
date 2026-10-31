// Every design sold in the period (Module 9, 6.5), by sarees or by ₹. Tap one to see
// its sarees in Products.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { Banner } from '../../../../components/Banner';
import { T } from '../../../../components/T';
import { DesignRow, Panel } from '../../../../components/analytics/Parts';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { useBack } from '../../../../hooks/useBack';
import { analyticsView, useAnalyticsView, queryOf } from '../../../../analytics/view';
import * as analytics from '../../../../api/analytics';
import { plural } from '../../../../utils/sales';
import { CHANNELS, maxOf } from '../../../../utils/analytics';

export default function AllDesigns() {
  const goBack = useBack();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const v = useAnalyticsView();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const q = JSON.stringify(queryOf(v));
  useFocusEffect(useCallback(() => { analytics.summary(JSON.parse(q)).then(setData, (e) => setError(e.message)); }, [q]));
  const list = data ? [...data.designs].sort((a, b) => (v.sort === 'amount' ? b.amount - a.amount : b.sarees - a.sarees || b.amount - a.amount)) : [];
  const max = maxOf(list, v.sort === 'amount' ? 'amount' : 'sarees');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="All designs" onBack={goBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll, gap: 12, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
        {data ? <T variant="caption" color="muted">{data.range.label} · {CHANNELS.find((x) => x[0] === v.channel)[1]} · {plural(list.length, 'design')}</T> : null}
        {error ? <Banner tone="error" title="Couldn't load" text={error} /> : null}
        <View style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 999, backgroundColor: c.surface2 }}>
          {[['sarees', 'By sarees'], ['amount', 'By ₹']].map(([k, label]) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: v.sort === k }} onPress={() => analyticsView.set({ sort: k })}
              style={{ flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: v.sort === k ? c.surface : 'transparent' }}>
              <T variant="smallStrong" color={v.sort === k ? 'text' : 'text2'}>{label}</T>
            </Pressable>
          ))}
        </View>
        {data ? (
          <Panel>
            {list.length ? list.map((d, i) => <DesignRow key={d.id || d.name} d={d} rank={i + 1} max={max} by={v.sort} last={i === list.length - 1} />) : <T variant="small" color="muted">No designs sold in this period.</T>}
          </Panel>
        ) : !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      </ScrollView>
    </View>
  );
}
