// Scan to find (owners and staff): scan any saree's tag, or type the number on it,
// and its page opens. A tag no saree has: add a new saree with it. Docs Module 4, 7.1.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button } from '../../../components/Button';
import { useFeedback } from '../../../components/Feedback';
import { ScanFrame, TagScanner } from '../../../components/products/TagScanner';
import { TagEntryModal } from '../../../components/products/TagEntryModal';
import { useTheme } from '../../../theme/ThemeProvider';
import * as products from '../../../api/products';

export default function FindByTag() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { confirm, showToast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [torch, setTorch] = useState(false);
  const [paused, setPaused] = useState(false);

  // lookup: what the server searches (a typed number alone, so NANDAM2264 is found too);
  // code: the whole tag, used if a new saree is added with it.
  async function find(code, lookup = code) {
    setBusy(true);
    try {
      const r = await products.findTag(lookup);
      router.replace(`/products/${r.productId}`);
    } catch (e) {
      if (e.code === 'TAG_UNKNOWN') {
        setPaused(true);
        confirm({
          sticky: true, icon: 'barcode', title: `No saree has ${code}`, text: 'It\'s a new tag. Add a new saree with it?',
          actions: [
            { label: `Add a new saree with ${code}`, kind: 'primary', onPress: () => router.replace(`/products/add/pick?tag=${encodeURIComponent(code)}`) },
            { label: 'Scan another', onPress: () => setPaused(false) },
          ],
        });
      } else if (e.code === 'AMBIGUOUS_CODE') {
        setPaused(true);
        confirm({
          sticky: true, icon: 'barcode', title: e.message, text: 'Which saree?',
          actions: [...(e.details?.matches || []).slice(0, 4).map((m) => ({ label: `${m.code} · ${m.name}`, onPress: () => router.replace(`/products/${m.productId}`) })), { label: 'Scan again', kind: 'ghost', onPress: () => setPaused(false) }],
        });
      } else showToast(e.message);
    } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
      <TopBar title="Scan to find" onBack={() => router.back()} />
      <View style={{ flex: 1, paddingHorizontal: 16, gap: 12 }}>
        <TagScanner onCode={find} paused={busy || typing || paused} torch={torch} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: '12%' }}>
            <ScanFrame hint={busy ? 'Looking it up…' : 'Point at any saree\'s tag'} />
          </View>
        </TagScanner>
        <T variant="caption" color="muted" style={{ textAlign: 'center' }}>Works with the number on the tag too: type 2264 for NH2264.</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Type" icon="keyboard" kind="secondary" onPress={() => setTyping(true)} style={{ flex: 1 }} />
          <Button title={torch ? 'Torch off' : 'Torch'} icon="flash" kind="secondary" onPress={() => setTorch((t) => !t)} style={{ flex: 1 }} />
        </View>
      </View>
      <TagEntryModal visible={typing} title="Find a saree by its tag" note="The whole tag (NH2264) or just its number (2264)." onClose={() => setTyping(false)}
        onSubmit={(code) => { setTyping(false); find(code, code.replace(/^NH(?=\d{1,6}$)/, '')); }} />
    </View>
  );
}
