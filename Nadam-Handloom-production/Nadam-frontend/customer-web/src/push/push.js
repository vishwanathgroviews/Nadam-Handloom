// Website notifications with Firebase Cloud Messaging (W1, web-01 section 10).
// Firebase's code loads only when a customer turns notifications on. The browser asks for
// permission only after the customer presses a button (never on page load).
import { savePushToken, readPushToken } from './token.js';

const SW_URL = '/firebase-messaging-sw.js';

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// What this browser can do: ok | not-configured | ios-home-screen | unsupported | insecure.
export function pushSupport(pushConfig) {
  if (!pushConfig) return 'not-configured';
  if (!window.isSecureContext) return 'insecure';
  if (isIos() && !isStandalone()) return 'ios-home-screen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

export const permission = () => ('Notification' in window ? Notification.permission : 'denied');

let loaded = null;
async function firebase(pushConfig) {
  loaded ??= (async () => {
    const [{ initializeApp, getApps }, messaging] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
    if (!(await messaging.isSupported())) throw Object.assign(new Error('unsupported'), { code: 'PUSH_UNSUPPORTED' });
    const app = getApps()[0] || initializeApp({
      apiKey: pushConfig.apiKey, authDomain: pushConfig.authDomain || undefined, projectId: pushConfig.projectId || undefined,
      storageBucket: pushConfig.storageBucket || undefined, messagingSenderId: pushConfig.messagingSenderId, appId: pushConfig.appId,
    });
    return { messaging, instance: messaging.getMessaging(app) };
  })();
  try {
    return await loaded;
  } catch (err) {
    loaded = null;
    throw err;
  }
}

async function registration() {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

// This browser's Firebase token. Two asks at the same moment (the page checking while the
// customer presses Turn on) share one answer: two at once would make two tokens, one of which
// Firebase drops straight away (found on a real phone, W7).
let asking = null;
function firebaseToken(pushConfig) {
  asking ??= (async () => {
    const reg = await registration();
    const { messaging, instance } = await firebase(pushConfig);
    return messaging.getToken(instance, { vapidKey: pushConfig.vapidKey, serviceWorkerRegistration: reg });
  })().finally(() => { asking = null; });
  return asking;
}

// Asks the browser, then gets this browser's Firebase token. Returns { permission, token }.
export async function turnOn(pushConfig) {
  const result = await Notification.requestPermission();
  if (result !== 'granted') return { permission: result, token: null };
  const token = await firebaseToken(pushConfig);
  if (!token) throw Object.assign(new Error('no token'), { code: 'PUSH_NO_TOKEN' });
  savePushToken(token);
  return { permission: 'granted', token };
}

// The token again (it can change); null if notifications are not on.
export async function currentToken(pushConfig) {
  if (permission() !== 'granted') return null;
  try {
    const token = await firebaseToken(pushConfig);
    if (token) savePushToken(token);
    return token || null;
  } catch {
    return readPushToken();
  }
}

export async function turnOff(pushConfig) {
  try {
    const { messaging, instance } = await firebase(pushConfig);
    await messaging.deleteToken(instance);
  } catch { /* already gone */ }
  savePushToken(null);
}

// Messages that arrive while the website is open in front (the worker hands them over).
export function onForegroundMessage(fn) {
  if (!('serviceWorker' in navigator)) return () => {};
  const handler = (e) => { if (e.data?.type === 'nh-push') fn(e.data); };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
