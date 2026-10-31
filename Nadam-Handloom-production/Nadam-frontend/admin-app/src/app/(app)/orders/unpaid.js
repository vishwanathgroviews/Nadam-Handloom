// Unpaid website checkouts (owners, decision 6.7): who tried to buy and didn't pay,
// with Call and WhatsApp. Nothing is held: the sarees are back on sale. 20 at a time.
import { useCallback } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useBack } from '../../../hooks/useBack';
import { Screen, TopBar } from '../../../components/Screen';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Bits';
import { T } from '../../../components/T';
import { Thumb } from '../../../components/catalog/Thumb';
import { LockNote } from '../../../components/sales/SaleParts';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { useCan, PERMISSION } from '../../../auth/permissions';
import * as orders from '../../../api/orders';
import { usePaged, nearEnd } from '../../../hooks/usePaged';
import { MoreFooter } from '../../../components/MoreFooter';
import { rupees } from '../../../utils/catalog';
import { telLink, waLink } from '../../../utils/orders';

export default function Unpaid() {
  const goBack = useBack();
  const { c } = useTheme();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.SALES_VIEW);
  const page = useCallback((offset) => orders.unpaidCheckouts(offset), []);
  const paged = usePaged(page, 'customers');
  const { load, data } = paged;
  const error = paged.error && !data ? paged.error.message : null;
  const list = paged.items;
  useFocusEffect(useCallback(() => { if (owner) load(); }, [load, owner]));
  return (
    <Screen top={<TopBar title="Unpaid checkouts" onBack={goBack} />} contentStyle={{ paddingBottom: space.scroll }} onScroll={(e) => { if (nearEnd(e)) paged.loadMore(); }}>
      {!owner ? <LockNote text="Unpaid website checkouts are for owners." style={{ marginTop: 12 }} /> : (
        <>
          <T variant="small" color="muted" style={{ marginBottom: 12 }}>Website checkouts that weren&apos;t paid in the last 30 days. Nothing is held: the sarees are back on sale. Several tries can mean the payment step is failing for the customer.</T>
          {error ? <Banner tone="error" title="Couldn't load them" text={error} /> : null}
          {data ? <T variant="smallStrong" style={{ marginBottom: 8 }}>{data.totals.customers} customer{data.totals.customers === 1 ? '' : 's'} · {data.totals.checkouts} checkout{data.totals.checkouts === 1 ? '' : 's'}</T> : null}
          {data && list.length ? (
            <Card>
              {list.map((u, i) => (
                <View key={u.id} style={{ flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: c.border }}>
                  <Thumb uri={u.imageUrl} width={44} height={58} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T variant="bodyStrong">{u.name}</T>
                    <T variant="small" color="muted">{u.sarees} saree{u.sarees === 1 ? '' : 's'} · {rupees(u.amount)} · last {u.last}</T>
                    <T variant="caption" color={u.tries > 2 ? 'warning' : 'muted'} style={u.tries > 2 ? { fontFamily: 'PlusJakartaSans_700Bold' } : null}>Tried {u.tries} time{u.tries === 1 ? '' : 's'}</T>
                    {u.mobile ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <Button title="Call" icon="phone" kind="secondary" small onPress={() => Linking.openURL(telLink(u.mobile))} style={{ flex: 1 }} />
                        <Button title="WhatsApp" icon="whatsapp" kind="secondary" small onPress={() => Linking.openURL(waLink(u.mobile))} style={{ flex: 1 }} />
                      </View>
                    ) : <T variant="caption" color="muted">No mobile number</T>}
                  </View>
                </View>
              ))}
            </Card>
          ) : null}
          {data ? <MoreFooter paged={paged} allText={`That's all ${paged.total} customers.`} /> : null}
          {data && !list.length ? <Banner tone="success" title="No unpaid checkouts" text="Every website checkout in the last 30 days was paid." /> : null}
        </>
      )}
    </Screen>
  );
}
