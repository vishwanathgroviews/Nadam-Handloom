// "Add more tags" on a saree's page: more sarees of the same design came in. Scan each
// new tag (checked at once, like any tag); nothing is added until "Add N tags". Each
// new tag is one more saree in stock on this listing (sets, 15 Oct 2026).
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../Button';
import { Banner } from '../Banner';
import { T } from '../T';
import { ScanFrame, TagScanner } from './TagScanner';
import { TagEntryModal } from './TagEntryModal';
import { SetTags } from './SetCount';
import * as products from '../../api/products';
import { MAX_SET, plural } from '../../utils/products';

const PROBLEM = { taken: 'is already used', sold: 'was sold', retired: 'was retired', invalid: 'doesn\'t look like a tag' };

export function AddTagsModal({ visible, product, onClose, onAdded }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [codes, setCodes] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typing, setTyping] = useState(false);
  const [torch, setTorch] = useState(false);
  const live = product ? product.tags.filter((t) => t.status !== 'retired').length : 0;

  function close() { setCodes([]); setError(null); onClose(); }

  async function onCode(code) {
    if (busy || saving) return;
    if (codes.includes(code)) { setError({ title: `${code} is already in the list`, text: 'Scan the next saree\'s tag.' }); return; }
    if (product.tags.some((t) => t.code === code)) { setError({ title: `${code} is already on this saree`, text: 'Scan a new tag.' }); return; }
    if (live + codes.length >= MAX_SET) { setError({ title: `Up to ${MAX_SET} tags on one saree`, text: 'Add the others as a new saree.' }); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await products.checkTag(code);
      if (r.status !== 'free') setError({ title: `${code} ${PROBLEM[r.status] || 'can\'t be used'}`, text: r.message });
      else setCodes((x) => [...x, code]);
    } catch (e) {
      setError({ title: 'Couldn\'t check the tag', text: e.message });
    } finally { setBusy(false); }
  }

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const data = await products.addTags(product.id, codes);
      const n = codes.length;
      setCodes([]);
      onAdded(data, `${plural(n, 'tag')} added · now a set of ${live + n}`);
    } catch (e) {
      setError({ title: 'Couldn\'t add the tags', text: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16), paddingHorizontal: 16, gap: 10 }}>
        <T variant="barTitle">Add more tags</T>
        <T variant="small" color="text2">More sarees of this design came in? Stick a tag on each and scan them. Each tag is one more saree in stock, with the same photo, name and price.</T>
        {error ? <Banner tone="error" title={error.title} text={error.text} /> : null}
        <TagScanner onCode={onCode} paused={busy || saving || typing || !visible} torch={torch} style={{ flex: 1, minHeight: 220 }}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: '12%' }}>
            <ScanFrame hint={busy ? 'Checking…' : codes.length ? 'Scan the next new tag' : 'Point at a new tag'} />
          </View>
        </TagScanner>
        {codes.length ? <SetTags codes={codes} onRemove={(code) => setCodes((x) => x.filter((t) => t !== code))} center={false} /> : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Type" icon="keyboard" kind="secondary" onPress={() => setTyping(true)} style={{ flex: 1 }} />
          <Button title={torch ? 'Torch off' : 'Torch'} icon="flash" kind="secondary" onPress={() => setTorch((t) => !t)} style={{ flex: 1 }} />
        </View>
        <Button title={codes.length ? `Add ${plural(codes.length, 'tag')} · set of ${live + codes.length}` : 'Scan a tag first'} icon="plus" disabled={!codes.length} loading={saving} onPress={add} />
        <Button title="Cancel" kind="ghost" onPress={close} />
      </View>
      <TagEntryModal visible={typing} title="Type a new tag" onClose={() => setTyping(false)} onSubmit={(code) => { setTyping(false); onCode(code); }} />
    </Modal>
  );
}
