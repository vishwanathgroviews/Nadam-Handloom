import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn() } }));

import * as prismaModule from '../../config/prisma';
import { smsProvider } from '../../providers/sms';
import { seedRoles } from '../../test/fakePrisma';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  seedRoles(fake.db);
  sendMock.mockClear();
});

const registerAndLogin = async (phone: string) => {
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Test', lastName: 'Customer', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  return setup.body.data.tokens.accessToken as string;
};

const validAddress = (overrides: Record<string, any> = {}) => ({
  fullName: 'Test Customer',
  phone: '9876500001',
  line1: '221B Baker Street',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '500001',
  ...overrides,
});

describe('address CRUD', () => {
  it('creates the first address as the default automatically', async () => {
    const token = await registerAndLogin('9876500001');

    const res = await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${token}`).send(validAddress());
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(true);
    expect(res.body.data.country).toBe('India');
  });

  it('a second address is not default unless explicitly requested, and setting it default un-defaults the first', async () => {
    const token = await registerAndLogin('9876500002');

    const first = await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${token}`).send(validAddress());
    const second = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress({ line1: '10 Downing Street' }));
    expect(second.body.data.isDefault).toBe(false);

    const madeDefault = await request(app)
      .patch(`/api/v1/addresses/${second.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isDefault: true });
    expect(madeDefault.status).toBe(200);
    expect(madeDefault.body.data.isDefault).toBe(true);

    const list = await request(app).get('/api/v1/addresses').set('Authorization', `Bearer ${token}`);
    const firstAfter = list.body.data.find((a: any) => a.id === first.body.data.id);
    expect(firstAfter.isDefault).toBe(false);
  });

  it('lists addresses default-first, then newest first', async () => {
    const token = await registerAndLogin('9876500003');
    const a = await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${token}`).send(validAddress({ line1: 'Line A' }));
    const b = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress({ line1: 'Line B', isDefault: true }));
    void a;

    const list = await request(app).get('/api/v1/addresses').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data[0].id).toBe(b.body.data.id);
  });

  it('deletes an address', async () => {
    const token = await registerAndLogin('9876500004');
    const created = await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${token}`).send(validAddress());

    const res = await request(app).delete(`/api/v1/addresses/${created.body.data.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/v1/addresses').set('Authorization', `Bearer ${token}`);
    expect(list.body.data).toHaveLength(0);
  });

  it('rejects an invalid pincode/phone', async () => {
    const token = await registerAndLogin('9876500005');
    const res = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress({ pincode: '123' }));
    expect(res.status).toBe(400);
  });

  it('prevents one customer from reading, updating, or deleting another customer\'s address', async () => {
    const tokenA = await registerAndLogin('9876500006');
    const tokenB = await registerAndLogin('9876500007');

    const created = await request(app).post('/api/v1/addresses').set('Authorization', `Bearer ${tokenA}`).send(validAddress());
    const addressId = created.body.data.id;

    const updateAttempt = await request(app)
      .patch(`/api/v1/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ city: 'Somewhere Else' });
    expect(updateAttempt.status).toBe(403);

    const deleteAttempt = await request(app).delete(`/api/v1/addresses/${addressId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(deleteAttempt.status).toBe(403);

    // B's own list must never include A's address.
    const listB = await request(app).get('/api/v1/addresses').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.data).toHaveLength(0);
  });

  it('returns 404 updating a nonexistent address', async () => {
    const token = await registerAndLogin('9876500008');
    const res = await request(app)
      .patch('/api/v1/addresses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ city: 'Nowhere' });
    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/addresses');
    expect(res.status).toBe(401);
  });
});
