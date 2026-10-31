// Website W1: My account → addresses (at most 10, one default).
import { describe, it, expect } from 'vitest';
import { signUp, as, prisma } from '../../support/shop.js';

const address = (over = {}) => ({
  label: 'home', fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 4B, Lakshmi Residency', line2: 'Road No. 12, Banjara Hills',
  landmark: 'Near the temple', pincode: '500034', ...over,
});

describe('addresses', () => {
  it('the first address becomes the default; city and state come from the pincode', async () => {
    const who = await signUp();
    const r = await as(who)('post', '/me/addresses').send(address());
    expect(r.status).toBe(201);
    expect(r.body.address).toMatchObject({ label: 'home', fullName: 'Priya Sharma', mobile: '9876543210', city: 'Hyderabad', state: 'Telangana', country: 'India', isDefault: true, landmark: 'Near the temple' });
    expect(r.body.addresses).toHaveLength(1);
    expect(r.body.max).toBe(10);
  });

  it('a new default replaces the old one; the list shows the default first', async () => {
    const who = await signUp();
    const a = await as(who)('post', '/me/addresses').send(address());
    const b = await as(who)('post', '/me/addresses').send(address({ label: 'office', isDefault: true, pincode: '522503' }));
    expect(b.body.addresses.map((x) => [x.label, x.isDefault])).toEqual([['office', true], ['home', false]]);
    const back = await as(who)('post', `/me/addresses/${a.body.address.id}/default`);
    expect(back.body.addresses.map((x) => [x.label, x.isDefault])).toEqual([['home', true], ['office', false]]);
    expect(await prisma.address.count({ where: { authAccountId: who.customer.id, isDefault: true } })).toBe(1);
  });

  it('edits change only what is sent; a new pincode brings its city and state', async () => {
    const who = await signUp();
    const a = await as(who)('post', '/me/addresses').send(address());
    const r = await as(who)('patch', `/me/addresses/${a.body.address.id}`).send({ landmark: '', pincode: '522503' });
    expect(r.status).toBe(200);
    expect(r.body.address).toMatchObject({ landmark: '', pincode: '522503', city: 'Guntur', state: 'Andhra Pradesh', line1: 'Flat 4B, Lakshmi Residency' });
  });

  it('deleting the default makes the most recent other one the default', async () => {
    const who = await signUp();
    const a = await as(who)('post', '/me/addresses').send(address());
    await as(who)('post', '/me/addresses').send(address({ label: 'office' }));
    const r = await as(who)('delete', `/me/addresses/${a.body.address.id}`);
    expect(r.status).toBe(200);
    expect(r.body.addresses).toHaveLength(1);
    expect(r.body.addresses[0]).toMatchObject({ label: 'office', isDefault: true });
  });

  it('at most 10 addresses', async () => {
    const who = await signUp();
    for (let i = 0; i < 10; i++) expect((await as(who)('post', '/me/addresses').send(address({ line1: `House ${i + 1}, Street` }))).status).toBe(201);
    const r = await as(who)('post', '/me/addresses').send(address());
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'ADDRESS_LIMIT', message: 'You can save up to 10 addresses. Delete one to add another.' });
  });

  it('two saves at the same moment can\'t pass the limit or make two defaults', async () => {
    const who = await signUp();
    for (let i = 0; i < 9; i++) await as(who)('post', '/me/addresses').send(address({ line1: `House ${i + 1}, Street` }));
    const [x, y] = await Promise.all([
      as(who)('post', '/me/addresses').send(address({ isDefault: true })),
      as(who)('post', '/me/addresses').send(address({ isDefault: true })),
    ]);
    expect([x.status, y.status].sort()).toEqual([201, 409]);
    expect(await prisma.address.count({ where: { authAccountId: who.customer.id } })).toBe(10);
    expect(await prisma.address.count({ where: { authAccountId: who.customer.id, isDefault: true } })).toBe(1);
  });

  it('field rules', async () => {
    const who = await signUp();
    const cases = [
      [{ fullName: '' }, 'fullName'],
      [{ mobile: '12345' }, 'mobile'],
      [{ line1: 'ab' }, 'line1'],
      [{ pincode: '12345' }, 'pincode'],
      [{ label: 'castle' }, 'label'],
      [{ state: 'Nowhere' }, 'state'],
      [{ landmark: 'x'.repeat(81) }, 'landmark'],
    ];
    for (const [over, field] of cases) {
      const r = await as(who)('post', '/me/addresses').send(address(over));
      expect(r.status, JSON.stringify(over)).toBe(400);
      expect(r.body.error.details.issues[0].field).toBe(field);
    }
    const unknown = await as(who)('post', '/me/addresses').send(address({ pincode: '999998' }));
    expect(unknown.body.error.code).toBe('PINCODE_NOT_FOUND');
    const typed = await as(who)('post', '/me/addresses').send(address({ pincode: '999998', city: 'Camp', state: 'Punjab' }));
    expect(typed.status).toBe(201);
  });

  it('nobody can see or change another customer\'s addresses', async () => {
    const a = await signUp();
    const b = await signUp();
    const mine = await as(a)('post', '/me/addresses').send(address());
    const id = mine.body.address.id;
    expect((await as(b)('get', '/me/addresses')).body.addresses).toHaveLength(0);
    for (const [method, path] of [['patch', `/me/addresses/${id}`], ['delete', `/me/addresses/${id}`], ['post', `/me/addresses/${id}/default`]]) {
      const r = await as(b)(method, path).send({ landmark: 'x' });
      expect(r.status, `${method} ${path}`).toBe(404);
      expect(r.body.error.code).toBe('ADDRESS_NOT_FOUND');
    }
    expect((await as(b)('patch', '/me/addresses/not-a-uuid').send({ landmark: 'x' })).status).toBe(400);
  });

  it('an order keeps its own copy of the address after the address is deleted', async () => {
    const who = await signUp();
    const a = await as(who)('post', '/me/addresses').send(address());
    const order = await prisma.order.create({
      data: { orderNumber: `TEST-${Date.now()}`, authAccountId: who.customer.id, addressId: a.body.address.id, subtotal: 100, total: 100, shippingAddress: { fullName: 'Priya Sharma', pincode: '500034' } },
    });
    await as(who)('delete', `/me/addresses/${a.body.address.id}`);
    const o = await prisma.order.findUnique({ where: { id: order.id } });
    expect(o.addressId).toBeNull();
    expect(o.shippingAddress).toMatchObject({ fullName: 'Priya Sharma' });
    await prisma.order.delete({ where: { id: order.id } });
  });
});
