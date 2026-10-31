// Website: the situations people rarely hit (the 16 Oct 2026 check, web-02 section 12).
// Requests sent at the same moment, lost replies, the SMS service failing, odd characters,
// huge pictures, a sign-out landing during a renewal, and the old server sharing the database.
import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { sha256 } from '../../../src/utils/crypto.js';
import { limits } from '../../../src/services/shop/code.service.js';
import { sms } from '../../../src/services/sms/index.js';
import { runCleanup } from '../../../src/jobs/cleanup.job.js';
import { rateLimit } from '../../../src/middlewares/rateLimit.js';
import { errorHandler } from '../../../src/middlewares/errorHandler.js';
import { unavailable } from '../../../src/utils/errors.js';
import { makeAccount } from '../../support/helpers.js';
import {
  post, sendCode, verify, signUp, signIn, profileFor, cookieFrom, refresh, as, newIp, newMobile, api, SHOP, HEADER, prisma,
} from '../../support/shop.js';

afterEach(() => vi.restoreAllMocks());

const DAY = 86400_000;
const wrongOf = (code) => (code === '000000' ? '111111' : '000000');
const codes = (replies) => replies.map((r) => r.body?.error?.code ?? r.status);
const activeSessions = (accountId) => prisma.session.count({ where: { authAccountId: accountId, kind: 'customer', revokedAt: null } });
const cookieValue = (cookie) => cookie.slice('nh_shop_session='.length);
// Lets a test send another code to the same number at once (the 60-second wait has passed).
const age = (mobile) => prisma.phoneCode.updateMany({ where: { mobile }, data: { createdAt: new Date(Date.now() - 61_000) } });

describe('SMS codes: requests at the same moment', () => {
  it('ten "Send code" taps at once for one number send one code', async () => {
    const m = newMobile();
    const ipAddr = newIp();
    const replies = await Promise.all(Array.from({ length: 10 }, () => sendCode(m, { ipAddr })));
    expect(replies.filter((r) => r.status === 202)).toHaveLength(1);
    expect(codes(replies.filter((r) => r.status !== 202)).every((c) => c === 'CODE_RESEND_WAIT')).toBe(true);
    expect(await prisma.phoneCode.count({ where: { mobile: m } })).toBe(1);
  });

  it('the daily limit for new numbers holds when many arrive at once', async () => {
    const before = limits.dailyTotal;
    limits.dailyTotal = (await prisma.phoneCode.count({ where: { createdAt: { gte: new Date(Date.now() - DAY) }, authAccountId: null } })) + 3;
    try {
      const replies = await Promise.all(Array.from({ length: 10 }, () => sendCode(newMobile(), { ipAddr: newIp() })));
      expect(replies.filter((r) => r.status === 202)).toHaveLength(3);
      expect(codes(replies.filter((r) => r.status !== 202)).every((c) => c === 'SMS_PAUSED')).toBe(true);
    } finally {
      limits.dailyTotal = before;
    }
  });

  it('guesses sent at the same moment share the 3 tries; the right code is refused after', async () => {
    const m = newMobile();
    const ipAddr = newIp();
    const c = await sendCode(m, { ipAddr });
    const replies = await Promise.all(Array.from({ length: 8 }, () => verify(m, wrongOf(c.body.devCode), { ipAddr })));
    expect(codes(replies).filter((x) => x === 'WRONG_CODE')).toHaveLength(2);
    expect((await prisma.phoneCode.findFirst({ where: { mobile: m } })).attempts).toBe(3);
    const right = await verify(m, c.body.devCode, { ipAddr });
    expect(right.status).toBe(400);
    expect(right.body.error.code).toBe('CODE_USED_UP');
  });

  it('the SMS service failing to send: nothing is counted and the earlier code still works', async () => {
    const m = newMobile();
    const ipAddr = newIp();
    const first = await sendCode(m, { ipAddr });
    await age(m);
    vi.spyOn(sms, 'send').mockRejectedValueOnce(unavailable('SMS_UNAVAILABLE', 'We couldn\'t send the code right now. Please try again in a minute.'));
    const failed = await sendCode(m, { ipAddr });
    expect(failed.status).toBe(503);
    expect(await prisma.phoneCode.count({ where: { mobile: m } })).toBe(1);
    const v = await verify(m, first.body.devCode, { ipAddr });
    expect(v.body.status).toBe('needs_profile');
  });

  it('the SMS service unable to check a code: that try isn\'t counted', async () => {
    const m = newMobile();
    const ipAddr = newIp();
    const c = await sendCode(m, { ipAddr });
    vi.spyOn(sms, 'verify').mockRejectedValueOnce(unavailable('SMS_UNAVAILABLE', 'We couldn\'t check the code right now. Please try again in a minute.'));
    expect((await verify(m, c.body.devCode, { ipAddr })).status).toBe(503);
    const wrong = await verify(m, wrongOf(c.body.devCode), { ipAddr });
    expect(wrong.body.error).toMatchObject({ code: 'WRONG_CODE', details: { triesLeft: 2 } });
    expect((await verify(m, c.body.devCode, { ipAddr })).body.status).toBe('needs_profile');
  });

  it('a code the SMS service says was checked already (a lost reply) closes: get a new code', async () => {
    const m = newMobile();
    const ipAddr = newIp();
    const c = await sendCode(m, { ipAddr });
    vi.spyOn(sms, 'verify').mockResolvedValueOnce({ ok: false, alreadyVerified: true });
    const r = await verify(m, c.body.devCode, { ipAddr });
    expect(r.body.error).toMatchObject({ code: 'CODE_ALREADY_USED', message: 'This code was already used. Get a new code.' });
    expect((await verify(m, c.body.devCode, { ipAddr })).body.error.code).toBe('CODE_EXPIRED');
  });
});

describe('odd characters', () => {
  it('a hidden NUL character in a search, a sign-up or an address never causes an error', async () => {
    const q = await api().get(`${SHOP}/products?q=%00red`);
    expect(q.status).toBe(200);

    const m = newMobile();
    const c = await sendCode(m);
    const v = await verify(m, c.body.devCode);
    const done = await post('/auth/complete', {
      stepToken: v.body.stepToken, ...profileFor({ fullName: 'Priya​ Sharma' }), attribution: { source: 'news\u0000letter', referrer: 'https://x.example/\u0000' },
    });
    expect(done.status).toBe(200);
    const p = await prisma.userProfile.findUnique({ where: { authAccountId: done.body.customer.id } });
    expect(p).toMatchObject({ firstName: 'Priya', lastName: 'Sharma', signupSource: 'news letter' });

    const who = { accessToken: done.body.accessToken };
    const a = await as(who)('post', '/me/addresses').send({ fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat\u00004B, Residency', landmark: '﻿Near temple', pincode: '500034' });
    expect(a.status).toBe(201);
    const row = await prisma.address.findFirst({ where: { authAccountId: done.body.customer.id } });
    expect(row).toMatchObject({ line1: 'Flat 4B, Residency', landmark: 'Near temple' });
  });
});

describe('sign-ins: renewals and sign-outs crossing', () => {
  it('"Sign out of all devices" right after a renewal: the old cookie can\'t come back within the 10 seconds', async () => {
    const who = await signUp();
    const r1 = await refresh(who.cookie);
    expect((await as({ ...who, accessToken: r1.body.accessToken })('post', '/auth/logout-all')).status).toBe(204);
    const back = await refresh(who.cookie);
    expect(back.status).toBe(401);
    expect(back.body.error.code).toBe('SIGNED_OUT_EVERYWHERE');
    expect(await activeSessions(who.customer.id)).toBe(0);
  });

  it('"Sign out" right after a renewal: the old cookie can\'t come back either', async () => {
    const who = await signUp();
    const r1 = await refresh(who.cookie);
    expect((await api().post(`${SHOP}/auth/logout`).set(HEADER).set('cookie', cookieFrom(r1)).send({})).status).toBe(204);
    const back = await refresh(who.cookie);
    expect(back.status).toBe(401);
    expect(back.body.error.code).toBe('SIGNED_OUT');
    expect(await activeSessions(who.customer.id)).toBe(0);
  });

  it('"Sign out of all devices" (from another browser) at the same moment as renewals: no sign-in survives', async () => {
    const who = await signUp();
    const other = await signIn(who.mobile); // its key isn't being renewed, so its request always counts
    const [, , out] = await Promise.all([refresh(who.cookie), refresh(who.cookie), as(other)('post', '/auth/logout-all'), refresh(who.cookie)]);
    expect(out.status).toBe(204);
    expect(await activeSessions(who.customer.id)).toBe(0);
  });

  it('the cookie is stored under the website\'s own hash: the old server\'s lookup (plain sha256) never finds it', async () => {
    const who = await signUp();
    const value = cookieValue(who.cookie);
    const row = await prisma.session.findFirst({ where: { authAccountId: who.customer.id, revokedAt: null } });
    expect(row.refreshTokenHash).toBe(sha256(`nandam-shop-session-v2:${value}`));
    expect(await prisma.session.count({ where: { refreshTokenHash: sha256(value) } })).toBe(0);
  });

  it('a sign-in stored before the change still renews, and moves to the new hash', async () => {
    const who = await signUp();
    const value = cookieValue(who.cookie);
    await prisma.session.updateMany({ where: { authAccountId: who.customer.id, revokedAt: null }, data: { refreshTokenHash: sha256(value) } });
    const r = await refresh(who.cookie);
    expect(r.status).toBe(200);
    const next = await prisma.session.findFirst({ where: { authAccountId: who.customer.id, revokedAt: null } });
    expect(next.refreshTokenHash).toBe(sha256(`nandam-shop-session-v2:${cookieValue(cookieFrom(r))}`));
  });
});

describe('the sign-up step', () => {
  it('can\'t be used again later to start more sign-ins or change the name and email', async () => {
    const m = newMobile();
    const c = await sendCode(m);
    const v = await verify(m, c.body.devCode);
    const done = await post('/auth/complete', { stepToken: v.body.stepToken, ...profileFor({ fullName: 'Priya Sharma' }) });
    expect(done.status).toBe(200);
    await prisma.userProfile.update({ where: { authAccountId: done.body.customer.id }, data: { privacyAcceptedAt: new Date(Date.now() - 120_000) } });
    const again = await post('/auth/complete', { stepToken: v.body.stepToken, ...profileFor({ fullName: 'Someone Else' }) });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('STEP_USED');
    expect(await activeSessions(done.body.customer.id)).toBe(1);
    expect((await prisma.userProfile.findUnique({ where: { authAccountId: done.body.customer.id } })).firstName).toBe('Priya');
  });

  it('a closed account that still has a staff role can\'t be opened from the website', async () => {
    const staff = await makeAccount({ role: 'STAFF', status: 'deleted' });
    await prisma.authAccount.update({ where: { id: staff.id }, data: { deletedAt: new Date() } });
    const c = await sendCode(staff.mobile);
    const v = await verify(staff.mobile, c.body.devCode);
    expect(v.status).toBe(403);
    expect(v.body.error).toMatchObject({ code: 'ACCOUNT_MANAGED_BY_SHOP', details: { help: 'whatsapp' } });
    expect((await prisma.authAccount.findUnique({ where: { id: staff.id } })).status).toBe('deleted');
  });

  it('an email already on another account: the message offers WhatsApp help', async () => {
    const first = await signUp();
    const m = newMobile();
    const c = await sendCode(m);
    const v = await verify(m, c.body.devCode);
    const r = await post('/auth/complete', { stepToken: v.body.stepToken, ...profileFor({ email: first.customer.email }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'EMAIL_TAKEN', details: { field: 'email', help: 'whatsapp' } });
    expect(r.body.error.message).toMatch(/WhatsApp/);
  });
});

describe('account deletion', () => {
  it('an order placed during the 7 days keeps the account until it is delivered', async () => {
    const who = await signUp();
    expect((await as(who)('post', '/me/delete-request').send({})).status).toBe(200);
    const order = await prisma.order.create({ data: { orderNumber: `TEST-W-${Date.now()}`, authAccountId: who.customer.id, subtotal: 100, total: 100, status: 'processing', shippingAddress: { fullName: 'Priya Sharma' } } });
    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { deleteRequestedAt: new Date(Date.now() - 8 * DAY) } });
    await runCleanup();
    expect((await prisma.authAccount.findUnique({ where: { id: who.customer.id } })).phone).toBe(who.mobile);
    const me = await as(who)('get', '/me');
    expect(me.body.customer.deletion).toMatchObject({ overdue: true });

    await prisma.order.update({ where: { id: order.id }, data: { status: 'delivered' } });
    await runCleanup();
    expect((await prisma.authAccount.findUnique({ where: { id: who.customer.id } })).status).toBe('deleted');
  });
});

describe('notifications', () => {
  it('turning on alerts while not signed in, on a browser linked to a customer, keeps that link', async () => {
    const who = await signUp();
    const t = `tok-${Date.now()}-linked-abcdefghijklmnopqrstuvwxyz`;
    await as(who)('post', '/push/subscribe').send({ token: t });
    const r = await api().post(`${SHOP}/push/subscribe`).send({ token: t, topics: ['arrivals'] });
    expect(r.status).toBe(200);
    expect(r.body.topics.sort()).toEqual(['arrivals', 'orders']);
    expect((await prisma.pushToken.findUnique({ where: { token: t } })).authAccountId).toBe(who.customer.id);
  });
});

describe('profile pictures', () => {
  it('a small file that is a huge picture is refused before it is opened', async () => {
    const who = await signUp();
    const huge = await sharp({ create: { width: 6000, height: 6000, channels: 3, background: '#7a1f3d' } }).png().toBuffer();
    expect(huge.length).toBeLessThan(5 * 1024 * 1024);
    const r = await as(who)('post', '/me/avatar').attach('photo', huge, { filename: 'me.png', contentType: 'image/png' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PHOTO_TOO_MANY_PIXELS');
  });

  it('a picture in another format, named as a JPEG, is refused', async () => {
    const who = await signUp();
    const gif = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#7a1f3d' } }).gif().toBuffer();
    const r = await as(who)('post', '/me/avatar').attach('photo', gif, { filename: 'me.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PHOTO_TYPE');
  });
});

describe('request limits', () => {
  it('requests sent at the same moment can\'t get past a per-network limit', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.get('/x', rateLimit({ name: `burst-${Date.now()}`, max: 5 }), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const replies = await Promise.all(Array.from({ length: 20 }, () => request(app).get('/x').set('x-forwarded-for', '10.9.9.9')));
    expect(replies.filter((r) => r.status === 200)).toHaveLength(5);
    const refused = replies.filter((r) => r.status === 429);
    expect(refused).toHaveLength(15);
    expect(Number(refused[0].headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(refused[0].headers['retry-after'])).toBeLessThanOrEqual(60);
  });
});
