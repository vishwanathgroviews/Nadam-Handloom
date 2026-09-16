import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Remote push notifications were removed from Expo Go as of SDK 53 — on
// Android in particular, merely evaluating expo-notifications' module-level
// setup while running inside Expo Go throws a fatal "[runtime not ready]"
// error and the whole JS bundle fails to load, not just the push feature.
// Detecting Expo Go up front and never importing expo-notifications there
// (a real dev/production build still gets full push support) is the fix —
// gating individual function calls isn't enough, since the crash happens at
// module-evaluation time, before any of our code runs.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export interface PushRegistration {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Master switch for the notifications feature, which is turned off for now
 * at the client's request. While this is false the app never asks for the
 * notification permission and never registers a device token, so no push
 * can be delivered to it. Everything below is left intact — flip this back
 * to true to turn the feature back on, no other change needed.
 */
export const PUSH_NOTIFICATIONS_ENABLED = false;

/**
 * Requests permission and returns an Expo push token, or null if push isn't
 * available right now (Expo Go, simulator, permission denied, or — until
 * `eas init` has been run for this project — no EAS projectId configured yet).
 */
export const registerForPushNotifications = async (): Promise<PushRegistration | null> => {
  if (!PUSH_NOTIFICATIONS_ENABLED) return null;
  if (isExpoGo) {
    console.warn('Push notifications need a development build — skipping under Expo Go.');
    return null;
  }

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission was not granted.');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId configured for this app — run `eas init` to enable push notifications.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
};
