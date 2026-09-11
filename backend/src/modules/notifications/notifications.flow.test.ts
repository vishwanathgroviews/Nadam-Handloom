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

const createToken = async (role: 'ADMIN' | 'STAFF' | 'CUSTOMER', mobile: string) => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: `${role.toLowerCase()}@example.com`, phone: mobile, mpinHash, mpinSetAt: new Date(),
      status: 'active', phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: role, lastName: 'User' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return { token: login.body.data.tokens.accessToken as string, accountId: account.id };
};

const VALID_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('notifications — device registration', () => {
  it('registers a device token for the authenticated STAFF account', async () => {
    const { token, accountId } = await createToken('STAFF', '9400000001');

    const res = await request(app)
      .post('/api/v1/admin/notifications/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken: VALID_TOKEN, platform: 'android' });

    expect(res.status).toBe(200);
    expect(res.body.data.registered).toBe(true);
    const row = fake.db.deviceToken.find((d: any) => d.expoPushToken === VALID_TOKEN);
    expect(row.authAccountId).toBe(accountId);
    expect(row.platform).toBe('android');
  });

  it('re-registering the same token updates it in place rather than duplicating', async () => {
    const { token: aliceToken, accountId: aliceId } = await createToken('STAFF', '9400000002');
    const { token: bobToken, accountId: bobId } = await createToken('STAFF', '9400000003');

    await request(app)
      .post('/api/v1/admin/notifications/devices')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ expoPushToken: VALID_TOKEN, platform: 'ios' });

    // Same physical device, now signed into a different staff account —
    // the token row should move to the new owner, not create a second row.
    await request(app)
      .post('/api/v1/admin/notifications/devices')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ expoPushToken: VALID_TOKEN, platform: 'ios' });

    const rows = fake.db.deviceToken.filter((d: any) => d.expoPushToken === VALID_TOKEN);
    expect(rows).toHaveLength(1);
    expect(rows[0].authAccountId).toBe(bobId);
    expect(rows[0].authAccountId).not.toBe(aliceId);
  });

  it('rejects a malformed push token', async () => {
    const { token } = await createToken('STAFF', '9400000004');

    const res = await request(app)
      .post('/api/v1/admin/notifications/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken: 'not-a-real-token', platform: 'android' });

    expect(res.status).toBe(400);
  });

  it('unregisters a device token', async () => {
    const { token } = await createToken('STAFF', '9400000005');
    await request(app)
      .post('/api/v1/admin/notifications/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken: VALID_TOKEN, platform: 'android' });

    const res = await request(app)
      .delete('/api/v1/admin/notifications/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ expoPushToken: VALID_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.data.unregistered).toBe(true);
    expect(fake.db.deviceToken.some((d: any) => d.expoPushToken === VALID_TOKEN)).toBe(false);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/admin/notifications/devices').send({ expoPushToken: VALID_TOKEN, platform: 'android' });
    expect(res.status).toBe(401);
  });
});
