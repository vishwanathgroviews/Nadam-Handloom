// Module 11 (Settings): the rules in plan sections 5, 6, 8 and 13.
// The shared settings row is put back as it was at the end, for the other test files.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, prisma, signedIn, authed, makeAccount, newDevice, trustDevice } from '../support/helpers.js';
import { shopDetails, shopDetailsAt, forgetCache } from '../../src/services/settings.service.js';
import { list as activity } from '../../src/services/activity.service.js';

const ST = '/api/v2/settings';
const uid = () => crypto.randomUUID().slice(0, 8);
let owner;
let staff;
let saved;
const O = (m, u) => authed(m, u, owner.session, owner.device);
const S = (m, u) => authed(m, u, staff.session, staff.device);
const onPhone = (req, version, platform = 'android') => req.set('X-App-Version', version).set('X-Platform', platform);

beforeAll(async () => {
  saved = await prisma.appConfig.findUnique({ where: { id: 'default' } });
  owner = await signedIn({ role: 'ADMIN', name: 'Lakshmi' });
  staff = await signedIn({ role: 'STAFF', name: 'Ravi' });
});
afterAll(async () => {
  const { id, updatedAt, ...rest } = saved || {};
  if (saved) await prisma.appConfig.update({ where: { id: 'default' }, data: rest });
  forgetCache();
});

describe('the start-up check and who can open Settings (6.1)', () => {
  it('Every phone reads maintenance and updates without signing in; only owners open Settings', async () => {
    const r = await api().get('/api/v2/app-status');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ maintenance: { staff: { on: false }, website: { on: false } }, updates: { android: { newest: expect.any(Number) }, ios: { oldest: expect.any(Number) } } });
    expect(r.body.updates.android.link).toMatch(/^https:\/\//);
    expect((await api().get(ST)).status).toBe(401);
    expect((await S('get', ST)).status).toBe(403);
    expect((await S('patch', `${ST}/maintenance`).send({ staff: { on: true } })).status).toBe(403);
    const o = await O('get', ST);
    expect(o.status).toBe(200);
    expect(o.body).toHaveProperty('maintenance.staff');
    expect(o.body).toHaveProperty('shop.gstin');
    expect(o.body.owners).toBeGreaterThanOrEqual(1);
    expect(o.body.server.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('maintenance (6.2, 6.3)', () => {
  it('Pausing the staff app stops staff on the server (owners keep working); resuming lets them back', async () => {
    const updatesBefore = (await O('get', ST)).body.updates.changed;
    const r = await O('patch', `${ST}/maintenance`).send({ staff: { on: true, message: '  Updating prices,   back at 6 pm ' } });
    expect(r.body.updates.changed).toEqual(updatesBefore); // only App updates moves its own "last changed"
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.maintenance.staff).toMatchObject({ on: true, message: 'Updating prices, back at 6 pm', by: 'Lakshmi Person' });
    expect(r.body.maintenance.staff.since).toMatch(/\d{4}, \d{1,2}:\d{2} (am|pm)$/);
    expect(r.body.maintenance.changed.by).toBe('Lakshmi Person');
    const blocked = await S('get', '/api/v2/home');
    expect(blocked.status).toBe(503);
    expect(blocked.body.error).toMatchObject({ code: 'MAINTENANCE', message: 'Updating prices, back at 6 pm' });
    expect((await S('get', '/api/v2/me')).status).toBe(200);
    expect((await O('get', '/api/v2/home')).status).toBe(200);
    expect((await O('get', '/api/v2/home')).body.attention.maintenance).toMatchObject({ by: 'Lakshmi Person', message: 'Updating prices, back at 6 pm' });
    expect((await api().get('/api/v2/app-status')).body.maintenance.staff).toEqual({ on: true, message: 'Updating prices, back at 6 pm' });
    const off = await O('patch', `${ST}/maintenance`).send({ staff: { on: false } });
    expect(off.body.maintenance.staff).toMatchObject({ on: false, since: null, by: null });
    expect((await S('get', '/api/v2/home')).status).toBe(200);
    expect((await O('get', '/api/v2/home')).body.attention.maintenance).toBeNull();
  });

  it('The website switch and its message; messages over 300 characters are refused; every change is logged', async () => {
    const r = await O('patch', `${ST}/maintenance`).send({ website: { on: true, message: 'Back soon' } });
    expect(r.body.maintenance.website).toMatchObject({ on: true, message: 'Back soon' });
    expect((await api().get('/api/v2/app-status')).body.maintenance.website.on).toBe(true);
    expect((await O('patch', `${ST}/maintenance`).send({ staff: { message: 'x'.repeat(301) } })).body.error.code).toBe('MESSAGE_TOO_LONG');
    await O('patch', `${ST}/maintenance`).send({ website: { on: false } });
    const log = await activity({ kind: 'settings', period: 'today' });
    const texts = log.entries.map((e) => e.text);
    expect(texts).toEqual(expect.arrayContaining([
      'Lakshmi Person paused the staff app: "Updating prices, back at 6 pm"',
      'Lakshmi Person resumed the staff app',
      'Lakshmi Person paused the website: "Back soon"',
      'Lakshmi Person opened the website again',
    ]));
    expect(log.entries.every((e) => e.kind === 'settings' && e.important)).toBe(true);
  });
});

describe('app updates (6.4)', () => {
  it('"Require this version" from a phone that has it; checks on the numbers and the link', async () => {
    const before = (await O('get', ST)).body.updates.android;
    const need = await O('patch', `${ST}/updates`).send({ platform: 'android', requireThisPhone: true });
    expect(need.body.error.code).toBe('NEEDS_THIS_PHONE');
    expect((await onPhone(O('patch', `${ST}/updates`), '2.0.0 (30)', 'ios').send({ platform: 'android', requireThisPhone: true })).body.error.code).toBe('NEEDS_THIS_PHONE');
    const r = await onPhone(O('patch', `${ST}/updates`), '2.0.0 (30)').send({ platform: 'android', requireThisPhone: true });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.updates.android).toMatchObject({ oldest: Math.max(30, before.oldest), newest: Math.max(30, before.newest) });
    expect(r.body.updates.thisPhone).toEqual({ platform: 'android', version: '2.0.0 (30)', build: 30 });
    expect(r.body.updates.changed.by).toBe('Lakshmi Person');
    expect((await api().get('/api/v2/app-status')).body.updates.android.oldest).toBe(Math.max(30, before.oldest));
    const tell = await onPhone(O('patch', `${ST}/updates`), '2.0.0 (31)').send({ platform: 'android', tellThisPhone: true });
    expect(tell.body.updates.android).toMatchObject({ newest: 31, oldest: Math.max(30, before.oldest) });
    expect((await O('patch', `${ST}/updates`).send({ platform: 'android', oldest: 99 })).body.error.code).toBe('OLDEST_ABOVE_NEWEST');
    expect((await O('patch', `${ST}/updates`).send({ platform: 'ios', link: 'http://x.y' })).body.error.code).toBe('BAD_LINK');
    // A version no iPhone has (a typo): refused, it would stop every phone. Up to 9 is fine
    // once an iPhone runs 9. (With no iPhone in use at all, nobody can be stopped.)
    const iphone = await makeAccount({ role: 'STAFF', name: 'Ravi' });
    await prisma.trustedDevice.create({ data: { authAccountId: iphone.id, deviceId: crypto.randomUUID(), name: 'iPhone 15', platform: 'ios', appVersion: '2.0.0 (9)', lastSeenAt: new Date() } });
    const typo = await O('patch', `${ST}/updates`).send({ platform: 'ios', newest: 900, oldest: 900 });
    expect(typo.body.error).toMatchObject({ code: 'NO_PHONE_HAS_IT' });
    expect(typo.body.error.message).toMatch(/No iPhone has version 900 yet/);
    const ok = await O('patch', `${ST}/updates`).send({ platform: 'ios', newest: 9, oldest: 7, required: true, link: 'https://testflight.apple.com/join/abc' });
    expect(ok.body.updates.ios).toEqual({ newest: 9, oldest: 7, required: true, link: 'https://testflight.apple.com/join/abc' });
    expect((await O('patch', `${ST}/updates`).send({ platform: 'android', newest: -1 })).status).toBe(400);
    // Asking this phone itself to update: refused, so the owner never locks themselves out.
    const self = await onPhone(O('patch', `${ST}/updates`), '2.0.0 (31)').send({ platform: 'android', oldest: 32, newest: 32 });
    expect(self.body.error).toMatchObject({ code: 'WOULD_BLOCK_THIS_PHONE' });
    const texts = (await activity({ kind: 'settings', period: 'today' })).entries.map((e) => e.text);
    expect(texts).toContain('Lakshmi Person required Android version 30 or later for everyone, set the newest Android version to 30');
  });

  it('Phones used this week show the version they run (for the warning)', async () => {
    const acc = await makeAccount({ role: 'STAFF', name: 'Anil' });
    const device = newDevice('android');
    await trustDevice(acc, device);
    const r = await api().post('/api/v2/auth/login').set('X-App-Version', '2.0.0 (25)').set('X-Platform', 'android').send({ mobile: acc.mobile, pin: acc.pin, device });
    expect(r.body.status).toBe('signed_in');
    const phones = (await O('get', ST)).body.updates.phones;
    expect(phones).toEqual(expect.arrayContaining([expect.objectContaining({ person: 'Anil Person', platform: 'android', build: 25 })]));
  });
});

describe('shop details (6.5, 6.7)', () => {
  it('Checked, saved, logged; new invoices and messages use them; an older invoice keeps the details of its day', async () => {
    const before = new Date();
    expect((await O('patch', `${ST}/shop`).send({ name: 'Nandam Handlooms', address: 'Hussain Katta, Mangalagiri', mobile: '9494170180', gstin: '37CCWPN2487', website: '' })).body.error.code).toBe('BAD_GSTIN');
    expect((await O('patch', `${ST}/shop`).send({ name: 'Nandam Handlooms', address: 'Hussain Katta, Mangalagiri', mobile: '9494170180', gstin: '37CCWPN2487C1Z2', website: 'nandam.com' })).body.error.code).toBe('BAD_WEBSITE');
    expect((await O('patch', `${ST}/shop`).send({ name: 'Nandam Handlooms', address: 'Hussain Katta, Mangalagiri', mobile: '94941', gstin: '37CCWPN2487C1Z2' })).status).toBe(400);
    expect((await O('patch', `${ST}/shop`).send({ name: 'N', address: 'x', mobile: '9494170180', gstin: '37CCWPN2487C1Z2' })).status).toBe(400);
    const r = await O('patch', `${ST}/shop`).send({ name: 'Nandam  Handlooms', address: 'Hussain Katta, Mangalagiri, Andhra Pradesh, 522503, India', mobile: '+91 94941 70181', gstin: '37ccwpn2487c1z2', website: 'https://shop.example.com/' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.shop).toMatchObject({ name: 'Nandam Handlooms', mobile: '9494170181', gstin: '37CCWPN2487C1Z2', website: 'https://shop.example.com', saved: true, changed: { by: 'Lakshmi Person' } });
    expect(await shopDetails()).toMatchObject({ mobile: '9494170181', website: 'https://shop.example.com' });
    expect(await shopDetailsAt(new Date())).toMatchObject({ mobile: '9494170181', website: 'https://shop.example.com' });
    expect(await shopDetailsAt(before)).toMatchObject({ mobile: '9494170180', website: '', name: 'Nandam Handlooms' });
    const e = (await activity({ kind: 'settings', period: 'today' })).entries.find((x) => x.type === 'shop_details_updated');
    expect(e.text).toBe('Lakshmi Person changed the shop mobile, website address');
    expect(e.details).toEqual(expect.arrayContaining([['Mobile', '9494170180 → 9494170181'], ['Website address', '(empty) → https://shop.example.com']]));
  });
});
