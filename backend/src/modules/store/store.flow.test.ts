import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { seedRoles } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import app from '../../app';

const fake = (prismaModule as any).__fake;
let roles: Record<string, { id: string }>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
});

const createToken = async (role: 'ADMIN' | 'STAFF', mobile: string) => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: `${role.toLowerCase()}-${mobile}@example.com`,
      phone: mobile,
      mpinHash,
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: role, lastName: 'User' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return { token: login.body.data.tokens.accessToken as string, accountId: account.id };
};

describe('Store Contact & Editable Store Phone Flow', () => {
  it('allows public retrieval of store contact without authentication', async () => {
    const res = await request(app).get('/api/v1/store/contact');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('phone');
    expect(res.body.data).toHaveProperty('displayPhone');
    expect(res.body.data).toHaveProperty('tel');
    // Default should be a valid phone number
    expect(res.body.data.phone).toMatch(/^\+91[6-9]\d{9}$/);
    expect(res.body.data.tel).toBe(res.body.data.phone);
  });

  it('rejects unauthenticated attempts to update store settings', async () => {
    const res = await request(app)
      .put('/api/v1/admin/store-settings')
      .send({ phone: '+919876543210' });
    expect(res.status).toBe(401);
  });

  it('forbids non-admin (STAFF) from editing store settings', async () => {
    const staff = await createToken('STAFF', '9876500001');
    const res = await request(app)
      .put('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ phone: '+919876543210' });
    expect(res.status).toBe(403);
  });

  it('allows staff to view store settings in admin route', async () => {
    const staff = await createToken('STAFF', '9876500002');
    const res = await request(app)
      .get('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBeTruthy();
  });

  it('rejects invalid phone numbers with validation error', async () => {
    const admin = await createToken('ADMIN', '9876500003');

    // Invalid: letters
    const res1 = await request(app)
      .put('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ phone: 'invalid-number' });
    expect(res1.status).toBe(400);

    // Invalid: less than 10 digits
    const res2 = await request(app)
      .put('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ phone: '73829' });
    expect(res2.status).toBe(400);

    // Invalid: 10 digits starting with invalid digit '1'
    const res3 = await request(app)
      .put('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ phone: '1234567890' });
    expect(res3.status).toBe(400);
  });

  it('allows ADMIN to update store phone number and serves updated number to Customer Web', async () => {
    const admin = await createToken('ADMIN', '9876500004');
    const newNumber = '9876543210';

    const updateRes = await request(app)
      .put('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ phone: newNumber });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.phone).toBe('+919876543210');
    expect(updateRes.body.data.displayPhone).toBe('+91 98765 43210');
    expect(updateRes.body.data.tel).toBe('+919876543210');

    // Verify it persists in database
    expect(fake.db.storeSetting).toHaveLength(1);
    expect(fake.db.storeSetting[0].key).toBe('store_phone');
    expect(fake.db.storeSetting[0].value).toBe('+919876543210');

    // Verify public Customer Web endpoint reflects the new number immediately
    const publicRes = await request(app).get('/api/v1/store/contact');
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.phone).toBe('+919876543210');
    expect(publicRes.body.data.displayPhone).toBe('+91 98765 43210');
    expect(publicRes.body.data.tel).toBe('+919876543210');

    // Verify audit log recorded the update
    const auditEvent = fake.db.authEvent.find((e: any) => e.eventType === 'store_phone_updated');
    expect(auditEvent).toBeDefined();
    expect(auditEvent.metadata.phone).toBe('+919876543210');
  });

  it('accepts formatted phone number (+91 73829 68566) and normalizes properly', async () => {
    const admin = await createToken('ADMIN', '9876500005');
    const formatted = '+91 73829 68566';

    const updateRes = await request(app)
      .put('/api/v1/admin/store-settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ phone: formatted });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.phone).toBe('+917382968566');
    expect(updateRes.body.data.displayPhone).toBe('+91 73829 68566');
    expect(updateRes.body.data.tel).toBe('+917382968566');
  });
});
