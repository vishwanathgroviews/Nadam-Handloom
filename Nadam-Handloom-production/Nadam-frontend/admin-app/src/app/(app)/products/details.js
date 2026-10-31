// Optional details (decision 6.6): colour, fabric, border, technique, blouse, zari,
// purity, pattern, occasion. The website shows them and can filter by them. Never
// asked while adding sarees. Suggestions are only a quick way to fill a box.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { TextField } from '../../../components/TextField';
import { useFeedback } from '../../../components/Feedback';
import { useTheme } from '../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import * as products from '../../../api/products';

// Labels as the website shows them (customer-web ProductDetail).
const FIELDS = [
  ['color', 'Colour', ['Red', 'Maroon', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Black', 'White', 'Cream', 'Multicolour']],
  ['fabric', 'Fabric', ['Pattu', 'Pattu by cotton', 'Cotton', 'Silk cotton']],
  ['borderStyle', 'Border style', ['Gap border', 'Temple border', 'Rangoli border', 'Ikkat border', 'Zari border', 'Plain']],
  ['technique', 'Work / technique', ['Handloom', 'Screen print', 'Digital print', 'Bandini', 'Applique', 'Embroidery', 'Kalamkari']],
  ['blouseType', 'Blouse type', ['Contrast', 'Running', 'Embroidered', 'No blouse']],
  ['zariTier', 'Zari tier', ['No zari', 'Tested zari', 'Silver zari', 'Gold zari']],
  ['purity', 'Purity / grade', []],
  ['pattern', 'Pattern', ['Checks', 'Stripes', 'Butta', 'Plain', 'Floral']],
];
const OCCASIONS = ['Daily wear', 'Office', 'Festive', 'Wedding', 'Party', 'Pooja'];

function Suggest({ options, value, onPick }) {
  const { c, radius } = useTheme();
  if (!options.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6, marginBottom: 14 }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPick(on ? '' : o)}
            style={{ paddingHorizontal: 11, minHeight: 32, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: on ? c.primary : c.borderStrong, backgroundColor: on ? c.primary : c.surface }}>
            <T variant="caption" color={on ? c.onPrimary : c.text2}>{o}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Details() {
  const { id } = useLocalSearchParams();
  const { showToast } = useFeedback();
  const tabSpace = useTabBarSpace().footer;
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { products.getProduct(id).then((r) => setD({ ...r.product.details, occasion: r.product.details.occasion || [] }), setError); }, [id]);
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const toggleOccasion = (o) => setD((x) => ({ ...x, occasion: x.occasion.includes(o) ? x.occasion.filter((y) => y !== o) : [...x.occasion, o] }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const details = Object.fromEntries(FIELDS.map(([k]) => [k, (d[k] || '').trim() || null]));
      await products.updateProduct(id, { details: { ...details, occasion: d.occasion } });
      router.back();
      showToast('Details saved', 'success');
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return (
    <Screen edges={['top']} top={<TopBar title="Details" onBack={() => router.back()} />} maxWidth={680}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title="Save details" loading={busy} disabled={!d} onPress={save} /></View>}>
      <T color="text2" style={{ marginBottom: 14 }}>All optional. The website shows these and can filter by them.</T>
      {error ? <Banner tone="error" title="Couldn't save" text={error.message} style={{ marginBottom: 12 }} /> : null}
      {d ? (
        <>
          {FIELDS.map(([k, label, options]) => (
            <View key={k}>
              <TextField label={label} nativeID={`d-${k}`} value={d[k] || ''} onChange={set(k)} maxLength={60} autoCapitalize="words" />
              <Suggest options={options} value={d[k] || ''} onPick={set(k)} />
            </View>
          ))}
          <T variant="smallStrong" style={{ marginBottom: 8 }}>Occasion (choose any)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {OCCASIONS.map((o) => <Suggest key={o} options={[o]} value={d.occasion.includes(o) ? o : ''} onPick={() => toggleOccasion(o)} />)}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
