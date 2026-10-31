// Website W1: small pieces with no database: browser names, cookies, the pincode file,
// the Firebase sender's message and error handling, the code-life rule.
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { describeUserAgent } from '../../src/utils/userAgent.js';
import { readCookies } from '../../src/utils/cookies.js';
import { parsePincodeCsv } from '../../src/utils/csv.js';
import { fcmSender, fcmBody } from '../../src/services/push/fcm.provider.js';
import { codeLifeSeconds } from '../../src/services/shop/code.service.js';
import { splitName } from '../../src/services/shop/auth.service.js';

describe('browser names', () => {
  const cases = [
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', 'Chrome on Android', 'mobile'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari on iPhone', 'mobile'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1', 'Chrome on iPhone', 'mobile'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Safari on iPad', 'tablet'],
    ['Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36', 'Samsung Internet on Android', 'mobile'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', 'Edge on Windows', 'desktop'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Mac', 'desktop'],
    ['Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 'Chrome on Android', 'tablet'],
    ['', 'Web browser', 'desktop'],
  ];
  it.each(cases)('%#', (ua, label, device) => {
    expect(describeUserAgent(ua)).toMatchObject({ label, device });
  });
});

describe('cookies', () => {
  it('reads every cookie, decoded', () => {
    const req = { headers: { cookie: 'a=1; nh_shop_session=abc%2Fdef; b="quoted"; broken; =x' } };
    expect(readCookies(req)).toEqual({ a: '1', nh_shop_session: 'abc/def', b: 'quoted' });
    expect(readCookies({ headers: {} })).toEqual({});
  });
});

describe('the pincode file', () => {
  it('parses quoted names and skips bad rows', () => {
    const rows = parsePincodeCsv('pincode,area,city,state\n522503,Mangalagiri,Guntur,Andhra Pradesh\n110110,"Nodal Delivery Centre(Parcel), Rohini",North West,Delhi\n012345,Bad,Bad,Bad\n\n');
    expect(rows).toEqual([
      { pincode: '522503', area: 'Mangalagiri', city: 'Guntur', state: 'Andhra Pradesh' },
      { pincode: '110110', area: 'Nodal Delivery Centre(Parcel), Rohini', city: 'North West', state: 'Delhi' },
    ]);
  });

  it('the shipped file: 19,297 pincodes, 36 states, no Army or test offices', () => {
    const rows = parsePincodeCsv(fs.readFileSync('prisma/data/india-pincodes.csv', 'utf8'));
    expect(rows).toHaveLength(19297);
    expect(new Set(rows.map((r) => r.state)).size).toBe(36);
    expect(rows.some((r) => r.pincode.startsWith('9'))).toBe(false);
    expect(new Set(rows.map((r) => r.pincode)).size).toBe(rows.length);
  });
});

describe('names', () => {
  it('first word is the first name, the rest the last name', () => {
    expect(splitName('Asha Rani Devi')).toEqual({ firstName: 'Asha', lastName: 'Rani Devi' });
    expect(splitName('Priya')).toEqual({ firstName: 'Priya', lastName: '' });
  });
});

describe('codes', () => {
  it('our own codes live 10 minutes (test mode)', () => {
    expect(codeLifeSeconds()).toBe(600);
  });
});

describe('Firebase sender', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const creds = { projectId: 'demo-project', clientEmail: 'push@demo-project.iam.gserviceaccount.com', privateKey };
  const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

  // A fake Google: the token endpoint, then FCM replies taken from `fcm` in order.
  function fakeGoogle(fcm) {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      if (url.includes('oauth2')) return reply(200, { access_token: `g-${calls.length}`, expires_in: 3600 });
      return fcm.shift();
    };
    return { calls, fetchFn };
  }

  it('builds a web push with an https link only, and string data', () => {
    const b = fcmBody({ token: 't', title: 'Shipped', body: 'DTDC 123', link: 'https://x.in/orders/1', tag: 'order_shipped', data: { orderId: 7 } });
    expect(b.message.webpush.fcm_options).toEqual({ link: 'https://x.in/orders/1' });
    expect(b.message.webpush.notification).toMatchObject({ title: 'Shipped', body: 'DTDC 123', tag: 'order_shipped' });
    expect(b.message.data).toEqual({ orderId: '7', link: 'https://x.in/orders/1', title: 'Shipped', body: 'DTDC 123' });
    expect(fcmBody({ token: 't', title: 'a', body: 'b', link: 'http://localhost:5173/x' }).message.webpush.fcm_options).toBeUndefined();
  });

  it('signs in to Google once and reuses the key', async () => {
    const g = fakeGoogle([reply(200, { name: 'projects/demo/messages/1' }), reply(200, { name: 'projects/demo/messages/2' })]);
    const s = fcmSender(creds, g.fetchFn);
    expect(await s.send({ token: 't', title: 'a', body: 'b' })).toEqual({ ok: true, id: 'projects/demo/messages/1' });
    expect(await s.send({ token: 't', title: 'a', body: 'b' })).toMatchObject({ ok: true });
    expect(g.calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    const assertion = new URLSearchParams(g.calls[0].init.body).get('assertion');
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
    expect(claims).toMatchObject({ iss: creds.clientEmail, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token' });
    expect(g.calls[1].url).toBe('https://fcm.googleapis.com/v1/projects/demo-project/messages:send');
    expect(g.calls[1].init.headers.authorization).toBe('Bearer g-1');
  });

  it('a gone browser is reported as an invalid token; a mistake in our message is not', async () => {
    const g = fakeGoogle([
      reply(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }),
      reply(400, { error: { status: 'INVALID_ARGUMENT', message: 'The registration token is not a valid FCM registration token' } }),
      reply(400, { error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at message.webpush.headers' } }),
      reply(503, { error: { status: 'UNAVAILABLE' } }),
    ]);
    const s = fcmSender(creds, g.fetchFn);
    expect(await s.send({ token: 't', title: 'a', body: 'b' })).toMatchObject({ ok: false, invalidToken: true, error: 'UNREGISTERED' });
    expect(await s.send({ token: 't', title: 'a', body: 'b' })).toMatchObject({ ok: false, invalidToken: true });
    expect(await s.send({ token: 't', title: 'a', body: 'b' })).toEqual({ ok: false, retryable: false, error: '400 INVALID_ARGUMENT' });
    expect(await s.send({ token: 't', title: 'a', body: 'b' })).toEqual({ ok: false, retryable: true, error: '503 UNAVAILABLE' });
  });

  it('an expired Google key is renewed once; Google refusing is an error result, not a crash', async () => {
    const g = fakeGoogle([reply(401, {}), reply(200, { name: 'm/3' })]);
    expect(await fcmSender(creds, g.fetchFn).send({ token: 't', title: 'a', body: 'b' })).toEqual({ ok: true, id: 'm/3' });
    expect(g.calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(2);
    const refused = fcmSender(creds, async () => reply(400, { error: 'invalid_grant' }));
    expect(await refused.send({ token: 't', title: 'a', body: 'b' })).toMatchObject({ ok: false, retryable: true, error: expect.stringContaining('invalid_grant') });
  });
});

describe('unexpected errors', () => {
  it('get a short reference the customer can quote; the details stay in the log', async () => {
    const { errorHandler } = await import('../../src/middlewares/errorHandler.js');
    const res = { headers: {}, statusCode: 0, body: null, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    const spy = (await import('vitest')).vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('database exploded'), { id: 'ab12cd34-5678-90ef', method: 'GET', originalUrl: '/api/v2/shop/me' }, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.', details: { reference: 'AB12CD34' } } });
    expect(JSON.stringify(res.body)).not.toContain('exploded');
    expect(spy.mock.calls[0][0]).toContain('AB12CD34');
  });
});

describe('odd characters and networks (16 Oct check)', () => {
  it('control and invisible characters go; tabs, new lines and the Indic joiners stay', async () => {
    const { cleanText, cleanDeep } = await import('../../src/utils/text.js');
    expect(cleanText('a\u0000b\u0007c\u007Fd')).toBe('a b c d');
    expect(cleanText('﻿Priya​ Sharma⁠')).toBe('Priya Sharma');
    expect(cleanText('line 1\nline 2\tend\r')).toBe('line 1\nline 2\tend\r');
    expect(cleanText('క్‌ష')).toBe('క్‌ష');
    expect(cleanDeep({ a: 'x\u0000', b: ['y\u0000', 3, null], c: { d: 'z​' } })).toEqual({ a: 'x ', b: ['y ', 3, null], c: { d: 'z' } });
  });

  it('IPv6 counts by /64 block, IPv4 by address', async () => {
    const { networkOf } = await import('../../src/utils/network.js');
    expect(networkOf('2401:4900:1c2a:7f12:aaaa:bbbb:cccc:dddd')).toEqual({ key: '2401:4900:1c2a:7f12::/64', v6: true });
    expect(networkOf('2401:4900:1c2a:7f12::1')).toEqual({ key: '2401:4900:1c2a:7f12::/64', v6: true });
    expect(networkOf('2401:db8::1')).toEqual({ key: '2401:0db8:0000:0000::/64', v6: true });
    expect(networkOf('::ffff:49.37.10.2')).toEqual({ key: '49.37.10.2', v6: false });
    expect(networkOf('49.37.10.2')).toEqual({ key: '49.37.10.2', v6: false });
    expect(networkOf('fe80::1%eth0')).toEqual({ key: 'fe80:0000:0000:0000::/64', v6: true });
    expect(networkOf('not an ip')).toBeNull();
    expect(networkOf(undefined)).toBeNull();
  });

  it('a character the database refuses becomes a plain message, not a 500', async () => {
    const { errorHandler } = await import('../../src/middlewares/errorHandler.js');
    const res = { headers: {}, statusCode: 0, body: null, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    const err = Object.assign(new Error('Database error'), { code: 'P2039', meta: { driverAdapterError: { cause: { code: '22021' } } } });
    errorHandler(err, { id: 'x', method: 'POST', originalUrl: '/api/v2/products' }, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('BAD_TEXT');
  });
});
