// Website W1: the 30-day sign-in (web-01 section 8): renewal with rotation, the lost-reply
// grace, theft detection, sign out here / everywhere, and keys that can't cross sides.
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signedIn, authed, makeAccount, trustDevice, newDevice, signIn as adminSignIn } from '../../support/helpers.js';
import { signUp, signIn, refresh, cookieFrom, rawCookie, as, post, HEADER, SHOP, UA, api, prisma } from '../../support/shop.js';

const me = (who) => as(who)('get', '/me');

describe('renewing the short key', () => {
  it('the cookie gives a new short key and a new cookie; the old cookie is replaced', async () => {
    const who = await signUp();
    const r = await refresh(who.cookie);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'signed_in', accessTokenExpiresIn: 900, customer: { id: who.customer.id } });
    const next = cookieFrom(r);
    expect(next).toBeTruthy();
    expect(next).not.toBe(who.cookie);
    expect((await me({ ...who, accessToken: r.body.accessToken })).status).toBe(200);
    const rows = await prisma.session.findMany({ where: { authAccountId: who.customer.id }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ revokeReason: 'rotated' });
    expect(rows[1]).toMatchObject({ parentId: rows[0].id, revokedAt: null, kind: 'customer' });
    expect(rows[1].startedAt.getTime()).toBe(rows[0].startedAt.getTime());
    expect(rows[1].expiresAt.getTime() - Date.now()).toBeGreaterThan(29.9 * 86400_000);
  });

  it('no cookie: "not signed in" (a visitor), and the cookie is cleared', async () => {
    const r = await refresh(null);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('NOT_SIGNED_IN');
    expect(rawCookie(r)).toMatch(/nh_shop_session=;/);
  });

  it('needs the website\'s own header and an allowed origin (no cross-site renewals)', async () => {
    const who = await signUp();
    const noHeader = await refresh(who.cookie, { headers: {} });
    expect(noHeader.status).toBe(403);
    expect(noHeader.body.error.code).toBe('CLIENT_HEADER_MISSING');
    const evil = await refresh(who.cookie, { headers: { ...HEADER, origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect((await refresh(who.cookie, { headers: { ...HEADER, origin: 'http://shop.test' } })).status).toBe(200);
  });

  it('a renewal repeated within 10 seconds (lost reply) still works and nobody is signed out', async () => {
    const who = await signUp();
    const first = await refresh(who.cookie);
    const again = await refresh(who.cookie); // the browser never got `first`'s cookie
    expect(again.status).toBe(200);
    expect((await me({ ...who, accessToken: again.body.accessToken })).status).toBe(200);
    // The successor the browser never received is replaced, and quietly asks for a renewal.
    const lost = await me({ ...who, accessToken: first.body.accessToken });
    expect(lost.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
    expect((await refresh(cookieFrom(again))).status).toBe(200);
    // Presenting the replaced successor later only ends that one sign-in.
    const replaced = await refresh(cookieFrom(first));
    expect(replaced.status).toBe(401);
    expect(replaced.body.error.code).toBe('SESSION_INVALID');
    expect(await prisma.session.count({ where: { authAccountId: who.customer.id, isCompromised: true } })).toBe(0);
  });

  it('two tabs renewing at the same moment both succeed', async () => {
    const who = await signUp();
    const [x, y] = await Promise.all([refresh(who.cookie), refresh(who.cookie)]);
    expect([x.status, y.status]).toEqual([200, 200]);
  });

  it('an old cookie used again after 10 seconds: signed out everywhere for safety', async () => {
    const who = await signUp();
    const other = await signIn(who.mobile);
    const r1 = await refresh(who.cookie);
    await prisma.session.updateMany({ where: { authAccountId: who.customer.id, revokeReason: 'rotated' }, data: { revokedAt: new Date(Date.now() - 11_000) } });
    const stolen = await refresh(who.cookie);
    expect(stolen.status).toBe(401);
    expect(stolen.body.error).toMatchObject({ code: 'SIGNED_OUT_FOR_SAFETY' });
    expect((await refresh(cookieFrom(r1))).body.error.code).toBe('SIGNED_OUT_FOR_SAFETY');
    expect((await me(other)).body.error.code).toBe('SIGNED_OUT_FOR_SAFETY');
    expect(await prisma.authEvent.count({ where: { authAccountId: who.customer.id, eventType: 'shop_refresh_reuse_detected' } })).toBe(1);
  });

  it('a sign-in unused for 30 days has ended', async () => {
    const who = await signUp();
    await prisma.session.updateMany({ where: { authAccountId: who.customer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await refresh(who.cookie);
    expect(r.body.error).toMatchObject({ code: 'SESSION_EXPIRED', message: 'You were signed out after 30 days without a visit. Please sign in again.' });
    expect((await me(who)).body.error.code).toBe('SESSION_EXPIRED');
  });

  it('a made-up cookie is refused', async () => {
    const r = await refresh('nh_shop_session=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG');
    expect(r.body.error.code).toBe('SESSION_INVALID');
  });
});

describe('signing out', () => {
  it('"Sign out" ends this browser only and clears the cookie', async () => {
    const who = await signUp();
    const other = await signIn(who.mobile);
    const r = await api().post(`${SHOP}/auth/logout`).set(HEADER).set('cookie', who.cookie).send({});
    expect(r.status).toBe(204);
    expect(rawCookie(r)).toMatch(/nh_shop_session=;/);
    expect((await me(who)).body.error.code).toBe('SIGNED_OUT');
    expect((await refresh(who.cookie)).body.error.code).toBe('SIGNED_OUT');
    expect((await me(other)).status).toBe(200);
  });

  it('"Sign out" with nothing to end still succeeds', async () => {
    expect((await api().post(`${SHOP}/auth/logout`).set(HEADER).send({})).status).toBe(204);
  });

  it('"Sign out of all devices" ends every website sign-in at once', async () => {
    const who = await signUp();
    const other = await signIn(who.mobile);
    const r = await as(who)('post', '/auth/logout-all');
    expect(r.status).toBe(204);
    expect((await me(who)).body.error.code).toBe('SIGNED_OUT_EVERYWHERE');
    expect((await me(other)).body.error.code).toBe('SIGNED_OUT_EVERYWHERE');
    expect((await refresh(other.cookie)).body.error.code).toBe('SIGNED_OUT_EVERYWHERE');
  });

  it('signed-in devices: listed, this one first; another one can be signed out', async () => {
    const who = await signUp({ ua: UA.android });
    const mac = await signIn(who.mobile, { ua: UA.mac });
    const list = await as(who)('get', '/me/sessions');
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(2);
    expect(list.body.sessions[0]).toMatchObject({ isCurrent: true, label: 'Chrome on Android', device: 'mobile' });
    expect(list.body.sessions[1]).toMatchObject({ isCurrent: false, label: 'Chrome on Mac', device: 'desktop' });
    const self = await as(who)('delete', `/me/sessions/${list.body.sessions[0].id}`);
    expect(self.body.error.code).toBe('USE_SIGN_OUT');
    // The Mac renewed its key since the list was loaded: the old id still finds it.
    await refresh(mac.cookie, { ua: UA.mac });
    const out = await as(who)('delete', `/me/sessions/${list.body.sessions[1].id}`);
    expect(out.status).toBe(200);
    expect(out.body.sessions).toHaveLength(1);
    expect((await me(mac)).body.error.code).toMatch(/SIGNED_OUT_REMOTELY|ACCESS_TOKEN_EXPIRED/);
    expect((await as(who)('delete', `/me/sessions/${list.body.sessions[1].id}`)).body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('at most 20 browsers: the 21st sign-in ends the oldest', async () => {
    const who = await signUp();
    const rows = Array.from({ length: 20 }, (_, i) => ({
      authAccountId: who.customer.id, refreshTokenHash: `test-${who.customer.id}-${i}`, kind: 'customer', platform: 'web',
      expiresAt: new Date(Date.now() + 86400_000), createdAt: new Date(Date.now() - (30 - i) * 60_000),
    }));
    await prisma.session.createMany({ data: rows });
    await signIn(who.mobile);
    expect(await prisma.session.count({ where: { authAccountId: who.customer.id, kind: 'customer', revokedAt: null } })).toBe(20);
    expect(await prisma.session.count({ where: { authAccountId: who.customer.id, revokeReason: 'too_many_sessions' } })).toBe(2);
  });
});

describe('the website and the admin app stay apart', () => {
  it('an admin-app key is refused on the website', async () => {
    const { session } = await signedIn({ role: 'ADMIN' });
    const r = await api().get(`${SHOP}/me`).set('authorization', `Bearer ${session.accessToken}`);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('SESSION_INVALID');
  });

  it('a website key is refused by the admin app', async () => {
    const who = await signUp();
    const r = await api().get('/api/v2/me').set('authorization', `Bearer ${who.accessToken}`);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('SESSION_INVALID');
  });

  it('a website key signed with the admin secret is refused', async () => {
    const who = await signUp();
    const p = jwt.decode(who.accessToken);
    const forged = jwt.sign({ typ: 'access', sid: p.sid }, process.env.JWT_ACCESS_SECRET, { subject: p.sub, audience: 'shop', issuer: 'nandam-api-v2', expiresIn: 600 });
    expect((await api().get(`${SHOP}/me`).set('authorization', `Bearer ${forged}`)).body.error.code).toBe('SESSION_INVALID');
  });

  it('the website\'s cookie value is refused by the admin app\'s renewal, without any sign-out', async () => {
    const who = await signUp();
    const value = who.cookie.split('=')[1];
    const r = await api().post('/api/v2/auth/refresh').set('x-device-id', 'device-12345').send({ refreshToken: value });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('SESSION_INVALID');
    expect(await prisma.session.count({ where: { authAccountId: who.customer.id, OR: [{ isCompromised: true }, { revokedAt: { not: null } }] } })).toBe(0);
    expect((await me(who)).status).toBe(200);
  });

  it('a staff member signed in on both: website sign-out everywhere leaves the admin app signed in, and the reverse', async () => {
    const account = await makeAccount({ role: 'STAFF' });
    const device = newDevice();
    await trustDevice(account, device);
    const admin = await adminSignIn(account, device);
    const c = await post('/auth/code', { mobile: account.mobile });
    const v = await post('/auth/verify', { mobile: account.mobile, code: c.body.devCode });
    const done = await post('/auth/complete', { stepToken: v.body.stepToken, fullName: 'Test Person', email: `staff.${account.id}@example.com`, pincode: '500001' });
    const shopper = { accessToken: done.body.accessToken, cookie: cookieFrom(done) };

    expect((await as(shopper)('post', '/auth/logout-all')).status).toBe(204);
    expect((await authed('get', '/api/v2/me', admin, device)).status).toBe(200);

    const again = await (async () => {
      await prisma.phoneCode.deleteMany({ where: { mobile: account.mobile } });
      const c2 = await post('/auth/code', { mobile: account.mobile });
      const v2 = await post('/auth/verify', { mobile: account.mobile, code: c2.body.devCode });
      return { accessToken: v2.body.accessToken };
    })();
    // The owner removes this person's staff access: the admin app ends, the website does not.
    const { revokeWhere } = await import('../../../src/models/session.model.js');
    await revokeWhere({ authAccountId: account.id }, 'access_removed');
    expect((await authed('get', '/api/v2/me', admin, device)).status).toBe(401);
    expect((await me(again)).status).toBe(200);
  });
});

describe('every request checks the account', () => {
  it('no key: "please sign in"; an expired key: renew quietly', async () => {
    expect((await api().get(`${SHOP}/me`)).body.error.code).toBe('NOT_SIGNED_IN');
    const who = await signUp();
    const p = jwt.decode(who.accessToken);
    const old = jwt.sign({ typ: 'access', sid: p.sid }, process.env.JWT_SHOP_ACCESS_SECRET, { subject: p.sub, audience: 'shop', issuer: 'nandam-api-v2', expiresIn: -10 });
    expect((await api().get(`${SHOP}/me`).set('authorization', `Bearer ${old}`)).body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });

  it('a closed account is signed out on its next click', async () => {
    const who = await signUp();
    await prisma.authAccount.update({ where: { id: who.customer.id }, data: { deletedAt: new Date(), status: 'deleted' } });
    expect((await me(who)).body.error.code).toBe('ACCOUNT_DELETED');
    expect((await refresh(who.cookie)).body.error.code).toBe('ACCOUNT_DELETED');
  });

  it('"last seen" is written when the customer comes back', async () => {
    const who = await signUp();
    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { lastSeenAt: new Date(Date.now() - 3600_000) } });
    await me(who);
    await new Promise((r) => { setTimeout(r, 100); });
    const p = await prisma.userProfile.findUnique({ where: { authAccountId: who.customer.id } });
    expect(Date.now() - p.lastSeenAt.getTime()).toBeLessThan(10_000);
  });
});
