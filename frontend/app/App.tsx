import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppSplash from './src/components/AppSplash';
import { DialogProvider } from './src/components/DialogProvider';
import RootNavigator from './src/navigation/RootNavigator';

// Outfit is the customer web's existing body font
// (frontend/customer-web/index.html) — used exclusively here too, at every
// weight, so the whole app reads as one consistent typeface.
export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  // Until the fonts are in, the launch screen simply stays up (see
  // AppSplash) — no spinner flashes between it and the first real screen.
  if (!fontsLoaded) {
    return <AppSplash ready={false} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Inside AuthProvider so any screen can raise a dialog, and above the
            navigator so a dialog survives the screen that opened it. */}
        <DialogProvider>
          <RootNavigator />
        </DialogProvider>
        <LaunchSplash />
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

/**
 * Plays the launch animation once the saved session has been checked, so it
 * lifts away onto the right first screen (sign-in or home) rather than a
 * loading spinner.
 */
function LaunchSplash() {
  const { status } = useAuth();
  return <AppSplash ready={status !== 'loading'} />;
}
