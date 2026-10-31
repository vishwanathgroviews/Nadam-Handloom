// Today's sales (5.6), newest first. Owners see every sale and the day's total, with
// today's paid online orders too, so the total matches Home (Module 8); Staff see only
// their own sales and no total (6.13: money totals are for owners). 20 at a time.
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useBack } from '../../../hooks/useBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { StatusBanner } from '../../../components/StatusBanner';
import { Banner } from '../../../components/Banner';
import { Badge, Card, Row } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/T';
import { Thumb } from '../../../components/catalog/Thumb';
import { LockNote } from '../../../components/sales/SaleParts';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import * as sales from '../../../api/sales';
import { usePaged, nearEnd } from '../../../hooks/usePaged';
import { MoreFooter } from '../../../components/MoreFooter';
import { PAY, plural, rupees } from '../../../utils/sales';

export default function Today() {
  const goBack = useBack();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const [refreshing, setRefreshing] = useState(false);
  const page = useCallback((offset) => sales.today(offset), []);
  const paged = usePaged(page, 'sales');
  const { load, data } = paged;
  const error = paged.error && !data ? paged.error.message : null;
  const list = paged.items;
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const owner = data?.scope === 'everyone';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Today's sales" onBack={goBack} right={data ? <T variant="small" color="muted" style={{ marginRight: 14 }}>{data.date}</T> : null} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.scroll, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onScroll={(e) => { if (nearEnd(e)) paged.loadMore(); }} scrollEventThrottle={200}>
        {error ? <Banner tone="error" title="Couldn't load today's sales" text={error} /> : null}
        {data && owner ? (
          <View style={{ padding: 15, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <T variant="small" color="muted">{plural(data.totals.count, 'sale')} today · {plural(data.totals.sarees, 'saree')}</T>
                <T variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{rupees(data.totals.amount)}</T>
              </View>
              <T variant="caption" color="muted">{data.totals.cancelled ? `${data.totals.cancelled} cancelled, not counted` : 'Cancelled sales not counted'}</T>
            </View>
            <T variant="small" color="text2">Cash {rupees(data.totals.byPayment.cash)} · UPI {rupees(data.totals.byPayment.upi)} · Card {rupees(data.totals.byPayment.card)}{data.totals.byPayment.online ? ` · Online ${rupees(data.totals.byPayment.online)}` : ''}{data.totals.byPayment.unknown ? ` · Not recorded ${rupees(data.totals.byPayment.unknown)}` : ''}</T>
          </View>
        ) : null}
        {data && !owner ? <LockNote text="Your sales today. Owners see everyone's sales and the day's total." /> : null}
        {data && !list.length ? (
          <View style={{ minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong }}>
            <Icon name="history" size={36} color={c.muted} />
            <T variant="bodyStrong" color="text2">No sales yet today</T>
            <T variant="small" color="muted">{owner ? 'Sales from every phone show here.' : 'Your sales show here.'}</T>
          </View>
        ) : null}
        {data && list.length ? (
          <Card>
            {list.map((s, i) => (
              <Row key={s.id} last={i === list.length - 1} onPress={() => router.push(s.channel === 'online' ? `/orders/order/${s.id}` : `/scan/sale/${s.id}`)}
                accessibilityLabel={`${s.time}, ${plural(s.sarees, 'saree')}, ${rupees(s.total)}${s.cancelled ? ', cancelled' : ''}`}
                leading={<Thumb uri={s.imageUrl} width={40} height={54} />}
                title={(
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <T variant="bodyStrong">{s.time} · {plural(s.sarees, 'saree')}</T>
                    {s.channel === 'whatsapp' ? <Badge text="WhatsApp" tone="success" /> : s.channel === 'online' ? <Badge text="Online" tone="info" /> : null}
                    {s.cancelled ? <Badge text="Cancelled" tone="danger" /> : null}
                  </View>
                )}
                subtitle={s.channel === 'online' ? `${s.customer || 'Website customer'} · paid online · ${s.invoiceNumber || 'invoice pending'}` : `${PAY[s.paymentMethod] || 'Payment not recorded'} · ${s.soldBy?.name || 'Unknown'} · ${s.invoiceNumber || (s.invoiceRequired ? 'invoice pending' : 'no invoice')}`}
                right={<T variant="bodyStrong" color={s.cancelled ? 'muted' : 'text'} style={{ fontVariant: ['tabular-nums'], textDecorationLine: s.cancelled ? 'line-through' : 'none' }}>{rupees(s.total)}</T>}
              />
            ))}
          </Card>
        ) : null}
        {data ? <MoreFooter paged={paged} allText={`That's all ${paged.total} sales today.`} /> : null}
        {!data && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
      </ScrollView>
    </View>
  );
}
