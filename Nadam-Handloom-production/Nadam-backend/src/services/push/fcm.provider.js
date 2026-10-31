// Firebase Cloud Messaging, HTTP v1 API (what the Firebase Admin SDK calls), with the
// service account in the one backend .env. A Google access key is made from the
// service account (signed JWT → OAuth token) and reused for its hour.
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 10000;

// message: { token, title, body, link, icon, tag, data, urgent, ttlSeconds, platform, channel }
export function fcmBody(m, validateOnly = false) {
  // The admin app on Android: a notification Android shows by itself (also when the app is in
  // the background or closed; Samsung phones hold back data-only messages, found on a real phone
  // on 17 Oct 2026), in the app's "Online payments" channel, with the data the app reads when it
  // is tapped (expo-notifications passes it on: `number`, and `body` as JSON like Expo's own).
  if (m.platform === 'android') {
    const data = Object.fromEntries(Object.entries({ ...(m.data || {}), body: JSON.stringify(m.data || {}) }).map(([k, v]) => [k, String(v ?? '')]));
    return {
      validate_only: !!validateOnly,
      message: {
        token: m.token,
        notification: { title: m.title, body: m.body },
        data,
        android: {
          priority: m.urgent ? 'HIGH' : 'NORMAL',
          ttl: `${m.ttlSeconds ?? 86400}s`,
          notification: { channel_id: m.channel || 'default', sound: 'default', ...(m.tag ? { tag: m.tag } : {}) },
        },
      },
    };
  }
  const data = Object.fromEntries(
    Object.entries({ ...(m.data || {}), link: m.link || '', title: m.title, body: m.body }).map(([k, v]) => [k, String(v ?? '')]),
  );
  return {
    validate_only: !!validateOnly,
    message: {
      token: m.token,
      data,
      webpush: {
        headers: { Urgency: m.urgent ? 'high' : 'normal', TTL: String(m.ttlSeconds ?? 86400) },
        notification: { title: m.title, body: m.body, icon: m.icon || '/icons/icon-192.png', badge: '/icons/badge-72.png', ...(m.tag ? { tag: m.tag } : {}) },
        // Firebase only accepts https links here; the website's worker also reads data.link.
        ...(m.link?.startsWith('https://') ? { fcm_options: { link: m.link } } : {}),
      },
    },
  };
}

// creds: { projectId, clientEmail, privateKey }. fetchFn is swapped in tests.
export function fcmSender(creds, fetchFn = (...a) => fetch(...a)) {
  let cached = { token: null, until: 0 };

  async function accessToken(force) {
    if (!force && cached.token && Date.now() < cached.until) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const assertion = jwt.sign({ iss: creds.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }, creds.privateKey, { algorithm: 'RS256' });
    const res = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) throw new Error(`Google refused the Firebase sign-in (${res.status} ${body.error || ''})`.trim());
    cached = { token: body.access_token, until: Date.now() + (Number(body.expires_in || 3600) - 120) * 1000 };
    return cached.token;
  }

  async function send(message, { validateOnly = false } = {}) {
    const url = `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await fetchFn(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${await accessToken(attempt > 0)}`, 'content-type': 'application/json' },
          body: JSON.stringify(fcmBody(message, validateOnly)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        return { ok: false, retryable: true, error: err.message.slice(0, 200) };
      }
      if (res.status === 401 && attempt === 0) continue; // the Google key ran out: make a new one once
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, id: body.name };
      const status = body?.error?.status || '';
      const fcmCode = (body?.error?.details || []).find((d) => d.errorCode)?.errorCode || '';
      // The browser unsubscribed or the token is not a real one: Firebase will never deliver to it.
      // A 400 counts only when Firebase says the token itself is wrong, never for a mistake in our message.
      const badToken = res.status === 400 && /registration token/i.test(body?.error?.message || '');
      if (res.status === 404 || fcmCode === 'UNREGISTERED' || badToken) {
        return { ok: false, invalidToken: true, error: fcmCode || status || String(res.status) };
      }
      return { ok: false, retryable: res.status === 429 || res.status >= 500, error: `${res.status} ${fcmCode || status}`.trim() };
    }
    return { ok: false, retryable: true, error: 'unauthorized' };
  }

  return { name: 'fcm', send };
}

// The shop's sender, made on first use from the one backend .env.
let shared = null;
export const fcmPush = {
  name: 'fcm',
  send(message, opts) {
    shared ??= fcmSender({ projectId: env.push.projectId, clientEmail: env.push.clientEmail, privateKey: env.push.privateKey });
    return shared.send(message, opts);
  },
};
