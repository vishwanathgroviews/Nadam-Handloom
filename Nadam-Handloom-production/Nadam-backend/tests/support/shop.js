// Helpers for the website API tests (W1): sign up / sign in through the real endpoints,
// carry the 30-day cookie by hand, and call /api/v2/shop as a signed-in customer.
import crypto from 'node:crypto';
import { api, prisma } from './helpers.js';

// Random mobile numbers starting 6 (never repeated in a run): the clock-based helper can
// repeat a number across test files about 100 seconds apart.
const used = new Set();
export function newMobile() {
  for (;;) {
    const m = `6${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;
    if (!used.has(m)) { used.add(m); return m; }
  }
}

export const SHOP = '/api/v2/shop';
export const HEADER = { 'x-requested-with': 'nandam-web' };
export const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

// Each test customer comes from its own network, so the per-network code limit
// (20 an hour) never trips across tests unless a test means it to. Random, because a
// counter would start again in every test file while the database keeps the codes.
const ips = new Set();
export function newIp() {
  for (;;) {
    const n = crypto.randomInt(0, 2 ** 24);
    const a = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    if (!ips.has(a)) { ips.add(a); return a; }
  }
}

export const post = (path, body, { ipAddr = newIp(), ua = UA.android, headers = {} } = {}) =>
  api().post(`${SHOP}${path}`).set('x-forwarded-for', ipAddr).set('user-agent', ua).set(headers).send(body);

// "nh_shop_session=<value>" from a reply, or null.
export function cookieFrom(res) {
  const c = (res.headers['set-cookie'] || []).find((x) => x.startsWith('nh_shop_session='));
  if (!c) return null;
  const value = c.split(';')[0].slice('nh_shop_session='.length);
  return value ? `nh_shop_session=${value}` : null;
}
export const rawCookie = (res) => (res.headers['set-cookie'] || []).find((x) => x.startsWith('nh_shop_session=')) || null;

export const sendCode = (mobile, opts = {}) => post('/auth/code', { mobile }, opts);
export const verify = (mobile, code, opts = {}) => post('/auth/verify', { mobile, code }, opts);

export const profileFor = (over = {}) => ({
  fullName: 'Priya Sharma', email: `priya.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`, pincode: '522503', marketingOptIn: false, ...over,
});

// A new customer through the real flow. Returns { mobile, cookie, accessToken, customer, ua }.
export async function signUp({ mobile = newMobile(), profile = {}, ua = UA.android, ipAddr = newIp() } = {}) {
  const c = await sendCode(mobile, { ipAddr, ua });
  if (c.status !== 202) throw new Error(`code: ${c.status} ${JSON.stringify(c.body)}`);
  const v = await verify(mobile, c.body.devCode, { ipAddr, ua });
  if (v.body.status !== 'needs_profile') throw new Error(`verify: ${JSON.stringify(v.body)}`);
  const done = await post('/auth/complete', { stepToken: v.body.stepToken, ...profileFor(profile) }, { ipAddr, ua });
  if (done.status !== 200) throw new Error(`complete: ${done.status} ${JSON.stringify(done.body)}`);
  return { mobile, ua, ipAddr, cookie: cookieFrom(done), accessToken: done.body.accessToken, customer: done.body.customer, reply: done };
}

// A known customer signs in again on another browser.
export async function signIn(mobile, { ua = UA.mac, ipAddr = newIp() } = {}) {
  await forgetShopCodes(mobile);
  const c = await sendCode(mobile, { ipAddr, ua });
  const v = await verify(mobile, c.body.devCode, { ipAddr, ua });
  if (v.body.status !== 'signed_in') throw new Error(`sign-in: ${JSON.stringify(v.body)}`);
  return { mobile, ua, ipAddr, cookie: cookieFrom(v), accessToken: v.body.accessToken, customer: v.body.customer };
}

export const refresh = (cookie, { ua = UA.android, headers = HEADER } = {}) => {
  const r = api().post(`${SHOP}/auth/refresh`).set('user-agent', ua).set(headers);
  return cookie ? r.set('cookie', cookie) : r;
};

// A request as a signed-in customer.
export const as = (who) => (method, path) => api()[method](`${SHOP}${path}`).set('authorization', `Bearer ${who.accessToken}`).set('user-agent', who.ua || UA.android);

// Lets a test pretend time has passed for the code limits on a number.
export const forgetShopCodes = (mobile) => prisma.phoneCode.deleteMany({ where: { mobile } });

export { api, prisma };
