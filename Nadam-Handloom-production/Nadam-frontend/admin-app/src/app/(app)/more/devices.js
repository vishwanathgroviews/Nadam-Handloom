// My devices (docs 4.8): every phone and tablet signed in to this account, 20 at a time
// (this phone first).
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../../components/Screen';
import { T } from '../../../components/T';
import { Button } from '../../../components/Button';
import { Banner } from '../../../components/Banner';
import { Badge, Card, Row } from '../../../components/Bits';
import { useFeedback } from '../../../components/Feedback';
import { useTheme } from '../../../theme/ThemeProvider';
import { api } from '../../../api/client';
import { useCan, PERMISSION } from '../../../auth/permissions';
import { lastActiveText } from '../../../utils/time';
import { useTabBarSpace } from '../../../hooks/useTabBarSpace';
import { usePaged, nearEnd } from '../../../hooks/usePaged';
import { MoreFooter } from '../../../components/MoreFooter';

export default function Devices() {
  const isOwner = useCan(PERMISSION.TEAM_MANAGE);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const space = useTabBarSpace();
  const { confirm, showToast } = useFeedback();
  const [refreshing, setRefreshing] = useState(false);
  const page = useCallback((offset) => api(`/me/devices?offset=${offset}`), []);
  const paged = usePaged(page, 'devices');
  const { load, error } = paged;
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const devices = paged.data ? paged.items : null;
  const othersCount = paged.data ? Math.max(0, paged.total - (devices.some((d) => d.isCurrent) ? 1 : 0)) : 0;

  function signOutOne(d) {
    confirm({
      tone: 'danger', icon: 'logout', title: `Sign out ${d.name}?`, text: 'It will need your PIN and an SMS code to sign in again. Anything unsaved on it stays on that device.',
      actions: [{ label: 'Sign out', kind: 'dangerSolid', onPress: async () => {
        try { await api(`/me/devices/${d.id}`, { method: 'DELETE' }); showToast(`${d.name} signed out`, 'success'); } catch (e) { showToast(e.message); }
        load();
      } }, { label: 'Cancel' }],
    });
  }

  function signOutAll() {
    confirm({
      tone: 'danger', icon: 'alert', title: 'Sign out all other devices?', text: `${othersCount} other device${othersCount === 1 ? '' : 's'} will be signed out and need your PIN and an SMS code to sign in again. This phone stays signed in.`,
      actions: [{ label: `Sign out ${othersCount}`, kind: 'dangerSolid', onPress: async () => {
        try { const r = await api('/me/devices/sign-out-others', { method: 'POST' }); showToast(`${r.devicesSignedOut} device${r.devicesSignedOut === 1 ? '' : 's'} signed out`, 'success'); } catch (e) { showToast(e.message); }
        load();
      } }, { label: 'Cancel' }],
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <TopBar title="My devices" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: space.scroll, width: '100%', maxWidth: 680, alignSelf: 'center' }}
        onScroll={(e) => { if (nearEnd(e)) paged.loadMore(); }} scrollEventThrottle={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <T color="text2" style={{ marginBottom: 14 }}>Phones and tablets signed in to your account. A device you sign out needs your PIN and an SMS code to sign in again.</T>
        {error ? (
          <View style={{ gap: 10 }}>
            <Banner tone="error" title="Couldn't load your devices" text={error.message} />
            <Button title="Retry" kind="secondary" icon="refresh" small onPress={load} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : !devices ? (
          <Card>{[0, 1].map((i) => <View key={i} style={{ height: 66, margin: 8, borderRadius: 12, backgroundColor: c.surface3, opacity: 0.6 }} />)}</Card>
        ) : (
          <Card>
            {devices.map((d, i) => (
              <Row key={d.id} icon={d.name.toLowerCase().includes('ipad') || d.name.toLowerCase().includes('tab') ? 'tablet' : 'phone'} title={d.name}
                subtitle={`${d.platform === 'ios' ? 'iOS' : 'Android'} · ${d.isCurrent ? 'Active now' : lastActiveText(d.lastSeenAt)}${d.biometricEnabled ? ' · Face ID / fingerprint on' : ''}`}
                right={d.isCurrent ? <Badge text="This device" tone="success" /> : <Button title="Sign out" kind="danger" small onPress={() => signOutOne(d)} />}
                last={i === devices.length - 1} />
            ))}
          </Card>
        )}
        <MoreFooter paged={paged} allText={`That's all ${paged.total} devices.`} />
        {devices && !othersCount ? <T variant="small" color="muted" style={{ textAlign: 'center', marginTop: 12 }}>Only this device is signed in.</T> : null}
        {isOwner ? <T variant="small" color="muted" style={{ marginTop: 16 }}>To sign out a team member's phones, open More → Team.</T> : null}
        <Button title="Sign out all other devices" kind="danger" disabled={!othersCount} onPress={signOutAll} style={{ marginTop: 20 }} />
      </ScrollView>
    </View>
  );
}
