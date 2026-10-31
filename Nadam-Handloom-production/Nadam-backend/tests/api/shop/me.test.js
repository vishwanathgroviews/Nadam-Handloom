// Website W1: My account → profile, profile picture, change of mobile (web-01 section 4.3).
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { makeAccount } from '../../support/helpers.js';
import { signUp, as, post, cookieFrom, forgetShopCodes, newMobile, prisma } from '../../support/shop.js';

const photo = (w = 1200, h = 800, format = 'jpeg') =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#7a1f3d' } })
    .withExif({ IFD0: { Copyright: 'Test', Artist: 'Camera owner' } })
    [format]()
    .toBuffer();

describe('profile', () => {
  it('shows the customer\'s own details', async () => {
    const who = await signUp();
    const r = await as(who)('get', '/me');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.customer).toMatchObject({
      id: who.customer.id, fullName: 'Priya Sharma', mobile: who.mobile, pincode: '522503', city: 'Guntur', state: 'Andhra Pradesh',
      dateOfBirth: null, anniversary: null, language: null, marketingOptIn: false, deletion: null, managedByShop: false,
    });
    expect(Object.keys(r.body.customer)).not.toContain('mpinHash');
  });

  it('changes only the fields sent, and says which changed', async () => {
    const who = await signUp();
    const r = await as(who)('patch', '/me').send({ fullName: 'Priya  S Rao', dateOfBirth: '1990-04-15', anniversary: '2015-11-20', language: 'te', marketingOptIn: true });
    expect(r.status).toBe(200);
    expect(r.body.changed.sort()).toEqual(['anniversary', 'dateOfBirth', 'fullName', 'language', 'marketingOptIn']);
    expect(r.body.customer).toMatchObject({ fullName: 'Priya S Rao', firstName: 'Priya', dateOfBirth: '1990-04-15', anniversary: '2015-11-20', language: 'te', marketingOptIn: true, city: 'Guntur' });
    const p = await prisma.userProfile.findUnique({ where: { authAccountId: who.customer.id } });
    expect(p).toMatchObject({ firstName: 'Priya', lastName: 'S Rao' });
    expect(p.marketingOptInAt).not.toBeNull();
    const clear = await as(who)('patch', '/me').send({ dateOfBirth: null, language: null });
    expect(clear.body.customer).toMatchObject({ dateOfBirth: null, language: null });
    const same = await as(who)('patch', '/me').send({ fullName: 'Priya S Rao' });
    expect(same.body.changed).toEqual([]);
  });

  it('a new pincode brings its city and state; typed ones win', async () => {
    const who = await signUp();
    const a = await as(who)('patch', '/me').send({ pincode: '500001' });
    expect(a.body.customer).toMatchObject({ pincode: '500001', city: 'Hyderabad', state: 'Telangana' });
    const b = await as(who)('patch', '/me').send({ city: 'Secunderabad' });
    expect(b.body.customer).toMatchObject({ pincode: '500001', city: 'Secunderabad', state: 'Telangana' });
    const c = await as(who)('patch', '/me').send({ pincode: '999998' });
    expect(c.body.error.code).toBe('PINCODE_NOT_FOUND');
    const d = await as(who)('patch', '/me').send({ pincode: '999998', city: 'Camp', state: 'Punjab' });
    expect(d.body.customer).toMatchObject({ pincode: '999998', city: 'Camp', state: 'Punjab' });
  });

  it('refuses a wrong date of birth, a future anniversary, an unknown language and unknown fields', async () => {
    const who = await signUp();
    const thisYear = new Date().getUTCFullYear();
    const cases = [
      [{ dateOfBirth: `${thisYear - 5}-01-01` }, 'dateOfBirth'],
      [{ dateOfBirth: '1990-02-30' }, 'dateOfBirth'],
      [{ dateOfBirth: '1800-01-01' }, 'dateOfBirth'],
      [{ anniversary: `${thisYear + 1}-01-01` }, 'anniversary'],
      [{ language: 'fr' }, 'language'],
      [{ mobile: '9999999999' }, ''],
      [{}, ''],
    ];
    for (const [body, field] of cases) {
      const r = await as(who)('patch', '/me').send(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_FAILED');
      expect(r.body.error.details.issues[0].field).toBe(field);
    }
  });

  it('an email already on another account is refused', async () => {
    const a = await signUp();
    const b = await signUp();
    const r = await as(b)('patch', '/me').send({ email: a.customer.email });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'EMAIL_TAKEN', details: { field: 'email' } });
    const own = await as(b)('patch', '/me').send({ email: b.customer.email.toUpperCase() });
    expect(own.status).toBe(200);
    expect(own.body.changed).toEqual([]);
  });

  it('profile changes are recorded without the details themselves', async () => {
    const who = await signUp();
    await as(who)('patch', '/me').send({ language: 'hi' });
    const e = await prisma.authEvent.findFirst({ where: { authAccountId: who.customer.id, eventType: 'shop_profile_updated' } });
    expect(e.source).toBe('customer_web');
    expect(e.metadata.fields).toEqual(['language']);
    expect(JSON.stringify(e.metadata)).not.toContain('hi"');
  });
});

describe('profile picture', () => {
  it('stored as a 256 × 256 JPEG without camera or location details; replaced cleanly', async () => {
    const who = await signUp();
    const r = await as(who)('post', '/me/avatar').attach('photo', await photo(), { filename: 'me.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(200);
    expect(r.body.customer.avatarUrl).toMatch(/^http:\/\/test\.local:4100\/uploads\/avatars\/[0-9a-f-]+\.jpg$/);
    const p1 = await prisma.userProfile.findUnique({ where: { authAccountId: who.customer.id } });
    const fs = await import('node:fs/promises');
    const file = await fs.readFile(`tmp/test-uploads/${p1.avatarKey}`);
    const meta = await sharp(file).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 256, height: 256 });
    expect(meta.exif).toBeUndefined();

    const r2 = await as(who)('post', '/me/avatar').attach('photo', await photo(400, 900, 'png'), { filename: 'me.png', contentType: 'image/png' });
    expect(r2.status).toBe(200);
    await expect(fs.readFile(`tmp/test-uploads/${p1.avatarKey}`)).rejects.toThrow();

    const del = await as(who)('delete', '/me/avatar');
    expect(del.body.customer.avatarUrl).toBeNull();
  });

  it('refuses other files, damaged pictures, too-large ones and an empty form', async () => {
    const who = await signUp();
    const pdf = await as(who)('post', '/me/avatar').attach('photo', Buffer.from('%PDF-1.4 test'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(pdf.body.error.code).toBe('PHOTO_TYPE');
    const broken = await as(who)('post', '/me/avatar').attach('photo', Buffer.from('not really a jpeg'), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(broken.body.error.code).toBe('PHOTO_UNREADABLE');
    const big = await as(who)('post', '/me/avatar').attach('photo', Buffer.alloc(5 * 1024 * 1024 + 10, 1), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(big.body.error).toMatchObject({ code: 'PHOTO_TOO_LARGE', message: 'The photo is larger than 5 MB. Please choose a smaller one.' });
    const none = await as(who)('post', '/me/avatar').field('x', '1');
    expect(none.body.error.code).toBe('PHOTO_MISSING');
  });
});

describe('change of mobile', () => {
  it('a code goes to the new number; after it, that number signs in', async () => {
    const who = await signUp();
    const to = newMobile();
    const c = await as(who)('post', '/me/mobile/code').send({ mobile: to });
    expect(c.status).toBe(202);
    expect(c.body).toMatchObject({ resendInSeconds: 60, mobileMasked: expect.stringContaining(to.slice(0, 5)) });
    const wrong = await as(who)('post', '/me/mobile/verify').send({ mobile: to, code: c.body.devCode === '000000' ? '111111' : '000000' });
    expect(wrong.body.error).toMatchObject({ code: 'WRONG_CODE', details: { triesLeft: 2 } });
    const ok = await as(who)('post', '/me/mobile/verify').send({ mobile: to, code: c.body.devCode });
    expect(ok.status).toBe(200);
    expect(ok.body.customer.mobile).toBe(to);
    expect((await as(who)('get', '/me')).body.customer.mobile).toBe(to);
    // The new number signs in to the same account; the old one is a new customer now.
    const c2 = await post('/auth/code', { mobile: to });
    const v2 = await post('/auth/verify', { mobile: to, code: c2.body.devCode });
    expect(v2.body.customer.id).toBe(who.customer.id);
    expect(cookieFrom(v2)).toBeTruthy();
  });

  it('refuses the same number, a number on another account, and a code asked for by someone else', async () => {
    const a = await signUp();
    const b = await signUp();
    expect((await as(a)('post', '/me/mobile/code').send({ mobile: a.mobile })).body.error.code).toBe('SAME_MOBILE');
    const taken = await as(a)('post', '/me/mobile/code').send({ mobile: b.mobile });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('MOBILE_TAKEN');
    // b asks for a code to a free number; a can't use it.
    const free = newMobile();
    const c = await as(b)('post', '/me/mobile/code').send({ mobile: free });
    const steal = await as(a)('post', '/me/mobile/verify').send({ mobile: free, code: c.body.devCode });
    expect(steal.body.error.code).toBe('CODE_EXPIRED');
    // A sign-in code for that number doesn't work for a change of mobile either.
    await forgetShopCodes(free);
    const s = await post('/auth/code', { mobile: free });
    expect((await as(a)('post', '/me/mobile/verify').send({ mobile: free, code: s.body.devCode })).body.error.code).toBe('CODE_EXPIRED');
  });

  it('owners and staff change their number in the admin app, not here', async () => {
    const staff = await makeAccount({ role: 'STAFF' });
    const c = await post('/auth/code', { mobile: staff.mobile });
    const v = await post('/auth/verify', { mobile: staff.mobile, code: c.body.devCode });
    const done = await post('/auth/complete', { stepToken: v.body.stepToken, fullName: 'Staff Person', email: `s.${staff.id}@example.com`, pincode: '522503' });
    const who = { accessToken: done.body.accessToken };
    const r = await as(who)('post', '/me/mobile/code').send({ mobile: newMobile() });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('MOBILE_MANAGED_BY_SHOP');
  });

  it('the same code limits apply (wait 60 seconds)', async () => {
    const who = await signUp();
    const to = newMobile();
    await as(who)('post', '/me/mobile/code').send({ mobile: to });
    expect((await as(who)('post', '/me/mobile/code').send({ mobile: to })).body.error.code).toBe('CODE_RESEND_WAIT');
  });
});
