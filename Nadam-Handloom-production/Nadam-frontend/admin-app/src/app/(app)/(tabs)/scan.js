// The Scan tab: scan to sell (Module 5). Owner's pick A: the camera fills the screen
// with the bill strip at the bottom. A saree that can be sold goes straight onto the
// bill at its store price; one that can't says exactly why (5.1). The bill is kept on
// the phone. Price check and Today's sales are at the top. Docs Module 5, sections 5–7.
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { StatusBanner } from '../../../components/StatusBanner';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Icon } from '../../../components/Icon';
import { T } from '../../../components/T';
import { useFeedback } from '../../../components/Feedback';
import { Thumb } from '../../../components/catalog/Thumb';
import { TagChip } from '../../../components/products/TagChip';
import { ScanFrame, TagScanner } from '../../../components/products/TagScanner';
import { TagEntryModal } from '../../../components/products/TagEntryModal';
import { BillStrip, LockNote } from '../../../components/sales/SaleParts';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { billStore, useBill } from '../../../sales/bill';
import * as sales from '../../../api/sales';
import { MAX_LINES, PROBLEM_ICON, PROBLEM_TITLE, rupees } from '../../../utils/sales';

const warn = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

function SareeRow({ saree, code }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 12, padding: 10, borderRadius: radius.md, backgroundColor: c.surface2 }}>
      <Thumb uri={saree?.imageUrl} width={54} height={72} />
      <View style={{ flex: 1, gap: 4 }}>
        {saree ? <T variant="smallStrong" numberOfLines={2}>{saree.name}</T> : null}
        {saree ? <T variant="caption" color="muted">{saree.sku}</T> : null}
        <TagChip code={saree?.code || code} tone={saree?.status?.startsWith('sold') ? 'sold' : 'plain'} />
      </View>
    </View>
  );
}

export default function ScanToSell() {
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { confirm } = useFeedback();
  const bill = useBill();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [torch, setTorch] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  // Scan results show on the camera, so they never cover the bill strip below it.
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(null);
  const note = (text, tone = 'warning') => {
    clearTimeout(flashTimer.current);
    setFlash({ text, tone });
    flashTimer.current = setTimeout(() => setFlash(null), tone === 'success' ? 1800 : 3200);
  };
  useEffect(() => { billStore.load(); return () => clearTimeout(flashTimer.current); }, []);

  // Questions stop the camera until they're answered.
  const ask = (d) => {
    setAsking(true);
    confirm({ sticky: true, ...d, actions: d.actions.map((a) => ({ ...a, onPress: () => { setAsking(false); a.onPress?.(); } })) });
  };
  const backLabel = () => (billStore.getState().bill.lines.length ? 'Back to the bill' : 'Scan again');

  function cantSell(r, code) {
    warn();
    const p = r?.problem;
    if (!r) {
      ask({
        icon: 'barcode', tone: 'warning', title: `No saree has ${code}`, text: 'It isn\'t in the shop yet. Check the number, or add it as a new saree.',
        actions: [{ label: backLabel(), kind: 'primary' }, { label: 'Add as a new saree', onPress: () => router.push(`/products/add/pick?tag=${encodeURIComponent(code)}`) }],
      });
      return;
    }
    const actions = [];
    if (p.code === 'HELD_ONLINE' && p.canSellAnyway) {
      actions.push({
        label: 'Sell anyway', kind: 'dangerSolid', onPress: () => setTimeout(() => ask({
          icon: 'clock', tone: 'warning', title: 'Sell it anyway?',
          text: `It goes on this bill at ${rupees(r.saree.storePrice)}. When you complete the sale, the online customer's checkout is cancelled and they can't pay for it.`,
          actions: [
            { label: 'Sell anyway', kind: 'dangerSolid', onPress: () => { billStore.add(r.saree, { held: true }); note(`Added ${r.saree.code} · its online checkout is cancelled when you complete the sale`, 'success'); } },
            { label: 'Don\'t sell it' },
          ],
        }), 250),
      });
    }
    if (['ONLINE_ONLY', 'DAMAGED', 'SWITCHED_OFF'].includes(p.code)) actions.push({ label: 'Open the saree page', onPress: () => router.push(`/products/${r.saree.productId}`) });
    actions.push({ label: backLabel(), kind: p.code === 'HELD_ONLINE' && p.canSellAnyway ? 'secondary' : 'primary' });
    ask({
      icon: PROBLEM_ICON[p.code] || 'alert', tone: p.code === 'HELD_ONLINE' ? 'warning' : 'danger', title: (PROBLEM_TITLE[p.code] || (() => 'Can\'t be sold'))(r.saree.code), text: p.message,
      content: (
        <View>
          <SareeRow saree={r.saree} />
          {p.code === 'HELD_ONLINE' && !p.canSellAnyway ? <LockNote text="Only owners can sell a saree an online checkout is holding." style={{ marginTop: 10 }} /> : null}
        </View>
      ),
      actions,
    });
  }

  // lookupCode: what the server searches (a typed number alone, so NANDAM2264 is found too).
  async function onCode(code, lookupCode = code) {
    if (busy || asking) return;
    const b = billStore.getState().bill;
    if (b.pending) {
      ask({ icon: 'clock', tone: 'warning', title: 'Send the last bill first', text: 'The last "Complete sale" got no answer. Send it again: if it went through, you\'ll see the sale. Nothing is sold twice.', actions: [{ label: 'Go to Complete sale', kind: 'primary', onPress: () => router.push('/scan/complete') }, { label: 'Not now' }] });
      return;
    }
    if (b.lines.some((l) => l.code === code)) { warn(); note(`${code} is on this bill already. Scan the next saree.`); return; }
    if (b.lines.length >= MAX_LINES) {
      ask({ icon: 'receipt', tone: 'warning', title: 'This bill is full', text: `A bill can have up to ${MAX_LINES} sarees. Complete this one, then start a second bill for the rest.`, actions: [{ label: 'View bill', kind: 'primary', onPress: () => router.push('/scan/bill') }, { label: 'OK' }] });
      return;
    }
    setBusy(true);
    let r;
    try {
      r = await sales.lookup(lookupCode);
    } catch (e) {
      setBusy(false);
      if (e.code === 'TAG_UNKNOWN') return cantSell(null, code);
      if (e.code === 'AMBIGUOUS_CODE') { warn(); return note(e.message); }
      if (e.code === 'NETWORK' || e.code === 'TIMEOUT') { warn(); return note('No internet. A saree can be added only when the phone is online.'); }
      return note(e.message);
    }
    setBusy(false);
    if (billStore.getState().bill.lines.some((l) => l.pieceId === r.saree.pieceId)) { warn(); note(`${r.saree.code} is on this bill already. Scan the next saree.`); return; }
    if (!r.sellable) { cantSell(r, code); return; }
    billStore.add(r.saree);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    note(`Added ${r.saree.code} · ${rupees(r.saree.storePrice)}`, 'success');
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner what="sell" />
      <TopBar title="Sell" right={(
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Button title="Price check" icon="tag" kind="ghost" small onPress={() => router.push('/scan/price-check')} />
          <Pressable accessibilityRole="button" accessibilityLabel="Today's sales" onPress={() => router.push('/scan/today')} hitSlop={6} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
            <Icon name="history" color={c.text} />
          </Pressable>
        </View>
      )} />
      <View style={{ flex: 1, paddingHorizontal: 16, gap: 10, paddingBottom: space.footer + 16 }}>
        {bill.restored ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Your bill is back. Dismiss" onPress={() => billStore.dismissRestored()}>
            <Banner tone="info" icon="layers" title="Your bill is back" text="The app was closed in the middle of a bill. Nothing was lost." />
          </Pressable>
        ) : null}
        {bill.pending ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/scan/complete')}>
            <Banner tone="warning" icon="clock" title="The last Complete sale got no answer" text="Tap here and send it again. If it went through, you'll see the sale; nothing is sold twice." />
          </Pressable>
        ) : null}
        <TagScanner onCode={(code) => onCode(code)} paused={busy || asking || typing} torch={torch} zoom={zoomed ? 0.3 : 0} style={{ flex: 1, minHeight: 180, borderRadius: radius.lg }}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: '13%' }}>
            <ScanFrame hint={busy ? 'Checking…' : 'Point at the saree\'s tag'} />
          </View>
          {flash ? (
            <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: flash.tone === 'success' ? '#177A47' : '#8A5300' }}>
              <Icon name={flash.tone === 'success' ? 'check' : 'alert'} size={18} color="#fff" strokeWidth={2.6} />
              <T variant="smallStrong" color="#fff" style={{ flex: 1 }}>{flash.text}</T>
            </View>
          ) : null}
        </TagScanner>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Type" icon="keyboard" kind="secondary" small onPress={() => setTyping(true)} style={{ flex: 1 }} />
          <Button title={torch ? 'Torch off' : 'Torch'} icon="flash" kind="secondary" small onPress={() => setTorch((x) => !x)} style={{ flex: 1 }} />
          <Button title={zoomed ? 'Zoom out' : 'Zoom'} icon="zoom" kind="secondary" small onPress={() => setZoomed((x) => !x)} style={{ flex: 1 }} />
        </View>
        <BillStrip lines={bill.lines} onPress={() => router.push('/scan/bill')} />
      </View>
      <TagEntryModal visible={typing} onClose={() => setTyping(false)}
        onSubmit={(code) => { setTyping(false); setTimeout(() => onCode(code, code.replace(/^NH(?=\d{1,6}$)/, '')), 250); }} />
    </View>
  );
}
