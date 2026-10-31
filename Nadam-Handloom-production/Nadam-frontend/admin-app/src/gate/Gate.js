// What the start-up check shows (Module 11, section 8): "Update required" on a phone older
// than allowed, for everyone, signed in or not; the maintenance screen for signed-in staff
// while the staff app is paused (owners keep working). Both cover the app, so the screens
// under them, and anything half done, are kept for when it opens again.
import { useEffect, useState } from 'react';
import { AppState, BackHandler, Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useFeedback } from '../components/Feedback';
import { Button } from '../components/Button';
import { MessageIcon } from '../components/Bits';
import { T } from '../components/T';
import { session, useSession } from '../auth/session';
import { decide, pausedFor } from '../utils/gate';
import { gate, useGate, BUILD, PLATFORM, VERSION } from './store';

const logo = require('../../assets/logo.png');
const FIVE_MIN = 5 * 60 * 1000;

function Cover({ icon, tone, title, text, hint, children }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'center' }}>
          <Image source={logo} style={{ width: 64, height: 64 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          <MessageIcon name={icon} tone={tone} />
          <T variant="heading" style={{ textAlign: 'center' }} accessibilityRole="header">{title}</T>
          <T variant="body" color="text2" style={{ textAlign: 'center', marginTop: 10 }}>{text}</T>
          {hint ? <T variant="small" color="muted" style={{ textAlign: 'center', marginTop: 14 }}>{hint}</T> : null}
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 28 }}>{children}</View>
        </View>
      </ScrollView>
    </View>
  );
}

export function Gate() {
  const g = useGate();
  const s = useSession();
  const { showToast, confirm } = useFeedback();
  const [checking, setChecking] = useState(false);
  const update = decide(g.status, BUILD, PLATFORM);
  const paused = s.status === 'signedIn' ? pausedFor(g, s.user) : null;
  const isPaused = !!paused;
  const blocked = update.mustUpdate || isPaused;

  useEffect(() => {
    gate.load();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') gate.check(); });
    return () => sub.remove();
  }, []);
  // Again whenever someone signs in or out (a staff sign-in during maintenance).
  useEffect(() => { gate.check(); }, [s.status, s.user?.id]);
  useEffect(() => {
    const t = setInterval(() => gate.check(), isPaused ? 60 * 1000 : FIVE_MIN);
    return () => clearInterval(t);
  }, [isPaused]);
  // The phone's back button leaves the app instead of moving the screens underneath.
  useEffect(() => {
    if (!blocked) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { BackHandler.exitApp(); return true; });
    return () => sub.remove();
  }, [blocked]);

  async function again(stillText, okText) {
    setChecking(true);
    const st = await gate.check();
    setChecking(false);
    if (!st) return showToast('Can\'t reach the server. Check your internet and try again.');
    const now = gate.getState();
    const still = update.mustUpdate ? decide(st, BUILD, PLATFORM).mustUpdate : !!pausedFor(now, session.getState().user);
    return still ? showToast(stillText) : showToast(okText, 'success');
  }

  if (update.mustUpdate) {
    return (
      <Cover icon="download" tone="primary" title="Update required"
        text={`This phone has version ${VERSION}. Version ${update.need} or later is needed to keep working.`}
        hint="Anything on this phone that wasn't sent yet is kept.">
        <Button title={PLATFORM === 'ios' ? 'Open TestFlight' : 'Update in Play Store'} icon="download" onPress={() => Linking.openURL(update.link).catch(() => showToast('Couldn\'t open the store. Open it yourself and search "Nandam".'))} />
        <Button title="Check again" kind="secondary" icon="refresh" loading={checking} onPress={() => again('This phone still needs the update.', 'You can use the app again.')} />
      </Cover>
    );
  }
  if (paused) {
    return (
      <Cover icon="clock" tone="warning" title="Under maintenance"
        text={paused.message || 'We are making changes. Please wait a little.'}
        hint="Your work on this phone is kept. The app checks again by itself every minute.">
        <Button title="Try again" icon="refresh" loading={checking} onPress={() => again('Still under maintenance.', 'You can work again.')} />
        <Button title="Log out" kind="secondary" icon="logout" onPress={() => confirm({
          icon: 'logout', title: 'Log out on this phone?', text: 'You\'ll need your PIN to sign in again. Anything unsaved stays on this phone for your next sign-in.',
          actions: [{ label: 'Log out', kind: 'dangerSolid', onPress: async () => { await session.logout(); router.replace('/sign-in'); } }, { label: 'Cancel' }],
        })} />
      </Cover>
    );
  }
  return null;
}

// The line under the offline bar on signed-in screens: a newer version is out (nobody is
// blocked). "Later" hides it for a day.
export function NewVersionBar() {
  const { c } = useTheme();
  const g = useGate();
  const { showToast } = useFeedback();
  const u = decide(g.status, BUILD, PLATFORM);
  if (!u.newVersion || g.later) return null;
  return (
    <View accessibilityRole="summary" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6, paddingLeft: 16, paddingRight: 6, backgroundColor: c.infoSoft }}>
      <T variant="caption" color="info" style={{ flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold' }}>A new version of the app is available.</T>
      <Button title="Update" kind="ghost" small onPress={() => Linking.openURL(u.link).catch(() => {})} />
      <Button title="Later" kind="ghost" small onPress={() => { gate.later(); showToast('Hidden for a day'); }} />
    </View>
  );
}
