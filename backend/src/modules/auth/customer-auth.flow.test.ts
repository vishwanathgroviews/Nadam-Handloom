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
const sendOtpMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;

const lastOtpCode = (): string => {
  const call = sendOtpMock.mock.calls[sendOtpMock.mock.calls.length - 1];
  return call[1];
};

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  seedRoles(fake.db);
  sendOtpMock.mockClear();
});

const registerPayload = (overrides: Record<string, string>) => ({
  firstName: 'Jane',
  lastName: 'Doe',
  state: 'Telangana',
  pincode: '500001',
  ...overrides,
});

// Registers, verifies the signup OTP, and sets an MPIN — the full path to a
// usable customer session, mirroring app-auth.flow.test.ts's equivalent helper.
const registerVerifyAndSetMpin = async (phone: string, mpin = '284759') => {
  await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone }));
  const code = lastOtpCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setupToken = verify.body.data.setupToken;
  return request(app).post('/api/v1/auth/customer/mpin/setup').send({ setupToken, mpin, confirmMpin: mpin });
};

describe('customer auth flow', () => {
  it('registers, verifies OTP, sets an MPIN, and logs in with it, accessing a protected route', async () => {
    const setup = await registerVerifyAndSetMpin('9876543210');
    expect(setup.status).toBe(200);
    expect(setup.body.data.tokens.accessToken).toBeTruthy();

    const login = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9876543210', mpin: '284759' });
    expect(login.status).toBe(200);
    expect(login.body.data.tokens.accessToken).toBeTruthy();

    const loginEvent = fake.db.authEvent.find((e: any) => e.eventType === 'login_success');
    expect(loginEvent?.source).toBe('customer_web');

    const setCookie = login.headers['set-cookie'];
    expect(setCookie).toBeTruthy();

    const accessToken = login.body.data.tokens.accessToken;
    const profile = await request(app).get('/api/v1/user/profile').set('Authorization', `Bearer ${accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.mpinHash).toBeUndefined();

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', setCookie);
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.tokens.accessToken).toBeTruthy();

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', refresh.headers['set-cookie']);
    expect(logout.status).toBe(200);
  });

  it('locks the account after 5 wrong MPIN attempts', async () => {
    await registerVerifyAndSetMpin('9876500000');

    for (let i = 0; i < 5; i++) {
      // Isolate account-lockout behavior from the route's own IP rate limit
      // (covered separately in rateLimit.middleware.test.ts).
      fake.db.rateLimitHit = [];
      const res = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9876500000', mpin: '000000' });
      expect(res.status).toBe(401);
    }

    fake.db.rateLimitHit = [];
    const lockedAttempt = await request(app)
      .post('/api/v1/auth/customer/login')
      .send({ phone: '9876500000', mpin: '284759' });
    expect(lockedAttempt.status).toBe(401);
    expect(lockedAttempt.body.message).toMatch(/locked/i);
  });

  it('rejects an invalid OTP code', async () => {
    await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone: '9876511111' }));

    const res = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: '9876511111', code: '000001' });
    expect(res.status).toBe(400);
  });

  it('rate-limits repeated registration attempts from the same IP', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone: `98765000${i}${i}` }));
      expect(res.status).toBe(201);
    }

    const sixth = await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone: '9876509999' }));
    expect(sixth.status).toBe(429);
  });

  it('blocks login before OTP verification / MPIN setup', async () => {
    await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone: '9876522222' }));

    const res = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9876522222', mpin: '284759' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_NOT_VERIFIED');
  });

  it('rejects a login attempt for an unregistered phone number', async () => {
    const res = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9111111111', mpin: '284759' });
    expect(res.status).toBe(401);
  });

  it('refuses to replay an already-used setup token', async () => {
    await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone: '9876533333' }));
    const code = lastOtpCode();
    const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone: '9876533333', code });
    const setupToken = verify.body.data.setupToken;

    const firstSetup = await request(app)
      .post('/api/v1/auth/customer/mpin/setup')
      .send({ setupToken, mpin: '284759', confirmMpin: '284759' });
    expect(firstSetup.status).toBe(200);

    const replay = await request(app)
      .post('/api/v1/auth/customer/mpin/setup')
      .send({ setupToken, mpin: '619284', confirmMpin: '619284' });
    expect(replay.status).toBe(409);
  });

  it('resets a forgotten MPIN via OTP sent to the registered phone, revoking existing sessions', async () => {
    await registerVerifyAndSetMpin('9876544444');
    const login = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9876544444', mpin: '284759' });
    const setCookie = login.headers['set-cookie'];

    const forgot = await request(app).post('/api/v1/auth/customer/mpin/forgot').send({ phone: '9876544444' });
    expect(forgot.status).toBe(200);
    const resetCode = lastOtpCode();

    const reset = await request(app).post('/api/v1/auth/customer/mpin/reset').send({
      phone: '9876544444',
      code: resetCode,
      newMpin: '619284',
      confirmNewMpin: '619284',
    });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9876544444', mpin: '284759' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/v1/auth/customer/login').send({ phone: '9876544444', mpin: '619284' });
    expect(newLogin.status).toBe(200);

    // The pre-reset session's refresh cookie must no longer work.
    const refreshOldSession = await request(app).post('/api/v1/auth/refresh').set('Cookie', setCookie);
    expect(refreshOldSession.status).toBe(401);
  });

  it('stays silent when requesting an MPIN reset for an unregistered phone', async () => {
    const res = await request(app).post('/api/v1/auth/customer/mpin/forgot').send({ phone: '9999900000' });
    expect(res.status).toBe(200);
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('stays silent requesting an MPIN reset for a phone that registered but never completed setup', async () => {
    await request(app).post('/api/v1/auth/customer/register').send(registerPayload({ phone: '9876555555' }));
    sendOtpMock.mockClear();

    const res = await request(app).post('/api/v1/auth/customer/mpin/forgot').send({ phone: '9876555555' });
    expect(res.status).toBe(200);
    expect(sendOtpMock).not.toHaveBeenCalled();
  });
});
