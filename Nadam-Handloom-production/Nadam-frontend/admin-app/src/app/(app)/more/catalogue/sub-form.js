// Add or edit a subcategory (owners): name, description, store / website / MRP prices
// with the website's "% off" as you type, and a photo. Changed prices get the
// "old → new" check before anything goes live (decision 5.4). Docs Module 3, 6.4.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { T } from '../../../../components/T';
import { Button } from '../../../../components/Button';
import { Banner } from '../../../../components/Banner';
import { TextField } from '../../../../components/TextField';
import { useFeedback } from '../../../../components/Feedback';
import { PhotoField } from '../../../../components/catalog/PhotoField';
import { PriceCheck } from '../../../../components/catalog/PriceCheck';
import { OwnersOnly } from '../../../../components/team/OwnersOnly';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import * as catalog from '../../../../api/catalog';
import { discountPercent, moneyText, parseMoney, priceChanges, rupees, subcategoryFormErrors } from '../../../../utils/catalog';

const FIELD_OF = { name: 'name', description: 'description', storePrice: 'storePrice', websitePrice: 'websitePrice', mrp: 'mrp' };

export default function SubcategoryForm() {
  const { id, cat } = useLocalSearchParams();
  const editing = !!id;
  const { c } = useTheme();
  const tablet = useIsTablet();
  const { confirm, showToast } = useFeedback();
  const tabSpace = useTabBarSpace().footer;
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [f, setF] = useState({ name: '', description: '', store: '', website: '', mrp: '' });
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    const done = (name) => { setCategoryName(name); setLoaded(true); };
    if (editing) {
      catalog.getSubcategory(id).then(({ subcategory: s }) => {
        setCurrent(s);
        setF({ name: s.name, description: s.description, store: moneyText(s.storePrice), website: moneyText(s.websitePrice), mrp: moneyText(s.mrp) });
        done(s.categoryName);
      }, setProblem);
    } else {
      catalog.getCategory(cat).then((d) => done(d.category.name), setProblem);
    }
  }, [editing, id, cat]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const values = () => ({ name: f.name, description: f.description, storePrice: parseMoney(f.store), websitePrice: parseMoney(f.website), mrp: parseMoney(f.mrp) });
  const v = values();
  const off = discountPercent(v.mrp, v.websitePrice);

  function submit() {
    const vals = values();
    const e = subcategoryFormErrors(vals);
    setErrors(e);
    setProblem(null);
    if (Object.keys(e).length) return;
    const changes = editing && !savedId ? priceChanges(current, vals) : [];
    if (!changes.length) return save(vals);
    const warn = changes.some((ch) => ch.warning);
    confirm({
      tone: warn ? 'warning' : 'info', icon: warn ? 'alert' : 'tag', title: warn ? 'Check these prices' : 'Change prices?',
      text: 'These go live on the website as soon as you save.',
      content: <PriceCheck changes={changes} websitePrice={vals.websitePrice} mrp={vals.mrp} />,
      // With a warning, the safe choice comes first.
      actions: warn
        ? [{ label: 'Go back and fix', kind: 'primary' }, { label: 'Prices are right, save', kind: 'danger', onPress: () => save(vals) }]
        : [{ label: 'Save and go live', kind: 'primary', onPress: () => save(vals) }, { label: 'Go back and fix' }],
    });
  }

  async function save(vals) {
    setBusy(true);
    let subId = savedId || id;
    let priceChanged = false;
    try {
      if (!savedId) {
        const body = { name: vals.name.trim().replace(/\s+/g, ' '), description: vals.description.trim(), storePrice: vals.storePrice, websitePrice: vals.websitePrice, mrp: vals.mrp };
        const r = editing ? await catalog.updateSubcategory(id, body) : await catalog.createSubcategory(cat, body);
        subId = r.subcategory.id;
        priceChanged = editing && priceChanges(current, vals).length > 0;
      }
      if (photo) {
        try {
          await catalog.uploadPhoto('subcategory', subId, photo);
        } catch (err) {
          setSavedId(subId);
          setProblem({ message: `The details are saved, but the photo didn't upload: ${err.message} Press Save to try the photo again.` });
          return;
        }
      }
      if (editing) router.back();
      else router.replace(`/more/catalogue/sub/${subId}`);
      showToast(editing ? (priceChanged ? 'Saved · new prices are live on the website' : 'Saved') : `${vals.name.trim()} added`, 'success');
    } catch (err) {
      if (err.code === 'FORBIDDEN') setForbidden(true);
      else if (err.code === 'NAME_TAKEN') setErrors({ name: err.message });
      else if (err.code === 'MRP_TOO_LOW') setErrors({ mrp: err.message });
      else if (err.code === 'STORE_ABOVE_MRP') setErrors({ storePrice: err.message });
      else if (err.code === 'VALIDATION_FAILED') setErrors({ [FIELD_OF[err.details?.issues?.[0]?.field] || 'name']: err.message });
      else setProblem(err);
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <OwnersOnly />;
  const third = tablet ? { flex: 1 } : { flexBasis: '47%', flexGrow: 1 };
  return (
    <Screen edges={['top']} top={<TopBar title={editing ? 'Edit subcategory' : 'New subcategory'} onBack={() => router.back()} />} maxWidth={680}
      footer={<View style={{ paddingBottom: tabSpace }}><Button title={editing ? 'Save' : 'Add subcategory'} loading={busy} disabled={!loaded} onPress={submit} /></View>}>
      {categoryName ? <T variant="small" color="muted" style={{ marginBottom: 12 }}>In {categoryName}</T> : null}
      {problem ? <Banner tone={problem.code === 'NETWORK' || problem.code === 'TIMEOUT' ? 'warning' : 'error'} title="Couldn't save" text={problem.message} style={{ marginBottom: 14 }} /> : null}
      <TextField label="Name" nativeID="sub-name" value={f.name} onChange={set('name')} error={errors.name} placeholder="e.g. 300k Ikkath Border Checks" maxLength={150} autoCapitalize="words" />
      <TextField label="Description" nativeID="sub-desc" value={f.description} onChange={set('description')} error={errors.description} placeholder="Material, border, pallu, blouse…" maxLength={2000} multiline hint="The website shows this." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 }}>
        <TextField label="Store price" nativeID="sub-store" value={f.store} onChange={set('store')} error={errors.storePrice} prefix="₹" keyboardType="decimal-pad" placeholder="0" style={third} />
        <TextField label="Website price" nativeID="sub-web" value={f.website} onChange={set('website')} error={errors.websitePrice} prefix="₹" keyboardType="decimal-pad" placeholder="0" style={third} />
        <TextField label="MRP (optional)" nativeID="sub-mrp" value={f.mrp} onChange={set('mrp')} error={errors.mrp} prefix="₹" keyboardType="decimal-pad" placeholder="Leave empty for none" hint="The struck-through price on the website." style={tablet ? { flex: 1 } : { flexBasis: '100%' }} />
      </View>
      <T variant="small" color="text2" style={{ marginTop: -4, marginBottom: 16 }}>
        {v.websitePrice && !Number.isNaN(v.websitePrice) ? (
          <>On the website: <T variant="smallStrong">{rupees(v.websitePrice)}</T>{off ? <> <T variant="small" color="muted" style={{ textDecorationLine: 'line-through' }}>{rupees(v.mrp)}</T> <T variant="smallStrong" color={c.success}>{off}% off</T></> : null}</>
        ) : 'On the website: enter a website price to preview.'}
      </T>
      <PhotoField currentUrl={current?.imageUrl} stagedUri={photo} onStaged={setPhoto} />
    </Screen>
  );
}
