// Owners: the period's counter and WhatsApp sales recorded without an invoice (6.3).
// Open one to "Make an invoice" for a customer who comes back (6.5, same month only).
// 20 at a time; the count and ₹ at the top cover the whole period.
import { useCallback } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { Banner } from '../../../../components/Banner';
import { Badge, Card, Row } from '../../../../components/Bits';
import { T } from '../../../../components/T';
import { Thumb } from '../../../../components/catalog/Thumb';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { usePaged, nearEnd } from '../../../../hooks/usePaged';
import { MoreFooter } from '../../../../components/MoreFooter';
import * as invoices from '../../../../api/invoices';
import { rupees } from '../../../../utils/catalog';
import { PAY_TEXT, rangeLabel } from '../../../../utils/invoices';

export default function SalesWithoutInvoice() {
  const { from, to, channel = 'all' } = useLocalSearchParams();
  const space = useTabBarSpace();
  const page = useCallback((offset) => invoices.salesWithout({ from, to, channel, offset }), [from, to, channel]);
  const paged = usePaged(page, 'sales');
  const { load, data } = paged;
  const error = paged.error && !data ? paged.error.message : null;
  const list = paged.items;
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Screen top={<TopBar title="Sales without an invoice" onBack={() => router.back()} />} contentStyle={{ paddingBottom: space.scroll }} onScroll={(e) => { if (nearEnd(e)) paged.loadMore(); }}>
      <T variant="small" color="muted" style={{ marginBottom: 12 }}>{rangeLabel({ from, to })}. A customer who comes back can get an invoice for a sale this month: open the sale, then Make an invoice.</T>
      {error ? <Banner tone="error" title="Couldn't load the sales" text={error} /> : null}
      {data ? <T variant="smallStrong" style={{ marginBottom: 8 }}>{data.totals.count} sale{data.totals.count === 1 ? '' : 's'} · {rupees(data.totals.amount)}</T> : null}
      {data && list.length ? (
        <Card>
          {list.map((s, i) => (
            <Row key={s.id} last={i === list.length - 1} onPress={() => router.push(`/scan/sale/${s.id}`)}
              leading={<Thumb uri={s.imageUrl} width={40} height={54} />}
              title={`${s.date}, ${s.time} · ${s.sarees} saree${s.sarees === 1 ? '' : 's'}`}
              subtitle={`${s.channel === 'whatsapp' ? 'WhatsApp · ' : ''}${PAY_TEXT[s.paymentMethod] || 'Not recorded'}${s.soldBy ? ` · ${s.soldBy}` : ''}${s.canMakeInvoice ? '' : ' · last month'}`}
              right={<T variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>{rupees(s.total)}</T>}
            />
          ))}
        </Card>
      ) : null}
      {data ? <MoreFooter paged={paged} allText={`That's all ${paged.total} sales.`} /> : null}
      {data && !list.length ? <Badge text="Every sale in this period has an invoice" tone="success" /> : null}
      {!data && !error ? <T color="muted" style={{ textAlign: 'center', marginTop: 30 }}>Loading…</T> : null}
    </Screen>
  );
}
