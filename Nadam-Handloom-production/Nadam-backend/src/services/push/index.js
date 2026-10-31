// Picks the push sender from the settings: Firebase (fcm) or test mode (console).
// The admin app: Android phones through Firebase, iPhones through Apple (APNs) once its push
// key is set; until then (live) an iPhone simply gets nothing, and the app says so.
import { env } from '../../config/env.js';
import { consolePush } from './console.provider.js';
import { fcmPush } from './fcm.provider.js';
import { apnsPush } from './apns.provider.js';

export const push = env.push.provider === 'fcm' ? fcmPush : consolePush;

const noApple = { name: 'none', send: async () => ({ ok: false, notSetUp: true, error: 'APNS_NOT_SET_UP' }) };
const iosPush = env.push.apns ? apnsPush : env.isProduction ? noApple : consolePush;

export const pushFor = (platform) => (platform === 'ios' ? iosPush : push);
export const iosPushReady = () => !!env.push.apns || !env.isProduction;
