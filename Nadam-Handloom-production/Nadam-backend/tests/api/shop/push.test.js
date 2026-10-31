// Website W1: notifications with Firebase (web-01 section 10), in test mode (console sender).
import { describe, it, expect } from 'vitest';
import { outbox } from '../../../src/services/push/console.provider.js';
import { notifyCustomer } from '../../../src/services/shop/push.service.js';
import { signUp, as, api, SHOP, HEADER, prisma } from '../../support/shop.js';

let n = 0;
const token = (prefix = 'tok') => `${prefix}-${Date.now()}-${n++}-abcdefghijklmnopqrstuvwxyz0123456789`;
const anon = (method, path) => api()[method](`${SHOP}${path}`);

describe('subscribing', () => {
  it('a signed-in customer gets order updates; offers only with consent', async () => {
    const who = await signUp();
    const t = token();
    const r = await as(who)('post', '/push/subscribe').send({ token: t });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ subscribed: true, topics: ['orders'] });
    const row = await prisma.pushToken.findUnique({ where: { token: t } });
    expect(row).toMatchObject({ authAccountId: who.customer.id, platform: 'web', browser: 'Chrome on Android', removedAt: null });

    const opted = await signUp({ profile: { marketingOptIn: true } });
    expect((await as(opted)('post', '/push/subscribe').send({ token: token() })).body.topics).toEqual(['orders', 'arrivals', 'offers']);
  });

  it('a visitor can follow new arrivals, never orders', async () => {
    const t = token();
    const r = await anon('post', '/push/subscribe').send({ token: t, topics: ['orders', 'arrivals'] });
    expect(r.body).toEqual({ subscribed: true, topics: ['arrivals'] });
    expect((await anon('post', '/push/status').send({ token: t })).body).toEqual({ subscribed: true, topics: ['arrivals'] });
  });

  it('a browser that subscribed as a visitor joins the account after sign-in', async () => {
    const t = token();
    await anon('post', '/push/subscribe').send({ token: t });
    const who = await signUp();
    const r = await as(who)('post', '/push/subscribe').send({ token: t });
    expect(r.body.topics).toEqual(['orders']);
    expect((await prisma.pushToken.findUnique({ where: { token: t } })).authAccountId).toBe(who.customer.id);
  });

  it('choosing offers for a signed-in customer records their consent', async () => {
    const who = await signUp();
    const t = token();
    await as(who)('post', '/push/subscribe').send({ token: t });
    const r = await as(who)('patch', '/push/preferences').send({ token: t, topics: ['orders', 'offers'] });
    expect(r.body.topics).toEqual(['orders', 'offers']);
    const p = await prisma.userProfile.findUnique({ where: { authAccountId: who.customer.id } });
    expect(p.marketingOptIn).toBe(true);
    expect(p.marketingOptInAt).not.toBeNull();
  });

  it('turning off: the token is removed; someone else\'s token can\'t be changed', async () => {
    const a = await signUp();
    const b = await signUp();
    const t = token();
    await as(a)('post', '/push/subscribe').send({ token: t });
    expect((await as(b)('patch', '/push/preferences').send({ token: t, topics: [] })).body.error.code).toBe('PUSH_NOT_SUBSCRIBED');
    expect((await as(b)('delete', '/push/subscribe').send({ token: t })).status).toBe(204);
    expect((await prisma.pushToken.findUnique({ where: { token: t } })).removedAt).toBeNull();
    expect((await as(a)('delete', '/push/subscribe').send({ token: t })).status).toBe(204);
    expect((await prisma.pushToken.findUnique({ where: { token: t } })).removedReason).toBe('unsubscribed');
    expect((await as(a)('post', '/push/status').send({ token: t })).body).toEqual({ subscribed: false, topics: [] });
  });

  it('refuses a malformed token and unknown topics', async () => {
    expect((await anon('post', '/push/subscribe').send({ token: 'short' })).status).toBe(400);
    expect((await anon('post', '/push/subscribe').send({ token: `${token()}<script>` })).status).toBe(400);
    expect((await anon('post', '/push/subscribe').send({ token: token(), topics: ['spam'] })).body.error.code).toBe('VALIDATION_FAILED');
  });

  it('signing out unlinks this browser from the account', async () => {
    const who = await signUp();
    const t = token();
    await as(who)('post', '/push/subscribe').send({ token: t });
    await api().post(`${SHOP}/auth/logout`).set(HEADER).set('cookie', who.cookie).send({ pushToken: t });
    const row = await prisma.pushToken.findUnique({ where: { token: t } });
    expect(row.authAccountId).toBeNull();
    expect(row.topics).not.toContain('orders');
  });
});

describe('sending', () => {
  it('order updates reach every browser of the customer; gone tokens are removed', async () => {
    const who = await signUp();
    const good = token();
    const gone = token('invalid');
    await as(who)('post', '/push/subscribe').send({ token: good });
    await as(who)('post', '/push/subscribe').send({ token: gone });
    const before = outbox.length;
    const note = await notifyCustomer({ accountId: who.customer.id, type: 'order_shipped', title: 'Your order is on its way', body: 'DTDC D12345678', link: 'https://example.com/orders/1' });
    expect(note).toMatchObject({ status: 'partly_sent', sentCount: 1, failedCount: 1, channel: 'push', type: 'order_shipped' });
    expect(outbox.slice(before)).toHaveLength(1);
    expect(outbox.at(-1)).toMatchObject({ token: good, title: 'Your order is on its way', tag: 'order_shipped', data: { type: 'order_shipped', notificationId: note.id } });
    expect((await prisma.pushToken.findUnique({ where: { token: gone } })).removedReason).toBe('expired');
  });

  it('offers need the customer\'s consent; no browser means "no device"', async () => {
    const who = await signUp();
    expect((await notifyCustomer({ accountId: who.customer.id, type: 'order_paid', title: 'Paid', body: 'Thanks' })).status).toBe('no_device');
    await as(who)('post', '/push/subscribe').send({ token: token(), topics: ['orders'] });
    expect((await notifyCustomer({ accountId: who.customer.id, type: 'offers', title: 'Sale', body: '10% off' })).status).toBe('failed');
  });

  it('"Send a test notification": this browser only, 3 an hour', async () => {
    const who = await signUp();
    const t = token();
    await as(who)('post', '/push/subscribe').send({ token: t });
    for (let i = 0; i < 3; i++) expect((await as(who)('post', '/push/test').send({ token: t })).body).toEqual({ status: 'sent' });
    const r = await as(who)('post', '/push/test').send({ token: t });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('PUSH_TEST_LIMIT');
    expect((await anon('post', '/push/test').send({ token: t })).body.error.code).toBe('NOT_SIGNED_IN');
  });
});
