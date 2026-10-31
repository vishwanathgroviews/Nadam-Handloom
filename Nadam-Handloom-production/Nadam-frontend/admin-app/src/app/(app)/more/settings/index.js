// Settings (Module 11, owners; picks A: one page with sections, and A: each change saves
// on its own, switches ask first). Maintenance, App updates, Shop details, Shop rules,
// About, each with who changed it last. Docs Module 11, section 5.
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../../components/Screen';
import { StatusBanner } from '../../../../components/StatusBanner';
import { Banner } from '../../../../components/Banner';
import { Button, LinkButton } from '../../../../components/Button';
import { Badge } from '../../../../components/Bits';
import { TextField } from '../../../../components/TextField';
import { T } from '../../../../components/T';
import { useFeedback } from '../../../../components/Feedback';
import { LockNote } from '../../../../components/sales/SaleParts';
import { InfoList, LastChanged, PauseSheet, Section, VerBox } from '../../../../components/settings/Parts';
import { useTheme, useIsTablet } from '../../../../theme/ThemeProvider';
import { useTabBarSpace } from '../../../../hooks/useTabBarSpace';
import { useBack } from '../../../../hooks/useBack';
import { useCan, PERMISSION } from '../../../../auth/permissions';
import * as settings from '../../../../api/settings';
import { settingsCache } from '../../../../settings/cache';
import { gate, useOnStatusChange, APP_NAME, BUILD, PLATFORM, VERSION } from '../../../../gate/store';
import { plural } from '../../../../utils/sales';
import { MESSAGE_MAX, RULES, advancedError, lastChanged, mobileText, needOf, olderPhones, phoneText } from '../../../../utils/settings';

const PLATFORMS = [['android', 'Android'], ['ios', 'iPhone']];
const STORE = { android: 'Play Store', ios: 'TestFlight' };

function Seg({ value, onChange }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 999, backgroundColor: c.surface2 }}>
      {PLATFORMS.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            style={{ flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: on ? c.surface : 'transparent', borderWidth: 1, borderColor: on ? c.borderStrong : 'transparent', elevation: on ? 1 : 0 }}>
            <T variant="smallStrong" color={on ? 'text' : 'text2'}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Maintenance({ d, onSaved }) {
  const { c } = useTheme();
  const { confirm, showToast } = useFeedback();
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(null);
  // A message being typed, on top of the saved one.
  const [edit, setEdit] = useState({});
  const msg = { staff: edit.staff ?? d.maintenance.staff.message, website: edit.website ?? d.maintenance.website.message };

  async function save(key, body, done, what = key) {
    setBusy(what);
    try {
      onSaved(await settings.setMaintenance({ [key]: body }));
      setEdit((x) => ({ ...x, [key]: undefined }));
      if (key === 'staff') gate.check();
      showToast(done, 'success');
      return true;
    } catch (e) {
      showToast(e.message);
      return false;
    } finally {
      setBusy(null);
    }
  }
  function toggle(key, on) {
    if (on) return setSheet(key);
    const staff = key === 'staff';
    return confirm({
      icon: 'check', title: staff ? 'Resume the staff app?' : 'Open the website again?', text: staff ? 'Staff can sell and ship again straight away.' : 'Customers can shop again straight away.',
      actions: [{ label: staff ? 'Resume' : 'Open the website', kind: 'primary', onPress: () => save(key, { on: false }, staff ? 'Staff app resumed' : 'Website open again') }, { label: 'Cancel' }],
    });
  }
  const row = (key, title, offText) => {
    const m = d.maintenance[key];
    return (
      <View key={key} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <T variant="bodyStrong">{title}</T>
            {m.on ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge text="On" tone="danger" />
                <T variant="small" color="muted">since {m.since || 'now'}{m.by ? `, by ${m.by}` : ''}</T>
              </View>
            ) : <T variant="small" color="muted">{offText}</T>}
          </View>
          <Switch value={m.on} disabled={!!busy} onValueChange={(v) => toggle(key, v)} trackColor={{ true: c.danger, false: c.surface3 }} thumbColor="#FFFFFF" accessibilityLabel={`${title} maintenance`} />
        </View>
        {m.on ? (
          <View>
            <TextField autoComplete="off" label="Message" value={msg[key]} onChange={(t) => setEdit((x) => ({ ...x, [key]: t }))} multiline maxLength={MESSAGE_MAX} hint={`${msg[key].length}/${MESSAGE_MAX}`}
              placeholder={key === 'staff' ? 'Updating prices, back at 6 pm' : 'Our website is being updated. Please come back soon.'} style={{ marginBottom: 8 }} />
            <Button title="Save message" kind="secondary" small icon="check" loading={busy === `${key}-msg`} disabled={!!busy || msg[key].replace(/\s+/g, ' ').trim() === m.message}
              onPress={() => save(key, { message: msg[key] }, 'Message saved', `${key}-msg`)} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
      </View>
    );
  };
  return (
    <Section icon="alert" title="Maintenance">
      {row('staff', 'Staff app', 'Off · staff work normally')}
      <View style={{ height: 1, backgroundColor: c.border }} />
      {row('website', 'Website', 'Off · customers shop normally')}
      <T variant="caption" color="muted">Owners keep working while the staff app is paused; the server refuses staff too.</T>
      <LastChanged text={lastChanged(d.maintenance.changed, 'Never changed')} />
      {sheet ? (
        <PauseSheet key={sheet} which={sheet} message={d.maintenance[sheet].message} busy={busy === sheet} onClose={() => setSheet(null)}
          onPause={async (text) => {
            const ok = await save(sheet, { on: true, message: text }, sheet === 'staff' ? 'Staff app paused. Staff phones switch within a minute.' : 'Website paused', sheet);
            if (ok) setSheet(null);
          }} />
      ) : null}
    </Section>
  );
}

const formOf = (u) => ({ newest: String(u.newest), oldest: String(u.oldest), required: u.required, link: u.link || '' });

function Updates({ d, onSaved }) {
  const { c } = useTheme();
  const { confirm, showToast } = useFeedback();
  const [plat, setPlat] = useState(PLATFORM);
  const [adv, setAdv] = useState(false);
  const [busy, setBusy] = useState(null);
  const [advErr, setAdvErr] = useState(null);
  const u = d.updates[plat];
  // Advanced: numbers being typed for each platform, on top of the saved ones.
  const [edits, setEdits] = useState({});
  const form = { ...formOf(u), ...edits[plat] };
  const setForm = (fn) => setEdits((x) => ({ ...x, [plat]: fn(form) }));
  const here = plat === PLATFORM && BUILD != null;

  async function run(body, done, what) {
    setBusy(what);
    setAdvErr(null);
    try {
      const r = await settings.setUpdates(body);
      onSaved(r);
      setEdits((x) => ({ ...x, [plat]: undefined }));
      gate.check();
      showToast(typeof done === 'function' ? done(r.updates[plat]) : done, 'success');
    } catch (e) {
      if (what === 'adv') setAdvErr(e.message);
      else showToast(e.message);
    } finally {
      setBusy(null);
    }
  }
  // Before phones are made to update: who is still on an older version (and this phone).
  function warn(need, title, yes, onYes) {
    const { older, unknown } = olderPhones(d.updates.phones, plat, need);
    const thisPhone = here && BUILD < need;
    confirm({
      tone: 'danger', icon: 'download', title,
      content: (
        <View style={{ gap: 10, marginTop: 12 }}>
          {thisPhone ? <Banner tone="error" title="This phone will have to update too" text={`It has version ${BUILD}. After saving, it shows "Update required" until it has version ${need}.`} /> : null}
          {older.length
            ? <Banner tone="warning" title={`${plural(older.length, 'phone')} signed in this week ${older.length === 1 ? 'uses' : 'use'} an older version`} text={`${older.map(phoneText).join(', ')}. They must update before they can be used.`} />
            : <Banner tone="info" title="No phone signed in this week uses an older version" />}
          {unknown ? <T variant="small" color="muted">{plural(unknown, 'more phone')} signed in before versions were recorded. Phones on the old app aren't listed.</T> : <T variant="small" color="muted">Phones on the old app aren't listed.</T>}
          <T variant="small" color="muted">Make sure version {need} is in the {STORE[plat]} first.</T>
        </View>
      ),
      actions: [{ label: yes, kind: 'dangerSolid', onPress: onYes }, { label: 'Cancel' }],
    });
  }
  function tell() {
    if (BUILD <= u.newest) return showToast(`Phones already hear about version ${u.newest}.`);
    return run({ platform: plat, tellThisPhone: true }, 'Phones on older versions see "A new version is available"', 'tell');
  }
  function requireIt() {
    if (BUILD <= needOf(u)) return showToast(`Phones older than version ${needOf(u)} already have to update.`);
    return warn(BUILD, `Require version ${BUILD} for everyone?`, `Require version ${BUILD}`, () => run({ platform: plat, requireThisPhone: true }, `Version ${BUILD} required. Older phones show "Update required".`, 'require'));
  }
  function saveAdvanced() {
    const err = advancedError(form);
    if (err) return setAdvErr(err);
    const next = { newest: Number(form.newest), oldest: Number(form.oldest), required: form.required, link: form.link.trim() };
    const body = { platform: plat };
    for (const k of Object.keys(next)) if (next[k] !== (k === 'link' ? u.link || '' : u[k])) body[k] = next[k];
    if (Object.keys(body).length === 1) return showToast('Nothing changed');
    const save = () => run(body, 'Saved', 'adv');
    const need = needOf(next);
    return need > needOf(u) ? warn(need, `Phones below version ${need} must update`, 'Save', save) : save();
  }

  return (
    <Section icon="download" title="App updates">
      <Seg value={plat} onChange={(p) => { setPlat(p); setAdvErr(null); }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <VerBox label="This phone" value={plat !== PLATFORM ? '—' : BUILD != null ? VERSION : 'Not known'} />
        <VerBox label="Newest" value={u.newest ? String(u.newest) : '—'} />
        <VerBox label="Oldest allowed" value={u.oldest ? String(u.oldest) : 'any'} />
      </View>
      {u.required ? <T variant="caption" color="warning">Update required is on: phones below version {u.newest} must update.</T> : null}
      {here && BUILD > u.newest ? <T variant="caption" color="warning">This phone ({BUILD}) is newer than the saved newest version ({u.newest || 0}).</T> : null}
      {here ? (
        <View style={{ gap: 8 }}>
          <Button title="Tell phones a new version is available" kind="secondary" small icon="sparkle" loading={busy === 'tell'} disabled={!!busy} onPress={tell} />
          <Button title={`Require this version (${BUILD}) for everyone`} kind="danger" small icon="download" loading={busy === 'require'} disabled={!!busy} onPress={requireIt} />
        </View>
      ) : <LockNote icon="phone" text={`To use the buttons, open Settings on ${plat === 'ios' ? 'an iPhone' : 'an Android phone'} that already has the new version.`} />}
      <LinkButton title={adv ? 'Hide advanced' : 'Show advanced'} onPress={() => setAdv((x) => !x)} style={{ alignSelf: 'flex-start' }} />
      {adv ? (
        <View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextField autoComplete="off" label="Newest version" value={form.newest} onChange={(v) => setForm((f) => ({ ...f, newest: v.replace(/\D/g, '') }))} keyboardType="number-pad" maxLength={7} style={{ flex: 1 }} />
            <TextField autoComplete="off" label="Oldest allowed" value={form.oldest} onChange={(v) => setForm((f) => ({ ...f, oldest: v.replace(/\D/g, '') }))} keyboardType="number-pad" maxLength={7} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <T variant="smallStrong">Update required</T>
              <T variant="caption" color="muted">Phones below the newest version must update</T>
            </View>
            <Switch value={form.required} onValueChange={(v) => setForm((f) => ({ ...f, required: v }))} trackColor={{ true: c.danger, false: c.surface3 }} thumbColor="#FFFFFF" accessibilityLabel="Update required" />
          </View>
          <TextField autoComplete="off" label="Store link" value={form.link} onChange={(v) => setForm((f) => ({ ...f, link: v }))} autoCapitalize="none" keyboardType="url" placeholder="https://…" hint={`Empty: the built-in ${STORE[plat]} link`} />
          {advErr ? <T variant="caption" color="danger" accessibilityRole="alert" style={{ marginBottom: 8 }}>{advErr}</T> : null}
          <Button title="Save" kind="secondary" small icon="check" loading={busy === 'adv'} disabled={!!busy} onPress={saveAdvanced} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      <LastChanged text={lastChanged(d.updates.changed, 'Never changed')} />
    </Section>
  );
}

function Shop({ d }) {
  const s = d.shop;
  return (
    <Section icon="store" title="Shop details">
      <InfoList items={[['Name', s.name], ['Address', s.address], ['Mobile', mobileText(s.mobile)], ['GSTIN', s.gstin], ['Website', s.website || 'Not set: WhatsApp messages go without product links', !s.website]]} />
      <Button title="Edit shop details" kind="secondary" small icon="edit" onPress={() => router.push('/more/settings/shop')} style={{ alignSelf: 'flex-start' }} />
      <LastChanged text={lastChanged(s.changed, s.saved ? 'Never changed' : 'Server setting · not changed in the app yet')} />
    </Section>
  );
}

function Rules() {
  return (
    <Section icon="list" title="Shop rules">
      <InfoList items={RULES} />
      <T variant="caption" color="muted">Fixed, so nothing breaks by accident. Ask, and a rule can become a setting.</T>
    </Section>
  );
}

function About({ d }) {
  return (
    <Section icon="info" title="About">
      {d.owners < 2 ? (
        <View style={{ gap: 8 }}>
          <Banner tone="warning" title={d.owners === 1 ? 'Only 1 owner can sign in' : 'No owner can sign in'} text="If that owner loses their phone number, nobody can get back in. Add a second owner in Team." />
          <Button title="Open Team" kind="secondary" small icon="userplus" onPress={() => router.push('/more/team')} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      <InfoList items={[
        ['This phone', `${APP_NAME} ${VERSION}`],
        ['Server', `${d.server?.version || '—'} · connected`],
        ['Owners who can sign in', String(d.owners)],
        ['Lost phone number', 'Another owner removes the old number and invites the new one'],
      ]} />
      <Button title="Settings changes in Activity" kind="secondary" small icon="history" onPress={() => router.push('/more/activity?kind=settings&period=all')} style={{ alignSelf: 'flex-start' }} />
    </Section>
  );
}

export default function SettingsPage() {
  const goBack = useBack();
  const { c } = useTheme();
  const tablet = useIsTablet();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const owner = useCan(PERMISSION.SETTINGS_MANAGE);
  const [d, setD] = useState(() => settingsCache.get());
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const keep = useCallback((r) => { settingsCache.set(r); setD(r); }, []);
  const load = useCallback(async () => {
    setError(null);
    try {
      keep(await settings.get());
    } catch (e) {
      setError(e);
    }
  }, [keep]);
  useFocusEffect(useCallback(() => { if (owner) load(); }, [owner, load]));
  useOnStatusChange(useCallback(() => { if (owner) load(); }, [owner, load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  if (!owner) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <TopBar title="Settings" onBack={goBack} />
        <View style={{ padding: 20 }}><LockNote text="Settings can pause the app and require updates, so it is for owners." /></View>
      </View>
    );
  }
  const left = d ? [<Maintenance key="m" d={d} onSaved={keep} />, <Updates key="u" d={d} onSaved={keep} />] : [];
  const right = d ? [<Shop key="s" d={d} />, <Rules key="r" />, <About key="a" d={d} />] : [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <StatusBanner />
      <TopBar title="Settings" onBack={goBack} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: tablet ? 40 : 20, paddingBottom: space.scroll, gap: 12, width: '100%', maxWidth: tablet ? 1000 : 680, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          {error && !d ? (
            <View style={{ gap: 10 }}>
              <Banner tone="error" title="Couldn't load Settings" text={error.code === 'NETWORK' || error.code === 'TIMEOUT' ? 'No internet. Settings needs internet.' : error.message} />
              <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
            </View>
          ) : null}
          {!d && !error ? <View style={{ gap: 12 }}><View style={{ height: 150, borderRadius: 20, backgroundColor: c.surface3 }} /><View style={{ height: 200, borderRadius: 20, backgroundColor: c.surface2 }} /></View> : null}
          {d && tablet ? (
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 12 }}>{left}</View>
              <View style={{ flex: 1, gap: 12 }}>{right}</View>
            </View>
          ) : [...left, ...right]}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
