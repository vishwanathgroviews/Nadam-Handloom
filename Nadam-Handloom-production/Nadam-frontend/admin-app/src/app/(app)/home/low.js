// Running low (Module 8, decision 6.5, owners): designs (subcategories) sold out in the
// last 30 days and designs with 1–3 sarees left, to order again from the weavers.
// Tap one to see its sarees in Products.
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { StatusBanner } from '../../../components/StatusBanner';
import { Banner } from '../../../components/Banner';
import { Card, Row, SectionLabel } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/T';
import { Thumb } from '../../../components/catalog/Thumb';
import { LockNote } from '../../../components/sales/SaleParts';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { useCan, PERMISSION } from '../../../auth/permissions';
import * as home from '../../../api/home';

function Designs({ list, line }) {
  return (
    <Card>
      {list.map((d, i) => (
        <Row key={d.id} last={i === list.length - 1} onPress={() => router.push(`/products/sub/${d.id}?back=home`)}
          leading={<Thumb uri={d.imageUrl} width={40} height={54} />}
          title={<T variant="bodyStrong" numberOfLines={2}>{d.name}</T>}
          subtitle={`${d.category}\n${line(d)}`} />
      ))}
    </Card>
  );
}

export default function RunningLow() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.SALES_VIEW);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(await home.runningLow());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { if (owner) load(); }, [owner, load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const none = data && !data.soldOut.length && !data.low.length;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Running low" onBack={() => (router.canGoBack() ? router.back() : router.dismissTo('/home'))} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll, width: '100%', maxWidth: 680, alignSelf: 'center' }} refreshControl={owner ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined}>
        {!owner ? <LockNote text="Stock running low is for owners." style={{ marginTop: 12 }} /> : (
          <>
            <T variant="small" color="muted">Designs (subcategories) to order again. Tap one to see its sarees.</T>
            {error ? <Banner tone="error" title="Couldn't load" text={error} style={{ marginTop: 12 }} /> : null}
            {!data && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
            {none ? (
              <View style={{ marginTop: 16, minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, padding: 16 }}>
                <Icon name="check" size={32} color={c.success} />
                <T variant="bodyStrong" color="text2">Nothing running low</T>
                <T variant="small" color="muted" style={{ textAlign: 'center' }}>Every design with sarees has more than 3 left.</T>
              </View>
            ) : null}
            {data?.soldOut.length ? (
              <>
                <SectionLabel>{`Sold out · last ${data.days} days (${data.soldOut.length})`}</SectionLabel>
                <Designs list={data.soldOut} line={(d) => `Sold out · last sold ${d.lastSold} · ${d.soldRecent} sold in ${data.days} days`} />
              </>
            ) : null}
            {data?.low.length ? (
              <>
                <SectionLabel>{`Running low · 1–3 left (${data.low.length})`}</SectionLabel>
                <Designs list={data.low} line={(d) => `${d.left} left · ${d.soldRecent} sold in ${data.days} days`} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
