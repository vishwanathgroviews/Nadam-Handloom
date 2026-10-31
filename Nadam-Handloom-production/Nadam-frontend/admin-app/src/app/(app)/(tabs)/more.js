// My account (the More tab): profile, Analytics (owners), Online payments (owners), Invoices, Catalogue, Team, Activity and Settings (owners),
// Payment notifications (owners, this phone), Face ID switch, Change PIN,
// My devices, App theme (this phone), Log out.
// Log out always asks first and stays visible even if the profile can't load.
import { useCallback, useEffect, useState } from 'react';
import { AppState, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen, TopBar } from '../../../components/Screen';
import { StatusBanner } from '../../../components/StatusBanner';
import { T } from '../../../components/T';
import { Button, LinkButton } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { Avatar, Badge, Card, Row, SectionLabel } from '../../../components/Bits';
import { ThemeChoice } from '../../../components/ThemeChoice';
import { useFeedback } from '../../../components/Feedback';
import { useTheme } from '../../../theme/ThemeProvider';
import { api } from '../../../api/client';
import { session, useSession, getRemembered } from '../../../auth/session';
import { can, PERMISSION } from '../../../auth/permissions';
import { listTeam } from '../../../api/team';
import { canDoText } from '../../../utils/team';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { getBiometricStatus, disableBiometric } from '../../../auth/biometrics';
import { hasLocalBiometricKey } from '../../../auth/biometricKeys';
import { formatMobile } from '../../../utils/phone';
import { PaymentNotifyCard } from '../../../components/payments/PaymentNotifyCard';

export default function Account() {
  const s = useSession();
  const { c } = useTheme();
  const { confirm, showToast } = useFeedback();
  const space = useTabBarSpace();
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [devicesCount, setDevicesCount] = useState(null);
  const [teamCounts, setTeamCounts] = useState(null);
  const [bio, setBio] = useState({ available: false, label: 'Face ID', inSentence: 'Face ID', enabled: false });
  const [faceChanged, setFaceChanged] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [profile, devices] = await Promise.all([api('/me'), api('/me/devices?limit=1')]);
      setMe(profile);
      await session.updateUser(profile.user);
      setDevicesCount(devices.total);
      if (can(profile.user, PERMISSION.TEAM_MANAGE)) listTeam().then((t) => setTeamCounts(t.counts), () => setTeamCounts(null));
      const status = await getBiometricStatus();
      const local = await hasLocalBiometricKey(profile.user.id);
      setBio({ ...status, enabled: local && profile.device.biometricEnabled });
    } catch (e) {
      setLoadError(e);
    }
    const r = await getRemembered();
    setFaceChanged(!!r?.faceChanged);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { getBiometricStatus().then((b) => setBio((x) => ({ ...b, enabled: x.enabled }))); }, []);
  // Coming back from the phone's Settings (e.g. after adding a fingerprint): check again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  async function toggleBio(on) {
    setBioBusy(true);
    try {
      if (on) {
        // The PIN comes first (its own page); that page turns it on and comes back here.
        router.push({ pathname: '/more/face-id', params: { label: bio.label } });
        return;
      } else {
        await disableBiometric({ accountId: s.user.id });
        showToast(`${bio.label} turned off on this phone`);
      }
      setBio((b) => ({ ...b, enabled: on }));
    } catch (e) {
      if (e.code !== 'CANCELLED' && e.code !== 'FALLBACK') showToast(e.message);
    } finally {
      setBioBusy(false);
    }
  }

  function logout() {
    confirm({
      tone: 'danger', icon: 'logout', title: 'Log out on this phone?',
      text: `You'll need your PIN${bio.enabled ? ` or ${bio.inSentence}` : ''} to sign in again. Anything unsaved stays on this phone for your next sign-in.`,
      actions: [
        { label: 'Log out', kind: 'dangerSolid', onPress: async () => { await session.logout(); router.replace('/sign-in'); showToast('Logged out'); } },
        { label: 'Cancel' },
      ],
    });
  }

  const user = me?.user || s.user;
  const since = me ? new Date(me.device.trustedAt) : null;
  return (
    <Screen edges={['top']} top={<><StatusBanner /><TopBar title="My account" /></>} contentStyle={{ paddingBottom: space.scroll }} maxWidth={680}>
      {loadError ? (
        <View style={{ gap: 10 }}>
          <Banner tone="error" title="Couldn't load your account" text={`${loadError.message} You can still log out below.`} />
          <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {user ? (
        <Card style={{ marginTop: loadError ? 12 : 0 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16 }}>
            <Avatar name={user.name} size={64} />
            <View style={{ gap: 3 }}>
              <T variant="barTitle">{user.name}</T>
              <T variant="small" color="muted">+91 {formatMobile(user.mobile || '')}</T>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge text={user.role === 'owner' ? 'Owner' : 'Staff'} tone={user.role === 'owner' ? 'owner' : 'staff'} />
                {user.isMainOwner ? <Badge text="Main owner" tone="neutral" /> : null}
              </View>
              <LinkButton title="What can I do?" onPress={() => confirm({ icon: 'shield', title: `What ${user.role === 'owner' ? 'an Owner' : 'Staff'} can do`, text: canDoText(user.role), actions: [{ label: 'OK', kind: 'primary' }] })} style={{ marginTop: 4 }} />
            </View>
          </View>
        </Card>
      ) : null}

      {can(user, PERMISSION.CATALOG_VIEW) || can(user, PERMISSION.SELL_USE) ? (
        <>
          <SectionLabel>Shop</SectionLabel>
          <Card>
            {can(user, PERMISSION.ANALYTICS_VIEW) ? (
              <Row icon="chart" title="Analytics" onPress={() => router.push('/more/analytics')} subtitle="Sales, best sellers, bargains, people, stock" />
            ) : null}
            {can(user, PERMISSION.PAYMENTS_VIEW) ? (
              <Row icon="card" title="Online payments" onPress={() => router.push('/more/payments')} subtitle="Website payments, refunds, filters" />
            ) : null}
            {can(user, PERMISSION.SELL_USE) ? (
              <Row icon="receipt" title="Invoices" onPress={() => router.push('/more/invoices')}
                subtitle={can(user, PERMISSION.SALES_VIEW) ? 'Find, share and print; sales summary' : 'Find, share and print invoices'} last={!can(user, PERMISSION.CATALOG_VIEW)} />
            ) : null}
            {can(user, PERMISSION.CATALOG_VIEW) ? (
              <Row icon="folder" title="Catalogue" onPress={() => router.push('/more/catalogue')}
                subtitle={can(user, PERMISSION.CATALOG_EDIT) ? 'Categories, subcategories, prices, photos' : 'Categories, prices and catalogue PDFs'} last />
            ) : null}
          </Card>
        </>
      ) : null}

      {can(user, PERMISSION.TEAM_MANAGE) ? (
        <>
          <SectionLabel>Team</SectionLabel>
          <Card>
            <Row icon="users" title="Team" onPress={() => router.push('/more/team')}
              subtitle={teamCounts ? `${teamCounts.team} ${teamCounts.team === 1 ? 'person' : 'people'}${teamCounts.invited ? ` · ${teamCounts.invited} invited` : ''}` : 'Invite people, roles, phones'} last={!can(user, PERMISSION.ACTIVITY_VIEW)} />
            {can(user, PERMISSION.ACTIVITY_VIEW) ? <Row icon="history" title="Activity" onPress={() => router.push('/more/activity')} subtitle="Who did what, and when" last /> : null}
          </Card>
        </>
      ) : null}

      {can(user, PERMISSION.SETTINGS_MANAGE) ? (
        <>
          <SectionLabel>App</SectionLabel>
          <Card>
            <Row icon="sliders" title="Settings" onPress={() => router.push('/more/settings')} subtitle="Maintenance, app updates, shop details" last />
          </Card>
        </>
      ) : null}

      {faceChanged && !bio.enabled && bio.available ? <Banner tone="warning" title={`${bio.label} was turned off`} text="This phone's face or fingerprint settings changed. Turn it on again below." style={{ marginTop: 14 }} /> : null}

      <SectionLabel>Sign-in and security</SectionLabel>
      <Card>
        <Row icon={bio.type === 'fingerprint' ? 'finger' : 'faceid'} title={`Sign in with ${bio.inSentence}`}
          subtitle={bio.available ? `On this ${s.device?.name || 'phone'}` : bio.reason === 'NOT_ENROLLED' ? `Set up ${bio.inSentence} in the phone's Settings first` : 'Not available on this phone'}
          right={<Switch value={bio.enabled} disabled={!bio.available || bioBusy || !me} onValueChange={toggleBio} trackColor={{ true: c.success, false: c.surface3 }} accessibilityLabel={`Sign in with ${bio.inSentence}`} />} />
        <Row icon="key" title="Change PIN" subtitle="No SMS needed while signed in" onPress={() => router.push('/more/change-pin')} />
        <Row icon="phone" title="My devices" subtitle={devicesCount === null ? 'Phones and tablets signed in' : `${devicesCount} signed in`} onPress={() => router.push('/more/devices')} last />
      </Card>

      {can(user, PERMISSION.PAYMENTS_VIEW) ? (
        <>
          <SectionLabel>Notifications</SectionLabel>
          <PaymentNotifyCard />
        </>
      ) : null}

      <SectionLabel>This phone</SectionLabel>
      <Card>
        <Row icon="moon" title="App theme" subtitle="Auto, Light or Dark" right={null} last />
        <ThemeChoice />
        <Row icon="clock" title="Stays signed in" subtitle="7 days, renewed each time you use the app" />
        <Row icon="shield" title="Trusted since" subtitle={since ? since.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'} last />
      </Card>


      <Button title="Log out" kind="danger" icon="logout" onPress={logout} style={{ marginTop: 24 }} />
      <T variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 14 }}>Nandam Handlooms Admin · v2.0.0</T>
    </Screen>
  );
}
