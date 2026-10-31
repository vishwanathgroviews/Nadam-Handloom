// Website W1: what the website reads first, pincode lookup, CORS and the website switch.
import { describe, it, expect, afterEach } from 'vitest';
import { forgetCache } from '../../../src/services/settings.service.js';
import { api, SHOP, prisma, signUp, as } from '../../support/shop.js';

const setWebsite = async (on, message = '') => {
  await prisma.appConfig.upsert({ where: { id: 'default' }, update: { webMaintenanceEnabled: on, webMaintenanceMessage: message }, create: { id: 'default', webMaintenanceEnabled: on, webMaintenanceMessage: message } });
  forgetCache();
};

describe('website settings', () => {
  afterEach(() => setWebsite(false));

  it('lists what the forms need and the public push values; can be cached a minute', async () => {
    const r = await api().get(`${SHOP}/config`);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('public, max-age=60');
    expect(r.body).toMatchObject({
      maintenance: { on: false },
      signIn: { codeLength: 6, resendSeconds: 60, sessionDays: 30 },
      limits: { maxAddresses: 10, avatarMaxBytes: 5242880, deleteAfterDays: 7 },
      addressLabels: ['home', 'office', 'other'],
    });
    expect(r.body.states).toHaveLength(36);
    expect(r.body.languages.map((l) => l.code)).toEqual(['en', 'te', 'hi']);
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE KEY|client_email|clientEmail/);
  });

  it('when the owner switches the website off: everything but the settings says so', async () => {
    const who = await signUp();
    await setWebsite(true, 'New collection going up. Back at 6 pm.');
    const cfg = await api().get(`${SHOP}/config`);
    expect(cfg.body.maintenance).toEqual({ on: true, message: 'New collection going up. Back at 6 pm.' });
    const r = await api().post(`${SHOP}/auth/code`).send({ mobile: '9876543210' });
    expect(r.status).toBe(503);
    expect(r.body.error).toMatchObject({ code: 'MAINTENANCE', message: 'New collection going up. Back at 6 pm.' });
    expect((await as(who)('get', '/me')).status).toBe(503);
  });
});

describe('pincode lookup', () => {
  it('finds the city and state; can be cached a day', async () => {
    const r = await api().get(`${SHOP}/pincodes/522503`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ pincode: '522503', area: 'Mangalagiri', city: 'Guntur', state: 'Andhra Pradesh' });
    expect(r.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('unknown and malformed pincodes', async () => {
    const r = await api().get(`${SHOP}/pincodes/999998`);
    expect(r.status).toBe(404);
    expect(r.body.error).toMatchObject({ code: 'PINCODE_NOT_FOUND', message: 'We couldn\'t find this pincode. Check it, or type your city and state.' });
    expect((await api().get(`${SHOP}/pincodes/12ab56`)).status).toBe(400);
  });
});

describe('browsers: only the website\'s own address', () => {
  it('the website\'s address gets CORS with cookies', async () => {
    const pre = await api().options(`${SHOP}/auth/refresh`).set('origin', 'http://shop.test').set('access-control-request-method', 'POST');
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('http://shop.test');
    expect(pre.headers['access-control-allow-credentials']).toBe('true');
    expect(pre.headers['access-control-allow-headers']).toMatch(/X-Requested-With/);
    const get = await api().get(`${SHOP}/pincodes/522503`).set('origin', 'http://shop.test');
    expect(get.headers['access-control-allow-origin']).toBe('http://shop.test');
    expect(get.headers.vary).toMatch(/Origin/);
  });

  it('other sites get no CORS headers (browsers block them)', async () => {
    const pre = await api().options(`${SHOP}/auth/refresh`).set('origin', 'https://evil.example').set('access-control-request-method', 'POST');
    expect(pre.headers['access-control-allow-origin']).toBeUndefined();
    const get = await api().get(`${SHOP}/config`).set('origin', 'https://evil.example');
    expect(get.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('website replies are never cached by default, and carry the security headers', async () => {
    const r = await api().post(`${SHOP}/auth/code`).send({ mobile: 'x' });
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-frame-options']).toBeDefined();
  });

  it('a wrong address under /shop is a clean 404', async () => {
    const r = await api().get(`${SHOP}/nothing-here`);
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });
});
