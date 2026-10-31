// This phone's notifications (owners: one for each online payment and refund).
// - Android: Firebase (google-services.json in the build); iPhone: Apple's push service.
// - Asked only when the owner turns "Payment notifications" on (More, or Online payments);
//   once allowed, the token is sent again each time the app starts, and whenever it changes.
// - A tap opens that payment.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as payments from '../api/payments';

export const CHANNEL = 'payments';

// Shown even while the app is open (a banner in the app's own colours is the phone's job).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const platform = () => (Platform.OS === 'ios' ? 'ios' : 'android');
const allowed = (p) => !!p && (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);

// Android: the channel exists before asking (Android 13 shows the question only then).
async function channel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Online payments',
    description: 'A notification for each payment on the website, and for refunds',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 220, 120, 220],
    lightColor: '#0D5C61',
  });
}

// 'allowed' | 'ask' (not asked yet, or can ask again) | 'blocked' (turned off in Settings)
export async function permission() {
  const p = await Notifications.getPermissionsAsync();
  if (allowed(p)) return 'allowed';
  return p.canAskAgain === false ? 'blocked' : 'ask';
}

// Turns notifications on for this phone: asks (when `ask`), then sends the token to the server.
// Answers { ok, reason?, push? }; reason: blocked | denied | unavailable.
export async function enable({ ask = true, paymentsOn } = {}) {
  await channel();
  let p = await Notifications.getPermissionsAsync();
  if (!allowed(p) && ask && p.canAskAgain !== false) p = await Notifications.requestPermissionsAsync();
  if (!allowed(p)) return { ok: false, reason: p.canAskAgain === false ? 'blocked' : 'denied' };
  let token;
  try {
    token = (await Notifications.getDevicePushTokenAsync()).data;
  } catch {
    return { ok: false, reason: 'unavailable' }; // no Google Play services, or Apple refused
  }
  lastSent = String(token);
  const r = await payments.registerPush({ token: lastSent, platform: platform(), payments: paymentsOn });
  return { ok: true, push: r.push };
}

// The token this app last sent: Android reports the same token right after it is read, and it
// needn't go to the server twice.
let lastSent = null;

// When the phone's token changes, the server gets the new one.
export function watchToken() {
  const sub = Notifications.addPushTokenListener((t) => {
    if (String(t.data) === lastSent) return;
    lastSent = String(t.data);
    payments.registerPush({ token: lastSent, platform: platform() }).catch(() => {});
  });
  return () => sub.remove();
}
