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
let adminToken: string;

const MPIN = '284759';

beforeEach(async () => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);

  const account = await fake.client.authAccount.create({
    data: {
      email: 'owner@example.com',
      phone: '9200000000',
      mpinHash: await hashSecret(MPIN),
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: 'Owner', lastName: 'Admin' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.ADMIN!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile: '9200000000', mpin: MPIN });
  adminToken = login.body.data.tokens.accessToken;
});

const invite = (body: Record<string, unknown>) =>
  request(app).post('/api/v1/admin/users').set('Authorization', `Bearer ${adminToken}`).send(body);

const NEW_STAFF = { name: 'Priya Sharma', mobile: '9200000001', email: 'priya@example.com', role: 'STAFF' };

const rolesOf = async (authAccountId: string) => {
  const rows = await fake.client.userRole.findMany({ where: { authAccountId }, include: { role: true } });
  return rows.map((r: any) => r.role.name).sort();
};

describe('POST /admin/users — inviting a team member', () => {
  it('creates a pending STAFF account for someone the system has never seen', async () => {
    const res = await invite(NEW_STAFF);

    expect(res.status).toBe(201);
    const account = await fake.client.authAccount.findUnique({ where: { phone: '9200000001' } });
    expect(account.status).toBe('pending');
    expect(await rolesOf(account.id)).toEqual(['STAFF']);
  });

  // The bug this replaced: any pre-existing account with the same number or
  // address was refused outright, so a colleague who had ever shopped on the
  // storefront could never be invited.
  it('gives an existing customer staff access instead of refusing the invite', async () => {
    const customer = await fake.client.authAccount.create({
      data: {
        phone: '9200000002',
        email: 'ravi@example.com',
        mpinHash: await hashSecret('111111'),
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        userProfile: { create: { firstName: 'Ravi', lastName: 'K' } },
      },
    });
    await fake.client.userRole.create({ data: { authAccountId: customer.id, roleId: roles.CUSTOMER!.id } });

    const res = await invite({ name: 'Ravi Kumar', mobile: '9200000002', email: 'ravi@example.com', role: 'STAFF' });

    expect(res.status).toBe(201);
    const updated = await fake.client.authAccount.findUnique({ where: { id: customer.id } });
    expect(updated.status).toBe('pending');
    // They keep shopping as a customer and gain staff access on the same account.
    expect(await rolesOf(customer.id)).toEqual(['CUSTOMER', 'STAFF']);
    // The storefront MPIN must not double as a staff-app MPIN — they have to
    // activate through OTP like any other invite.
    expect(updated.mpinHash).toBeNull();
  });

  it('re-sends an invite that was never activated rather than erroring', async () => {
    const first = await invite(NEW_STAFF);
    expect(first.status).toBe(201);

    const second = await invite({ ...NEW_STAFF, name: 'Priya S Sharma' });

    expect(second.status).toBe(201);
    const accounts = await fake.client.authAccount.findMany({ where: { phone: '9200000001' } });
    expect(accounts).toHaveLength(1);
    const profile = await fake.client.adminProfile.findUnique({ where: { authAccountId: accounts[0].id } });
    expect(profile.firstName).toBe('Priya');
    expect(profile.lastName).toBe('S Sharma');
  });

  it('refuses when the number already belongs to an active team member', async () => {
    const staff = await fake.client.authAccount.create({
      data: {
        phone: '9200000003',
        email: 'active@example.com',
        mpinHash: await hashSecret(MPIN),
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        adminProfile: { create: { firstName: 'Active', lastName: 'Staff' } },
      },
    });
    await fake.client.userRole.create({ data: { authAccountId: staff.id, roleId: roles.STAFF!.id } });

    const res = await invite({ name: 'Someone Else', mobile: '9200000003', email: 'someone@example.com', role: 'STAFF' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already uses this mobile number/i);
  });

  it('refuses when the number and the email belong to two different people', async () => {
    const a = await fake.client.authAccount.create({
      data: { phone: '9200000004', email: 'a@example.com', status: 'active' },
    });
    await fake.client.userRole.create({ data: { authAccountId: a.id, roleId: roles.CUSTOMER!.id } });
    const b = await fake.client.authAccount.create({
      data: { phone: '9200000005', email: 'b@example.com', status: 'active' },
    });
    await fake.client.userRole.create({ data: { authAccountId: b.id, roleId: roles.CUSTOMER!.id } });

    const res = await invite({ name: 'Mix Up', mobile: '9200000004', email: 'b@example.com', role: 'STAFF' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/two different accounts/i);
  });

  it('brings back a removed team member, revoking whatever sessions they still held', async () => {
    const former = await fake.client.authAccount.create({
      data: {
        phone: '9200000006',
        email: 'former@example.com',
        mpinHash: await hashSecret(MPIN),
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        deletedAt: new Date(),
        adminProfile: { create: { firstName: 'Former', lastName: 'Staff' } },
      },
    });
    await fake.client.userRole.create({ data: { authAccountId: former.id, roleId: roles.STAFF!.id } });
    await fake.client.session.create({
      data: {
        authAccountId: former.id,
        refreshTokenHash: 'old-hash',
        platform: 'android',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const stampBefore = former.securityStamp;

    const res = await invite({ name: 'Former Staff', mobile: '9200000006', email: 'former@example.com', role: 'ADMIN' });

    expect(res.status).toBe(201);
    const updated = await fake.client.authAccount.findUnique({ where: { id: former.id } });
    expect(updated.deletedAt).toBeNull();
    expect(updated.status).toBe('pending');
    expect(updated.securityStamp).not.toBe(stampBefore);
    expect(await rolesOf(former.id)).toEqual(['ADMIN']);

    const sessions = await fake.client.session.findMany({ where: { authAccountId: former.id } });
    expect(sessions.every((s: any) => s.revokedAt !== null)).toBe(true);
  });
});
