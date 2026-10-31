// The bill (5.2): each saree with its store price and an agreed-price box. Empty =
// the store price; a bargain is saved on this sale only, the catalogue price never
// changes. Under half the store price asks "Is this right?" (6.3). Remove a saree,
// clear the bill (asks first), Add more, Complete sale.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useBack } from '../../../hooks/useBack';
import { Screen, TopBar } from '../../../components/Screen';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Bits';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/T';
import { useFeedback } from '../../../components/Feedback';
import { BillLine, TotalBar } from '../../../components/sales/SaleParts';
import { useTheme } from '../../../theme/ThemeProvider';
import { billStore, useBill } from '../../../sales/bill';
import { billTotals, isLowPrice, plural, rupees, unconfirmedLow } from '../../../utils/sales';

export default function Bill() {
  const goBack = useBack();
  const { c, radius } = useTheme();
  const { confirm, showToast } = useFeedback();
  const bill = useBill();
  const t = billTotals(bill.lines);
  const locked = bill.pending;

  function askLow(line, value, { reset, then } = {}) {
    confirm({
      sticky: true, tone: 'warning', icon: 'percent', title: 'Is this price right?',
      text: `${rupees(value)} is under half the store price (${rupees(line.storePrice)}) for ${line.code}.`,
      actions: [
        { label: `Yes, sell at ${rupees(value)}`, kind: 'primary', onPress: () => { billStore.confirmLow(line.pieceId); then?.(); } },
        { label: 'Change it', onPress: () => { billStore.setAgreed(line.pieceId, null); reset?.(); } },
      ],
    });
  }

  function onPriceDone(line, value, opts) {
    if (opts.error) { showToast(opts.error); return; }
    billStore.setAgreed(line.pieceId, value);
    if (opts.done && isLowPrice(value, line.storePrice)) askLow(line, value, { reset: opts.reset });
  }

  function remove(line) {
    billStore.remove(line.pieceId);
    showToast(`${line.code} taken off the bill`);
  }

  function clear() {
    confirm({
      tone: 'danger', icon: 'trash', title: 'Clear the bill?',
      text: locked ? 'The last "Complete sale" got no answer. If it went through, that sale is saved and shows in Today\'s sales. Clear this bill anyway?' : `${t.count === 1 ? 'The saree comes' : `All ${t.count} sarees come`} off the bill. Nothing is sold.`,
      actions: [{ label: 'Clear the bill', kind: 'dangerSolid', onPress: () => { billStore.clear(); router.back(); } }, { label: 'Keep it' }],
    });
  }

  // A very low price nobody confirmed (typed, then Complete straight away) is asked now.
  function complete() {
    const low = unconfirmedLow(billStore.getState().bill.lines);
    if (low) { askLow(low, low.agreed, { then: () => setTimeout(complete, 250) }); return; }
    router.push('/scan/complete');
  }

  return (
    <Screen
      top={<TopBar title={`Bill · ${plural(t.count, 'saree')}`} onBack={goBack} right={t.count ? <Button title="Clear" kind="ghost" small onPress={clear} style={{ marginRight: 6 }} /> : null} />}
      footer={(
        <>
          <Button title={locked ? 'Send Complete sale again' : `Complete sale · ${rupees(t.total)}`} disabled={!t.count} onPress={complete} />
          {locked ? null : <Button title="Add more" icon="scan" kind="secondary" onPress={() => router.back()} />}
        </>
      )}
    >
      {locked ? <Banner tone="warning" icon="clock" title="Waiting for an answer" text="The last Complete sale got no answer, so this bill can't be changed now. Send it again: if it went through, you'll see the sale. Nothing is sold twice." style={{ marginBottom: 12 }} /> : null}
      {t.count ? (
        <>
          {locked ? null : <T variant="small" color="muted" style={{ marginBottom: 10 }}>Leave a price empty to sell at the store price. Type the agreed price for a bargain: the catalogue price doesn&apos;t change.</T>}
          <Card>
            {bill.lines.map((l, i) => (
              <BillLine key={l.pieceId} line={l} editable={!locked} last={i === bill.lines.length - 1} changed={bill.changed?.pieceId === l.pieceId ? bill.changed.short : null} onRemove={remove} onPriceDone={onPriceDone} />
            ))}
          </Card>
          <TotalBar lines={bill.lines} style={{ marginTop: 12 }} />
        </>
      ) : (
        <View style={{ minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, marginTop: 8 }}>
          <Icon name="receipt" size={40} color={c.muted} />
          <T variant="bodyStrong" color="text2">The bill is empty</T>
          <T variant="small" color="muted">Scan a saree to start.</T>
        </View>
      )}
    </Screen>
  );
}
