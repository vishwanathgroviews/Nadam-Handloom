// Price check (5.5, decision 6.11): scan to see a saree's photo, prices and status.
// It never touches the bill.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useBack } from '../../../hooks/useBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { Badge, Card } from '../../../components/Bits';
import { Button } from '../../../components/Button';
import { T } from '../../../components/T';
import { useFeedback } from '../../../components/Feedback';
import { Thumb } from '../../../components/catalog/Thumb';
import { TagChip } from '../../../components/products/TagChip';
import { ScanFrame, TagScanner } from '../../../components/products/TagScanner';
import { TagEntryModal } from '../../../components/products/TagEntryModal';
import { useTheme } from '../../../theme/ThemeProvider';
import { useBill } from '../../../sales/bill';
import * as sales from '../../../api/sales';
import { plural, rupees, stockBadgeFor } from '../../../utils/sales';

export default function PriceCheck() {
  const goBack = useBack();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useFeedback();
  const bill = useBill();
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [torch, setTorch] = useState(false);
  const [r, setR] = useState(null);

  async function onCode(code, lookupCode = code) {
    if (busy) return;
    setBusy(true);
    try {
      setR(await sales.lookup(lookupCode));
    } catch (e) {
      if (e.code === 'TAG_UNKNOWN') setR({ unknown: code });
      else showToast(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'No internet. Price check needs internet.' : e.message);
    } finally {
      setBusy(false);
    }
  }

  const s = r?.saree;
  const onBill = s && bill.lines.some((l) => l.pieceId === s.pieceId);
  const [badge, tone] = r && !r.unknown ? (onBill ? ['On your bill', 'neutral'] : stockBadgeFor(r)) : [];
  const fact = (label, value) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
      <T variant="small" color="muted">{label}</T><T variant="smallStrong">{value}</T>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <TopBar title="Price check" onBack={goBack} right={<T variant="caption" color="muted" style={{ marginRight: 14 }}>Bill stays as it is ({plural(bill.lines.length, 'saree')})</T>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <TagScanner onCode={(code) => onCode(code)} paused={busy || typing} torch={torch} style={{ height: 230 }}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: '13%' }}>
            <ScanFrame hint={busy ? 'Looking it up…' : 'Point at the saree\'s tag'} />
          </View>
        </TagScanner>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Type" icon="keyboard" kind="secondary" small onPress={() => setTyping(true)} style={{ flex: 1 }} />
          <Button title={torch ? 'Torch off' : 'Torch'} icon="flash" kind="secondary" small onPress={() => setTorch((x) => !x)} style={{ flex: 1 }} />
        </View>
        {r?.unknown ? <Card style={{ padding: 16 }}><T variant="bodyStrong">No saree has {r.unknown}</T><T variant="small" color="muted">It isn&apos;t in the shop yet.</T></Card> : null}
        {s ? (
          <Card style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Thumb uri={s.imageUrl} width={72} height={96} />
              <View style={{ flex: 1, gap: 5 }}>
                <T variant="bodyStrong">{s.name}</T>
                <T variant="caption" color="muted">{s.sku}</T>
                <TagChip code={s.code} tone={s.status.startsWith('sold') ? 'sold' : 'plain'} />
                <Badge text={badge} tone={tone} />
              </View>
            </View>
            {r.problem ? <T variant="small" color="text2">{r.problem.message}</T> : null}
            <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 6 }}>
              {fact('Store price', rupees(s.storePrice))}
              {fact('Website price', rupees(s.websitePrice))}
              {fact('MRP', rupees(s.mrp))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
      <TagEntryModal visible={typing} onClose={() => setTyping(false)}
        onSubmit={(code) => { setTyping(false); setTimeout(() => onCode(code, code.replace(/^NH(?=\d{1,6}$)/, '')), 250); }} />
    </View>
  );
}
