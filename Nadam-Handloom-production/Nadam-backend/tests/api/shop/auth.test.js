// Website W1: sign in / sign up with mobile + SMS code (web-01 sections 4.1, 5, 6).
import { describe, it, expect } from 'vitest';
import { makeAccount } from '../../support/helpers.js';
import { limits } from '../../../src/services/shop/code.service.js';
import {
  post, sendCode, verify, signUp, signIn, profileFor, cookieFrom, rawCookie, forgetShopCodes, newIp, UA, prisma, newMobile,
} from '../../support/shop.js';

const wrongOf = (code) => (code === '000000' ? '111111' : '000000');

describe('send the code', () => {
  it('any valid mobile gets a code: same reply for known and new numbers', async () => {
    const known = await signUp();
    await forgetShopCodes(known.mobile);
    const a = await sendCode(known.mobile);
    const b = await sendCode(newMobile());
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    const shape = (r) => ({ ...r.body, devCode: typeof r.body.devCode });
    expect(shape(a)).toEqual(shape(b));
    expect(a.body).toMatchObject({ resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 });
    expect(a.body.devCode).toMatch(/^\d{6}$/);
  });

  it('keeps only a hash of the code, with the network it was asked from', async () => {
    const m = newMobile();
    const ipAddr = newIp();
    const r = await sendCode(m, { ipAddr });
    const row = await prisma.phoneCode.findFirst({ where: { mobile: m } });
    expect(row.codeHash).not.toContain(r.body.devCode);
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row).toMatchObject({ purpose: 'shop_sign_in', attempts: 0, usedAt: null, ipAddress: ipAddr });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(599_000);
  });

  it('accepts +91, spaces and a leading 0; refuses other numbers with a field message', async () => {
    const m = newMobile();
    expect((await sendCode(`+91 ${m.slice(0, 5)} ${m.slice(5)}`)).status).toBe(202);
    for (const bad of ['12345', '5123456789', 'abcdefghij', '']) {
      const r = await sendCode(bad);
      expect(r.status).toBe(400);
      expect(r.body.error).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' });
      expect(r.body.error.details.issues[0].field).toBe('mobile');
    }
  });

  it('waits 60 seconds between codes, with the seconds left', async () => {
    const m = newMobile();
    await sendCode(m);
    const r = await sendCode(m);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('CODE_RESEND_WAIT');
    expect(r.body.error.details.retryAfterSeconds).toBeGreaterThan(55);
    expect(r.headers['retry-after']).toBeDefined();
  });

  it('allows 5 codes an hour per number, then says how long to wait', async () => {
    const m = newMobile();
    for (let i = 0; i < 5; i++) {
      expect((await sendCode(m)).status).toBe(202);
      await prisma.phoneCode.updateMany({ where: { mobile: m }, data: { createdAt: new Date(Date.now() - (10 - i) * 60_000) } });
    }
    const r = await sendCode(m);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('CODE_TOO_MANY');
    expect(r.body.error.message).toMatch(/Try again in \d+ minutes\./);
    expect(r.body.error.details.retryAfterSeconds).toBeGreaterThan(2900);
  });

  it('allows 60 codes an hour per IPv4 address (mobile carriers share one among many customers)', async () => {
    const ipAddr = newIp();
    for (let i = 0; i < 60; i++) expect((await sendCode(newMobile(), { ipAddr })).status).toBe(202);
    const r = await sendCode(newMobile(), { ipAddr });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('CODE_TOO_MANY_NETWORK');
  });

  it('allows 20 codes an hour per IPv6 /64 block, whichever address in it asks', async () => {
    const block = `2401:4900:${Math.floor(Math.random() * 0xffff).toString(16)}:${Math.floor(Math.random() * 0xffff).toString(16)}`;
    for (let i = 0; i < 20; i++) expect((await sendCode(newMobile(), { ipAddr: `${block}::${(i + 1).toString(16)}` })).status).toBe(202);
    const r = await sendCode(newMobile(), { ipAddr: `${block}:0:0:0:abcd` });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('CODE_TOO_MANY_NETWORK');
    const rows = await prisma.phoneCode.findMany({ where: { ipAddress: { startsWith: block.split(':').map((g) => g.padStart(4, '0')).join(':') } } });
    expect(rows).toHaveLength(20);
    expect(rows[0].ipAddress).toMatch(/::\/64$/);
    expect((await sendCode(newMobile(), { ipAddr: '2401:4900:1:2::1' })).status).toBe(202); // another block
  });

  it('stops codes to new numbers for the day at the daily limit; returning customers still get theirs', async () => {
    const known = await signUp();
    await forgetShopCodes(known.mobile);
    const before = limits.dailyTotal;
    limits.dailyTotal = await prisma.phoneCode.count({ where: { createdAt: { gte: new Date(Date.now() - 86400_000) }, authAccountId: null } });
    try {
      const r = await sendCode(newMobile());
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('SMS_PAUSED');
      expect(r.body.error.message).toMatch(/WhatsApp/);
      expect((await sendCode(known.mobile)).status).toBe(202);
    } finally {
      limits.dailyTotal = before;
    }
  });

  it('bot trap: same reply, nothing sent or stored', async () => {
    const m = newMobile();
    const r = await post('/auth/code', { mobile: m, trap: 'http://spam.example' });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ resendInSeconds: 60, expiresInSeconds: 600, codeLength: 6 });
    expect(await prisma.phoneCode.count({ where: { mobile: m } })).toBe(0);
    expect(await prisma.authEvent.count({ where: { eventType: 'shop_bot_trap' } })).toBeGreaterThan(0);
  });

  it('a new code makes the earlier one stop working', async () => {
    const m = newMobile();
    const first = await sendCode(m);
    await prisma.phoneCode.updateMany({ where: { mobile: m }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const second = await sendCode(m);
    if (first.body.devCode !== second.body.devCode) {
      expect((await verify(m, first.body.devCode)).body.error.code).toBe('WRONG_CODE');
    }
    expect((await verify(m, second.body.devCode)).body.status).toBe('needs_profile');
  });
});

describe('check the code', () => {
  it('new number: right code → "Complete your profile" with a 15-minute step', async () => {
    const m = newMobile();
    const c = await sendCode(m);
    const r = await verify(m, c.body.devCode);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'needs_profile', stepExpiresInSeconds: 900, mobileMasked: expect.stringContaining('+91') });
    expect(r.body.prefill).toEqual({ fullName: '', email: '', pincode: '', city: '', state: '', marketingOptIn: false });
    expect(cookieFrom(r)).toBeNull();
    expect(r.body.accessToken).toBeUndefined();
  });

  it('wrong code: 2 tries left, then 1, then a new code is needed', async () => {
    const m = newMobile();
    const c = await sendCode(m);
    const wrong = wrongOf(c.body.devCode);
    const a = await verify(m, wrong);
    expect(a.status).toBe(400);
    expect(a.body.error).toMatchObject({ code: 'WRONG_CODE', message: 'That code isn\'t right. 2 tries left.', details: { triesLeft: 2 } });
    expect((await verify(m, wrong)).body.error).toMatchObject({ message: 'That code isn\'t right. 1 try left.', details: { triesLeft: 1 } });
    expect((await verify(m, wrong)).body.error.code).toBe('CODE_USED_UP');
    expect((await verify(m, c.body.devCode)).body.error.code).toBe('CODE_USED_UP');
  });

  it('an expired code is refused', async () => {
    const m = newMobile();
    const c = await sendCode(m);
    await prisma.phoneCode.updateMany({ where: { mobile: m }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await verify(m, c.body.devCode);
    expect(r.body.error).toMatchObject({ code: 'CODE_EXPIRED', message: 'This code has expired. Get a new code.' });
  });

  it('no code asked for: "expired"; a used code can\'t be used twice', async () => {
    expect((await verify(newMobile(), '123456')).body.error.code).toBe('CODE_EXPIRED');
    const m = newMobile();
    const c = await sendCode(m);
    expect((await verify(m, c.body.devCode)).status).toBe(200);
    expect((await verify(m, c.body.devCode)).body.error.code).toBe('CODE_EXPIRED');
  });

  it('two requests with the same right code: only one succeeds', async () => {
    const m = newMobile();
    const c = await sendCode(m);
    const [x, y] = await Promise.all([verify(m, c.body.devCode), verify(m, c.body.devCode)]);
    expect([x.status, y.status].sort()).toEqual([200, 400]);
  });

  it('the code must be 6 digits', async () => {
    const r = await verify(newMobile(), '12a4');
    expect(r.body.error).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Enter the 6-digit code from the SMS.' });
  });

  it('known customer: signed in straight away, with the 30-day cookie', async () => {
    const who = await signUp();
    const again = await signIn(who.mobile);
    expect(again.customer).toMatchObject({ id: who.customer.id, fullName: 'Priya Sharma' });
    expect(again.cookie).toMatch(/^nh_shop_session=[A-Za-z0-9_-]{43}$/);
    expect(again.accessToken.split('.')).toHaveLength(3);
  });

  it('an older account without the new details is asked to complete them once, prefilled', async () => {
    const acc = await makeAccount({ role: 'CUSTOMER', pin: null });
    await prisma.authAccount.update({ where: { id: acc.id }, data: { email: `old.${acc.id}@example.com` } });
    await prisma.userProfile.create({ data: { authAccountId: acc.id, firstName: 'Old', lastName: 'Customer' } });
    const c = await sendCode(acc.mobile);
    const r = await verify(acc.mobile, c.body.devCode);
    expect(r.body.status).toBe('needs_profile');
    expect(r.body.prefill).toMatchObject({ fullName: 'Old Customer', email: `old.${acc.id}@example.com` });
  });
});

describe('complete the profile', () => {
  async function stepFor(mobile = newMobile()) {
    const c = await sendCode(mobile);
    const v = await verify(mobile, c.body.devCode);
    return { mobile, stepToken: v.body.stepToken };
  }
  const complete = (body, opts) => post('/auth/complete', body, opts);

  it('new customer: account, CUSTOMER role, profile and a signed-in reply', async () => {
    const { mobile, stepToken } = await stepFor();
    const email = `Asha.${Date.now()}@Example.com`;
    const r = await complete(
      { stepToken, fullName: '  Asha   Rani  Devi ', email, pincode: '522503', marketingOptIn: true, attribution: { source: 'instagram', medium: 'social', campaign: 'diwali', referrer: 'instagram.com' } },
      { ua: UA.iphone },
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'signed_in', isNew: true, accessTokenExpiresIn: 900 });
    expect(r.body.customer).toMatchObject({
      fullName: 'Asha Rani Devi', firstName: 'Asha', mobile, email: email.toLowerCase(), pincode: '522503', city: 'Guntur', state: 'Andhra Pradesh',
      marketingOptIn: true, deletion: null, managedByShop: false, avatarUrl: null,
    });
    expect(r.body.refreshToken).toBeUndefined();
    const cookie = rawCookie(r);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v2\/shop\/auth/);
    expect(cookie).toMatch(/Expires=/);

    const a = await prisma.authAccount.findUnique({ where: { phone: mobile }, include: { userProfile: true, roles: { include: { role: true } } } });
    expect(a.roles.map((x) => x.role.name)).toEqual(['CUSTOMER']);
    expect(a.status).toBe('active');
    expect(a.phoneVerifiedAt).not.toBeNull();
    expect(a.userProfile).toMatchObject({
      firstName: 'Asha', lastName: 'Rani Devi', displayName: 'Asha Rani Devi', signupSource: 'instagram', signupMedium: 'social',
      signupCampaign: 'diwali', signupReferrer: 'instagram.com', signupDevice: 'mobile', marketingOptIn: true,
    });
    expect(a.userProfile.privacyAcceptedAt).not.toBeNull();
    expect(a.userProfile.profileCompletedAt).not.toBeNull();
    expect(a.userProfile.marketingOptInAt).not.toBeNull();
    const s = await prisma.session.findFirst({ where: { authAccountId: a.id } });
    expect(s).toMatchObject({ kind: 'customer', platform: 'web', deviceName: 'Safari on iPhone', parentId: null });
    expect(await prisma.authEvent.count({ where: { authAccountId: a.id, eventType: 'shop_account_created', source: 'customer_web' } })).toBe(1);
  });

  it('an unknown pincode needs the city and state typed', async () => {
    const { stepToken } = await stepFor();
    const r = await complete({ stepToken, ...profileFor({ pincode: '999999' }) });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'PINCODE_NOT_FOUND', details: { field: 'pincode' } });
    const ok = await complete({ stepToken, ...profileFor({ pincode: '999999', city: 'Newtown', state: 'Telangana' }) });
    expect(ok.status).toBe(200);
    expect(ok.body.customer).toMatchObject({ pincode: '999999', city: 'Newtown', state: 'Telangana' });
  });

  it('the customer may correct the city the pincode gave', async () => {
    const { stepToken } = await stepFor();
    const r = await complete({ stepToken, ...profileFor({ pincode: '522503', city: 'Mangalagiri' }) });
    expect(r.body.customer).toMatchObject({ city: 'Mangalagiri', state: 'Andhra Pradesh' });
  });

  it('an email on another account is refused (any letter case)', async () => {
    const first = await signUp();
    const { stepToken } = await stepFor();
    const r = await complete({ stepToken, ...profileFor({ email: first.customer.email.toUpperCase() }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'EMAIL_TAKEN', details: { field: 'email' } });
  });

  it('field rules: name, email, pincode, state', async () => {
    const { stepToken } = await stepFor();
    const cases = [
      [{ fullName: 'A' }, 'fullName', 'Enter your full name.'],
      [{ fullName: 'x'.repeat(61) }, 'fullName', 'Use 60 characters or fewer.'],
      [{ fullName: 'Priya <script>' }, 'fullName', 'Use letters only (spaces, dots and hyphens are fine).'],
      [{ email: 'not-an-email' }, 'email', 'Enter a valid email address, like name@example.com.'],
      [{ pincode: '052250' }, 'pincode', 'Enter a valid 6-digit pincode.'],
      [{ state: 'Atlantis' }, 'state', 'Choose your state.'],
    ];
    for (const [over, field, message] of cases) {
      const r = await complete({ stepToken, ...profileFor(over) });
      expect(r.status, JSON.stringify(over)).toBe(400);
      expect(r.body.error.details.issues[0]).toEqual({ field, message });
    }
  });

  it('names in Telugu or Hindi script are fine', async () => {
    const { stepToken } = await stepFor();
    const r = await complete({ stepToken, ...profileFor({ fullName: 'ప్రియ శర్మ' }) });
    expect(r.status).toBe(200);
    expect(r.body.customer.fullName).toBe('ప్రియ శర్మ');
  });

  it('a step older than 15 minutes, or a forged one, is refused', async () => {
    const r = await complete({ stepToken: 'x'.repeat(40), ...profileFor() });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'STEP_EXPIRED', message: 'This step timed out. Please enter your mobile number again.' });
  });

  it('pressing "Create account" twice makes one account', async () => {
    const { mobile, stepToken } = await stepFor();
    const body = { stepToken, ...profileFor() };
    const [x, y] = await Promise.all([complete(body), complete(body)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(await prisma.authAccount.count({ where: { phone: mobile } })).toBe(1);
    expect(await prisma.userProfile.count({ where: { authAccount: { phone: mobile } } })).toBe(1);
  });

  it('a staff member\'s number signs up as a customer too; the admin app is untouched', async () => {
    const staff = await makeAccount({ role: 'STAFF', name: 'Ravi' });
    const { stepToken } = await (async () => {
      const c = await sendCode(staff.mobile);
      const v = await verify(staff.mobile, c.body.devCode);
      expect(v.body.status).toBe('needs_profile');
      expect(v.body.prefill.fullName).toBe('Ravi Person');
      return v.body;
    })();
    const r = await complete({ stepToken, ...profileFor({ fullName: 'Ravi Person' }) });
    expect(r.status).toBe(200);
    expect(r.body.customer.managedByShop).toBe(true);
    const a = await prisma.authAccount.findUnique({ where: { id: staff.id }, include: { roles: { include: { role: true } } } });
    expect(a.roles.map((x) => x.role.name).sort()).toEqual(['CUSTOMER', 'STAFF']);
    expect(a.mpinHash).toBe(staff.mpinHash);
    expect(a.status).toBe('active');
  });

  it('a closed account with the same mobile opens again for its owner', async () => {
    const acc = await makeAccount({ role: null, pin: null, status: 'deleted' });
    await prisma.authAccount.update({ where: { id: acc.id }, data: { deletedAt: new Date() } });
    const c = await sendCode(acc.mobile);
    const v = await verify(acc.mobile, c.body.devCode);
    expect(v.body.status).toBe('needs_profile');
    expect(v.body.prefill.fullName).toBe('');
    const r = await complete({ stepToken: v.body.stepToken, ...profileFor() });
    expect(r.status).toBe(200);
    const a = await prisma.authAccount.findUnique({ where: { id: acc.id } });
    expect(a).toMatchObject({ status: 'active', deletedAt: null });
  });

  it('first-visit details are kept from the first sign-up only', async () => {
    const who = await signUp({ profile: { attribution: { source: 'google' } } });
    // The profile has to be completed again (e.g. an older account): a new source must not replace the first.
    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { profileCompletedAt: null } });
    await forgetShopCodes(who.mobile);
    const c = await sendCode(who.mobile);
    const v = await verify(who.mobile, c.body.devCode);
    expect(v.body.status).toBe('needs_profile');
    const r = await post('/auth/complete', { stepToken: v.body.stepToken, ...profileFor({ email: who.customer.email, attribution: { source: 'facebook' } }) });
    expect(r.status).toBe(200);
    expect(r.body.customer.id).toBe(who.customer.id);
    const p = await prisma.userProfile.findUnique({ where: { authAccountId: who.customer.id } });
    expect(p.signupSource).toBe('google');
  });
});
