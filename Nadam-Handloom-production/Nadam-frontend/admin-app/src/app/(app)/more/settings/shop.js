// Shop details (Module 11, 6.5 and 6.7): name, address, mobile, GSTIN (checked) and the
// website address, with a preview of the invoice letterhead. New invoices use them;
// invoices already made keep theirs.
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Image, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen, TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { Banner } from '../../../../components/Banner';
import { Button } from '../../../../components/Button';
import { TextField } from '../../../../components/TextField';
import { T } from '../../../../components/T';
import { useFeedback } from '../../../../components/Feedback';
import { LockNote } from '../../../../components/sales/SaleParts';
import { useTheme } from '../../../../theme/ThemeProvider';
import { useCan, PERMISSION } from '../../../../auth/permissions';
import * as settings from '../../../../api/settings';
import { settingsCache } from '../../../../settings/cache';
import { FIELD_NAME, mobileText, shopErrors, shopKey } from '../../../../utils/settings';

const logo = require('../../../../../assets/logo.png');
const formOf = (s) => ({ name: s.name || '', address: s.address || '', mobile: s.mobile || '', gstin: s.gstin || '', website: s.website || '' });

function Letterhead({ f }) {
  const { c, radius } = useTheme();
  const mobile = f.mobile.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  return (
    <View accessibilityLabel="Invoice letterhead preview" style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: '#FFFFFF' }}>
      <Image source={logo} style={{ width: 44, height: 44 }} resizeMode="contain" />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="smallStrong" color="#1B1B1B">{f.name.trim() || '—'}</T>
        <T variant="caption" color="#4A4A4A">{f.address.trim() || '—'}</T>
        <T variant="caption" color="#4A4A4A">Mobile: {/^\d{10}$/.test(mobile) ? mobileText(mobile) : f.mobile} · GSTIN: {f.gstin.toUpperCase()}</T>
      </View>
      <T variant="caption" color="#8A1C24" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>TAX INVOICE</T>
    </View>
  );
}

export default function ShopDetails() {
  const owner = useCan(PERMISSION.SETTINGS_MANAGE);
  const { confirm, showToast } = useFeedback();
  const [form, setForm] = useState(() => (settingsCache.get() ? formOf(settingsCache.get().shop) : null));
  const [start, setStart] = useState(form);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchShop = useCallback(() => settings.get().then((r) => {
    settingsCache.set(r);
    setForm(formOf(r.shop));
    setStart(formOf(r.shop));
  }, setLoadError), []);
  const load = () => { setLoadError(null); fetchShop(); };
  useEffect(() => { if (owner && !form) fetchShop(); }, [owner]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!form && !!start && shopKey(form) !== shopKey(start);
  const leave = useCallback(() => {
    if (!dirty) return router.back();
    return confirm({ tone: 'warning', icon: 'alert', title: 'Leave without saving?', text: 'Your changes to the shop details are not saved.', actions: [{ label: 'Leave', kind: 'danger', onPress: () => router.back() }, { label: 'Keep editing', kind: 'primary' }] });
  }, [dirty, confirm]);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { leave(); return true; });
    return () => sub.remove();
  }, [leave]));

  const set = (k) => (v) => {
    const f = { ...form, [k]: k === 'gstin' ? v.toUpperCase().replace(/\s/g, '') : v };
    setForm(f);
    if (tried) setErrors(shopErrors(f));
  };
  async function save() {
    setTried(true);
    const e = shopErrors(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await settings.setShop({ ...form, website: form.website.trim() });
      settingsCache.set(r);
      const changed = shopKey(r.shop) !== shopKey(start);
      router.back();
      showToast(changed ? 'Saved. New invoices use these details.' : 'Nothing changed', 'success');
    } catch (err) {
      const field = { BAD_GSTIN: 'gstin', BAD_WEBSITE: 'website' }[err.code] || err.details?.issues?.[0]?.path?.[0];
      if (field && FIELD_NAME[field]) setErrors({ [field]: err.message });
      else showToast(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!owner) {
    return (
      <Screen top={<TopBar title="Shop details" onBack={() => router.back()} />}>
        <LockNote text="Settings can pause the app and require updates, so it is for owners." />
      </Screen>
    );
  }
  const wrong = Object.keys(errors);
  return (
    <Screen maxWidth={680} top={<><StatusBanner /><TopBar title="Shop details" onBack={leave} /></>}
      footer={form ? (
        <>
          {wrong.length ? <T variant="caption" color="danger" accessibilityRole="alert">Fix the {wrong.map((k) => FIELD_NAME[k]).join(' and ')} above.</T> : null}
          <Button title="Save shop details" icon="check" loading={busy} onPress={save} />
        </>
      ) : null}>
      {loadError && !form ? (
        <View style={{ gap: 10 }}>
          <Banner tone="error" title="Couldn't load the shop details" text={loadError.code === 'NETWORK' || loadError.code === 'TIMEOUT' ? 'No internet. This needs internet.' : loadError.message} />
          <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {form ? (
        <>
          <TextField autoComplete="off" label="Shop name" value={form.name} onChange={set('name')} error={errors.name} maxLength={60} autoCapitalize="words" />
          <TextField autoComplete="off" label="Address" value={form.address} onChange={set('address')} error={errors.address} maxLength={200} multiline />
          <TextField autoComplete="off" label="Mobile" value={form.mobile} onChange={set('mobile')} error={errors.mobile} hint="10 digits, printed with +91" keyboardType="phone-pad" maxLength={15} />
          <TextField autoComplete="off" label="GSTIN" value={form.gstin} onChange={set('gstin')} error={errors.gstin} hint="15 characters, like 37CCWPN2487C1Z2" maxLength={15} autoCapitalize="characters" />
          <TextField autoComplete="off" label="Website address" value={form.website} onChange={set('website')} error={errors.website} hint="Used for product links in WhatsApp messages" placeholder="https://nandamhandlooms.com" autoCapitalize="none" keyboardType="url" maxLength={120} />
          <T variant="label" color="muted" style={{ marginTop: 6, marginBottom: 8 }}>Invoice letterhead preview</T>
          <Letterhead f={form} />
          <T variant="caption" color="muted" style={{ marginTop: 10 }}>New invoices use these details. Invoices already made keep theirs.</T>
        </>
      ) : null}
    </Screen>
  );
}
