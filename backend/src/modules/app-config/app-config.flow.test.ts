import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn() } }));

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

const signIn = async (role: 'ADMIN' | 'STAFF', mobile: string) => {
  const account = await fake.client.authAccount.create({
    data: {
      email: `${role.toLowerCase()}@example.com`,
      phone: mobile,
      mpinHash: await hashSecret('284759'),
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: 'Shop', lastName: role } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return { token: login.body.data.tokens.accessToken as string, id: account.id as string };
};

const settings = (overrides: Record<string, unknown> = {}) => ({
  maintenance: { enabled: false, message: '' },
  webMaintenance: { enabled: false, message: '' },
  android: { latestBuild: 23, minBuild: 22, forceUpdate: false, updateUrl: '' },
  ios: { latestBuild: 3, minBuild: 2, forceUpdate: true, updateUrl: 'https://testflight.apple.com/join/abc' },
  ...overrides,
});

describe('app config', () => {
  it('answers without sign-in, with everything off until an admin saves something', async () => {
    const res = await request(app).get('/api/v1/app-config');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      maintenance: { enabled: false, message: '' },
      webMaintenance: { enabled: false, message: '' },
      android: {
        latestBuild: 0,
        minBuild: 0,
        forceUpdate: false,
        updateUrl: 'https://play.google.com/store/apps/details?id=com.nandamhandlooms.staff',
      },
      ios: { latestBuild: 0, minBuild: 0, forceUpdate: false, updateUrl: 'https://beta.itunes.apple.com/v1/app/6818412372' },
      updatedAt: null,
    });
  });

  it('lets an admin change it, and everyone then reads the new values', async () => {
    const admin = await signIn('ADMIN', '9000000001');

    const save = await request(app)
      .put('/api/v1/app-config')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(settings({ maintenance: { enabled: true, message: '  Stock count in progress  ' } }));
    expect(save.status).toBe(200);

    const read = await request(app).get('/api/v1/app-config');
    expect(read.body.data.maintenance).toEqual({ enabled: true, message: 'Stock count in progress' });
    expect(read.body.data.android).toEqual({
      latestBuild: 23,
      minBuild: 22,
      forceUpdate: false,
      // Left empty, so the built-in store link is still what the app gets.
      updateUrl: 'https://play.google.com/store/apps/details?id=com.nandamhandlooms.staff',
    });
    expect(read.body.data.ios).toEqual({
      latestBuild: 3,
      minBuild: 2,
      forceUpdate: true,
      updateUrl: 'https://testflight.apple.com/join/abc',
    });
    expect(read.body.data.updatedAt).toBeTruthy();
    expect(fake.db.appConfig).toHaveLength(1);
    expect(fake.db.appConfig[0].updatedBy).toBe(admin.id);
  });

  it('keeps a single row however many times it is saved', async () => {
    const admin = await signIn('ADMIN', '9000000001');
    const put = (body: unknown) =>
      request(app).put('/api/v1/app-config').set('Authorization', `Bearer ${admin.token}`).send(body as object);

    await put(settings());
    await put(settings({ webMaintenance: { enabled: true, message: 'Back at 6 pm' } }));

    expect(fake.db.appConfig).toHaveLength(1);
    const read = await request(app).get('/api/v1/app-config');
    expect(read.body.data.webMaintenance).toEqual({ enabled: true, message: 'Back at 6 pm' });
  });

  it('records in the Audit Log what was changed, from what to what', async () => {
    const admin = await signIn('ADMIN', '9000000001');
    const put = (body: unknown) =>
      request(app).put('/api/v1/app-config').set('Authorization', `Bearer ${admin.token}`).send(body as object);

    await put(settings());
    await put(settings({ android: { latestBuild: 24, minBuild: 22, forceUpdate: true, updateUrl: '' } }));

    const events = fake.db.authEvent.filter((e: any) => e.eventType === 'app_config_updated');
    expect(events).toHaveLength(2);
    expect(events[1].metadata).toEqual({
      actorId: admin.id,
      changes: {
        androidLatestBuild: { from: 23, to: 24 },
        androidForceUpdate: { from: false, to: true },
      },
    });
  });

  it('refuses anyone who is not an admin', async () => {
    const staff = await signIn('STAFF', '9000000002');

    const anonymous = await request(app).put('/api/v1/app-config').send(settings());
    expect(anonymous.status).toBe(401);

    const asStaff = await request(app)
      .put('/api/v1/app-config')
      .set('Authorization', `Bearer ${staff.token}`)
      .send(settings({ maintenance: { enabled: true, message: '' } }));
    expect(asStaff.status).toBe(403);

    expect(fake.db.appConfig).toHaveLength(0);
  });

  it('refuses a minimum version above the latest, which no phone could ever satisfy', async () => {
    const admin = await signIn('ADMIN', '9000000001');

    const res = await request(app)
      .put('/api/v1/app-config')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(settings({ android: { latestBuild: 23, minBuild: 230, forceUpdate: false, updateUrl: '' } }));

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('The minimum version cannot be higher than the latest version');
    expect(fake.db.appConfig).toHaveLength(0);
  });

  it.each([
    ['a negative build number', { android: { latestBuild: -1, minBuild: 0, forceUpdate: false, updateUrl: '' } }],
    ['a build number that is not whole', { ios: { latestBuild: 3.5, minBuild: 2, forceUpdate: false, updateUrl: '' } }],
    ['an update link that is not https', { ios: { latestBuild: 3, minBuild: 2, forceUpdate: false, updateUrl: 'http://example.com' } }],
    ['a missing section', { webMaintenance: undefined }],
  ])('refuses %s', async (_label, overrides) => {
    const admin = await signIn('ADMIN', '9000000001');

    const res = await request(app)
      .put('/api/v1/app-config')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(settings(overrides));

    expect(res.status).toBe(400);
  });
});
