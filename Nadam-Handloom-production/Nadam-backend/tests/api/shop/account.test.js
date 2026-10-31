// Website W1: "Delete my account" with a 7-day window (web-01 section 12).
import { describe, it, expect } from 'vitest';
import { makeAccount } from '../../support/helpers.js';
import { runCleanup } from '../../../src/jobs/cleanup.job.js';
import { signUp, signIn, as, post, refresh, prisma } from '../../support/shop.js';

const DAY = 86400_000;

describe('delete my account', () => {
  it('asks for deletion: 7 days to change one\'s mind, shown on every sign-in', async () => {
    const who = await signUp();
    const r = await as(who)('post', '/me/delete-request').send({ reason: 'Not shopping now' });
    expect(r.status).toBe(200);
    const { requestedAt, deletesOn } = r.body.deletion;
    expect(new Date(deletesOn).getTime() - new Date(requestedAt).getTime()).toBe(7 * DAY);
    const again = await signIn(who.mobile);
    expect(again.customer.deletion).toMatchObject({ deletesOn });
    const twice = await as(who)('post', '/me/delete-request').send({});
    expect(twice.body.deletion.deletesOn).toBe(deletesOn);
  });

  it('"Keep my account" cancels it', async () => {
    const who = await signUp();
    await as(who)('post', '/me/delete-request').send({});
    const r = await as(who)('delete', '/me/delete-request');
    expect(r.body.deletion).toBeNull();
    expect((await as(who)('get', '/me')).body.customer.deletion).toBeNull();
  });

  it('after 7 days the personal details go; orders stay, linked to an anonymous account', async () => {
    const who = await signUp();
    await as(who)('post', '/me/addresses').send({ fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 4B, Residency', pincode: '500034' });
    await as(who)('patch', '/me').send({ dateOfBirth: '1990-01-01', marketingOptIn: true });
    await post('/push/subscribe', { token: `tok-${who.customer.id}-abcdefghijklmnop` }).set('authorization', `Bearer ${who.accessToken}`);
    const order = await prisma.order.create({ data: { orderNumber: `TEST-D-${Date.now()}`, authAccountId: who.customer.id, subtotal: 100, total: 100, status: 'delivered', shippingAddress: { fullName: 'Priya Sharma' } } });
    await as(who)('post', '/me/delete-request').send({});

    // Not yet: 6 days later nothing happens.
    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { deleteRequestedAt: new Date(Date.now() - 6 * DAY) } });
    await runCleanup();
    expect((await prisma.authAccount.findUnique({ where: { id: who.customer.id } })).phone).toBe(who.mobile);

    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { deleteRequestedAt: new Date(Date.now() - 7 * DAY - 1000) } });
    const out = await runCleanup();
    expect(out.accountsDeleted).toBeGreaterThanOrEqual(1);

    const a = await prisma.authAccount.findUnique({ where: { id: who.customer.id }, include: { userProfile: true, addresses: true, pushTokens: true } });
    expect(a).toMatchObject({ phone: null, email: null, status: 'deleted' });
    expect(a.deletedAt).not.toBeNull();
    expect(a.userProfile).toMatchObject({ firstName: 'Deleted', lastName: 'customer', displayName: null, dateOfBirth: null, pincode: null, marketingOptIn: false, deleteRequestedAt: null });
    expect(a.addresses).toHaveLength(0);
    expect(a.pushTokens).toHaveLength(0);
    expect(await prisma.session.count({ where: { authAccountId: who.customer.id, kind: 'customer', revokedAt: null } })).toBe(0);
    expect((await prisma.order.findUnique({ where: { id: order.id } })).authAccountId).toBe(who.customer.id);
    expect((await refresh(who.cookie)).body.error.code).toBe('ACCOUNT_DELETED');
    expect((await as(who)('get', '/me')).body.error.code).toBe('ACCOUNT_DELETED');

    // The number can sign up again as a new customer.
    const c = await post('/auth/code', { mobile: who.mobile });
    const v = await post('/auth/verify', { mobile: who.mobile, code: c.body.devCode });
    expect(v.body.status).toBe('needs_profile');
    expect(v.body.prefill.fullName).toBe('');
    await prisma.order.delete({ where: { id: order.id } });
  });

  it('can\'t delete while an order is on its way', async () => {
    const who = await signUp();
    const order = await prisma.order.create({ data: { orderNumber: `TEST-O-${Date.now()}`, authAccountId: who.customer.id, subtotal: 100, total: 100, status: 'shipped', shippingAddress: {} } });
    const r = await as(who)('post', '/me/delete-request').send({});
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'OPEN_ORDERS', details: { openOrders: 1 } });
    await prisma.order.delete({ where: { id: order.id } });
  });

  it('owners and staff can\'t delete their account from the website', async () => {
    const staff = await makeAccount({ role: 'ADMIN' });
    const c = await post('/auth/code', { mobile: staff.mobile });
    const v = await post('/auth/verify', { mobile: staff.mobile, code: c.body.devCode });
    const done = await post('/auth/complete', { stepToken: v.body.stepToken, fullName: 'Owner Person', email: `o.${staff.id}@example.com`, pincode: '522503' });
    const r = await as({ accessToken: done.body.accessToken })('post', '/me/delete-request').send({});
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('ACCOUNT_MANAGED_BY_SHOP');
  });

  it('someone made staff during the 7 days is not deleted', async () => {
    const who = await signUp();
    await as(who)('post', '/me/delete-request').send({});
    const staffRole = await prisma.role.findUnique({ where: { name: 'STAFF' } });
    await prisma.userRole.create({ data: { authAccountId: who.customer.id, roleId: staffRole.id } });
    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { deleteRequestedAt: new Date(Date.now() - 8 * DAY) } });
    await runCleanup();
    const a = await prisma.authAccount.findUnique({ where: { id: who.customer.id }, include: { userProfile: true } });
    expect(a.phone).toBe(who.mobile);
    expect(a.userProfile.deleteRequestedAt).toBeNull();
  });
});
