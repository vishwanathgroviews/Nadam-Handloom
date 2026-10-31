// App root: fonts, theme, dialogs/toasts, and restoring the sign-in before the
// first screen shows (the native splash stays up until then). Over everything, the
// start-up check: Update required, or the maintenance screen for staff (Module 11).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from '../theme/ThemeProvider';
import { FeedbackProvider } from '../components/Feedback';
import { session } from '../auth/session';
import { themePref, useAppScheme } from '../theme/themePref';
import { Gate } from '../gate/Gate';
import { setNavigationBarLight } from '../../modules/nandam-system-bars';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const [restored, setRestored] = useState(false);
  // Android's own button strip follows light/dark, also when the phone (or the app theme) switches while the app is open.
  const scheme = useAppScheme();
  useEffect(() => { setNavigationBarLight(scheme !== 'dark').catch(() => {}); }, [scheme]);

  useEffect(() => {
    // The theme choice is read before the first screen, so a Dark phone never flashes light.
    Promise.allSettled([session.restore(), themePref.load()]).then(() => setRestored(true));
  }, []);

  // Coming back to the app renews the access key (and so keeps the 7 days rolling).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && session.getState().status === 'signedIn') session.getAccessToken().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const ready = (fontsLoaded || fontError) && restored;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FeedbackProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
          <Gate />
        </FeedbackProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
