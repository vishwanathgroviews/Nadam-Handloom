// Apple's push service (APNs) for the admin app on iPhones, over HTTP/2 with a push key
// (.p8) from the Apple Developer account: a signed token (ES256) reused for 50 minutes, one
// connection kept open. The payload follows Expo's notes ("Send notifications with FCM and
// APNs"): aps.alert for the text, `body` for the data the app reads on a tap.
import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const TIMEOUT_MS = 10000;

export function apnsPayload(m) {
  return {
    aps: { alert: { title: m.title, body: m.body }, sound: 'default', ...(m.tag ? { 'thread-id': m.tag } : {}) },
    body: m.data || {},
  };
}

// cfg: { keyId, teamId, privateKey, bundleId, production }. connect is swapped in tests.
export function apnsSender(cfg, connect = (url) => http2.connect(url)) {
  const host = cfg.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  let cached = { token: null, until: 0 };
  let session = null;

  function bearer() {
    if (cached.token && Date.now() < cached.until) return cached.token;
    const token = jwt.sign({ iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }, cfg.privateKey, { algorithm: 'ES256', header: { alg: 'ES256', kid: cfg.keyId } });
    cached = { token, until: Date.now() + 50 * 60 * 1000 };
    return token;
  }
  function client() {
    if (session && !session.closed && !session.destroyed) return session;
    session = connect(host);
    const forget = () => { session = null; };
    session.on('error', forget);
    session.on('goaway', forget);
    session.on('close', forget);
    return session;
  }

  function send(m) {
    return new Promise((resolve) => {
      let req;
      try {
        req = client().request({
          ':method': 'POST',
          ':path': `/3/device/${m.token}`,
          authorization: `bearer ${bearer()}`,
          'apns-topic': cfg.bundleId,
          'apns-push-type': 'alert',
          'apns-priority': m.urgent ? '10' : '5',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + (m.ttlSeconds ?? 86400)),
          ...(m.tag ? { 'apns-collapse-id': String(m.tag).slice(0, 64) } : {}),
          'content-type': 'application/json',
        });
      } catch (err) {
        resolve({ ok: false, retryable: true, error: err.message.slice(0, 200) });
        return;
      }
      let status = 0;
      let text = '';
      const timer = setTimeout(() => { req.close(); resolve({ ok: false, retryable: true, error: 'timeout' }); }, TIMEOUT_MS);
      req.on('response', (h) => { status = Number(h[':status']); });
      req.setEncoding('utf8');
      req.on('data', (c) => { text += c; });
      req.on('end', () => {
        clearTimeout(timer);
        if (status === 200) { resolve({ ok: true }); return; }
        let reason = '';
        try { reason = JSON.parse(text).reason || ''; } catch { /* no body */ }
        // The app was removed, or the token isn't for this app: Apple will never deliver to it.
        if (status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason)) {
          resolve({ ok: false, invalidToken: true, error: reason || String(status) });
          return;
        }
        resolve({ ok: false, retryable: status === 429 || status >= 500, error: `${status} ${reason}`.trim() });
      });
      req.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, retryable: true, error: err.message.slice(0, 200) }); });
      req.end(JSON.stringify(apnsPayload(m)));
    });
  }

  return { name: 'apns', send, close: () => session?.close() };
}

// The shop's sender, made on first use from the one backend .env.
let shared = null;
export const apnsPush = {
  name: 'apns',
  send(message) {
    shared ??= apnsSender(env.push.apns);
    return shared.send(message);
  },
};
