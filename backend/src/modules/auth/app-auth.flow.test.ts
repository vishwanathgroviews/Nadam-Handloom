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
import { hashSecret } from '../../utils/hash';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendOtpMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;

const lastOtpCode = (): string => {
  const call = sendOtpMock.mock.calls[sendOtpMock.mock.calls.length - 1];
  return call[1];
};

let roles: Record<string, { id: string }>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  sendOtpMock.mockClear();
});

// Mirrors what POST /admin/users does: an ADMIN provisions the account
// (name/email/role) before the staff member ever touches the app.
const provisionPendingStaff = async (mobile: string, role: 'ADMIN' | 'STAFF' = 'STAFF') => {
  const account = await fake.client.authAccount.create({
    data: {
      phone: mobile,
      email: `${mobile}@example.com`,
      status: 'pending',
      adminProfile: { create: { firstName: 'Staff', lastName: 'One' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role].id } });
  return account;
};

const registerVerifyAndSetMpin = async (mobile: string, mpin = '284759') => {
  await provisionPendingStaff(mobile);
  await request(app).post('/api/v1/auth/app/activate').send({ mobile });
  const code = lastOtpCode();
  const verify = await request(app).post('/api/v1/auth/app/otp/verify').send({ mobile, code });
  const setupToken = verify.body.data.setupToken;
  return request(app)
    .post('/api/v1/auth/app/mpin/setup')
    .send({ setupToken, mpin, confirmMpin: mpin });
};

describe('app (mobile) auth flow', () => {
  it('registers, verifies OTP, sets an MPIN, and logs in with it', async () => {
    const setup = await registerVerifyAndSetMpin('9000000001');
    expect(setup.status).toBe(200);
    expect(setup.body.data.user.roles).toEqual(['STAFF']);

    const login = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9000000001', mpin: '284759', platform: 'android' });
    expect(login.status).toBe(200);
    expect(login.body.data.tokens.accessToken).toBeTruthy();
    expect(login.body.data.tokens.refreshToken).toBeTruthy();

    const loginEvent = fake.db.authEvent.find((e: any) => e.eventType === 'login_success');
    expect(loginEvent?.source).toBe('staff_app');
  });

  it('locks the account after 5 wrong MPIN attempts', async () => {
    await registerVerifyAndSetMpin('9000000002');

    for (let i = 0; i < 5; i++) {
      // Isolate account-lockout behavior from the route's own IP rate limit
      // (covered separately in rateLimit.middleware.test.ts).
      fake.db.rateLimitHit = [];
      const res = await request(app)
        .post('/api/v1/auth/app/login')
        .send({ mobile: '9000000002', mpin: '000000' });
      expect(res.status).toBe(401);
    }

    fake.db.rateLimitHit = [];
    const lockedAttempt = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9000000002', mpin: '284759' });
    expect(lockedAttempt.status).toBe(401);
    expect(lockedAttempt.body.message).toMatch(/locked/i);
  });

  it('detects refresh-token reuse and revokes the session', async () => {
    await registerVerifyAndSetMpin('9000000003');
    const login = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9000000003', mpin: '284759', platform: 'android' });
    const originalRefreshToken = login.body.data.tokens.refreshToken;

    const firstRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(firstRefresh.status).toBe(200);

    // Reusing the already-rotated (now-revoked) refresh token must be treated as compromise.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(replay.status).toBe(401);

    // The rotated token issued by the first refresh should now be revoked too.
    const secondRefreshToken = firstRefresh.body.data.tokens.refreshToken;
    const afterCompromise = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: secondRefreshToken });
    expect(afterCompromise.status).toBe(401);
  });

  it('resets a forgotten MPIN via OTP', async () => {
    await registerVerifyAndSetMpin('9000000004', '284759');

    const forgot = await request(app).post('/api/v1/auth/app/mpin/forgot').send({ mobile: '9000000004' });
    expect(forgot.status).toBe(200);
    const code = lastOtpCode();

    const reset = await request(app).post('/api/v1/auth/app/mpin/reset').send({
      mobile: '9000000004',
      code,
      newMpin: '619284',
      confirmNewMpin: '619284',
    });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9000000004', mpin: '284759' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9000000004', mpin: '619284' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects activation for a mobile number the admin never provisioned', async () => {
    const res = await request(app).post('/api/v1/auth/app/activate').send({ mobile: '9111111111' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Please use the registered mobile number');
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('rejects login for a mobile number the admin never provisioned', async () => {
    const res = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9111111112', mpin: '123456' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Please use the registered mobile number');
  });

  it('refuses to re-activate an account that already has an MPIN', async () => {
    await registerVerifyAndSetMpin('9000000006');
    const res = await request(app).post('/api/v1/auth/app/activate').send({ mobile: '9000000006' });
    expect(res.status).toBe(409);
  });

  it('enforces RBAC on the admin user-management route', async () => {
    const setup = await registerVerifyAndSetMpin('9000000005');
    const staffToken = setup.body.data.tokens.accessToken;

    const staffAttempt = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(staffAttempt.status).toBe(403);

    const adminMpinHash = await hashSecret('735829');
    const adminAccount = await fake.client.authAccount.create({
      data: {
        email: 'admin@example.com',
        phone: '9000000099',
        mpinHash: adminMpinHash,
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        adminProfile: { create: { firstName: 'Root', lastName: 'Admin' } },
      },
    });
    await fake.client.userRole.create({ data: { authAccountId: adminAccount.id, roleId: roles.ADMIN.id } });

    const adminLogin = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9000000099', mpin: '735829' });
    expect(adminLogin.status).toBe(200);

    const adminAttempt = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminLogin.body.data.tokens.accessToken}`);
    expect(adminAttempt.status).toBe(200);
    expect(Array.isArray(adminAttempt.body.data)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// The staff app is for the shop's own people. A customer who signed up on
// the storefront has an AuthAccount with a phone number just like a staff
// member does, so every door into this app has to check for a staff role —
// not just the login one.
// ─────────────────────────────────────────────────────────────────
describe('staff app is closed to customers', () => {
  const createCustomer = async (mobile: string, mpin = '284759') => {
    const account = await fake.client.authAccount.create({
      data: {
        phone: mobile,
        email: `${mobile}@shopper.example.com`,
        mpinHash: await hashSecret(mpin),
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        userProfile: { create: { firstName: 'Shop', lastName: 'Per' } },
      },
    });
    await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.CUSTOMER.id } });
    return account;
  };

  it('refuses a customer who signs in with the right mobile and MPIN', async () => {
    await createCustomer('9100000001');

    const login = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9100000001', mpin: '284759', platform: 'android' });

    expect(login.status).toBe(404);
    // Same wording an unknown number gets — saying "you exist but you're not
    // staff" would confirm the account to anyone holding the number.
    expect(login.body.message).toBe('Please use the registered mobile number');
  });

  it('refuses to send a customer an activation OTP', async () => {
    await createCustomer('9100000002');

    const activate = await request(app).post('/api/v1/auth/app/activate').send({ mobile: '9100000002' });

    expect(activate.status).toBe(404);
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('refuses to send a customer an MPIN reset OTP', async () => {
    await createCustomer('9100000003');

    const forgot = await request(app).post('/api/v1/auth/app/mpin/forgot').send({ mobile: '9100000003' });

    expect(forgot.status).toBe(404);
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('still lets an invited staff member in, including one who also shops on the storefront', async () => {
    const account = await fake.client.authAccount.create({
      data: {
        phone: '9100000004',
        email: '9100000004@example.com',
        mpinHash: await hashSecret('284759'),
        mpinSetAt: new Date(),
        status: 'active',
        phoneVerifiedAt: new Date(),
        adminProfile: { create: { firstName: 'Dual', lastName: 'Role' } },
      },
    });
    await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.CUSTOMER.id } });
    await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.STAFF.id } });

    const login = await request(app)
      .post('/api/v1/auth/app/login')
      .send({ mobile: '9100000004', mpin: '284759', platform: 'android' });

    expect(login.status).toBe(200);
    expect(login.body.data.user.roles).toEqual(expect.arrayContaining(['STAFF']));
  });
});
