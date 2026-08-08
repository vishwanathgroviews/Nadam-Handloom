import { describe, it, expect, beforeAll } from 'vitest';
import { vi } from 'vitest';
import request from 'supertest';

declare global {
  // eslint-disable-next-line no-var
  var __testEmails: { to: string; body: string; kind: string }[];
}
globalThis.__testEmails = [];

vi.mock('./modules/auth/email.service', () => {
  const capture = (kind: string) => async (to: string, body: string) => {
    globalThis.__testEmails.push({ to, body, kind });
  };
  return {
    sendOtpEmail: capture('otp'),
    sendPasswordResetEmail: capture('passwordReset'),
    sendInviteEmail: capture('invite'),
    sendEmail: async () => {},
  };
});

vi.mock('./config/prisma', async () => {
  const { createFakePrisma } = await import('./test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.prisma, __fake: fake };
});

// IP-based rate limiting is exercised by rateLimiter's own unit test; disabling it
// here keeps these flow tests (which issue many /login calls from the same IP)
// independent of that shared, module-level in-memory counter.
vi.mock('./middleware/rateLimiter', () => ({
  rateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const PASSWORD = 'Str0ng!Pass';

const lastEmail = (to: string, kind: string) => {
  const matches = globalThis.__testEmails.filter((e) => e.to === to && e.kind === kind);
  const match = matches[matches.length - 1];
  if (!match) throw new Error(`No captured '${kind}' email found for ${to}`);
  return match;
};

describe('auth API (integration)', () => {
  let app: import('express').Express;
  let fake: any;

  beforeAll(async () => {
    ({ app } = await import('./app'));
    ({ __fake: fake } = (await import('./config/prisma')) as any);
  });

  it('registers, verifies OTP, and logs in a customer (no MFA)', async () => {
    const email = 'customer1@example.com';

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, firstName: 'Jane', lastName: 'Doe' });
    expect(registerRes.status).toBe(201);

    const code = lastEmail(email, 'otp').body;
    expect(code).toMatch(/^\d{6}$/);

    const verifyRes = await request(app).post('/api/v1/auth/otp/verify').send({ email, code });
    expect(verifyRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, platform: 'web' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.headers['set-cookie']).toBeDefined();
  });

  it('locks the account after 5 failed login attempts', async () => {
    const email = 'lockout@example.com';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, firstName: 'Ann', lastName: 'Bell' });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPass1!', platform: 'web' });
    }

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, platform: 'web' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/i);
  });

  it('requires MFA for ADMIN accounts and completes login via otp/verify', async () => {
    const { AuthService } = await import('./modules/auth/auth.service');
    const email = 'admin1@example.com';
    const passwordHash = await AuthService.hashPassword(PASSWORD);

    await fake.prisma.authAccount.create({
      data: { email, passwordHash, roles: { create: { roleId: fake._internal.adminRole.id } } },
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, platform: 'web' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.mfaRequired).toBe(true);
    expect(loginRes.body.mfaToken).toBeDefined();
    expect(loginRes.headers['set-cookie']).toBeUndefined();

    const code = lastEmail(email, 'otp').body;
    const verifyRes = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ mfaToken: loginRes.body.mfaToken, code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.accessToken).toBeDefined();
  });

  it('enforces RBAC on POST /api/v1/admin/users', async () => {
    // Customer token should be forbidden.
    const customerEmail = 'rbac-customer@example.com';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: customerEmail, password: PASSWORD, firstName: 'Ann', lastName: 'Bell' });
    const customerCode = lastEmail(customerEmail, 'otp').body;
    await request(app).post('/api/v1/auth/otp/verify').send({ email: customerEmail, code: customerCode });
    const customerLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: PASSWORD, platform: 'web' });

    const forbiddenRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${customerLogin.body.accessToken}`)
      .send({ email: 'newstaff@example.com', firstName: 'Sam', lastName: 'Tan', roleId: fake._internal.staffRole.id });
    expect(forbiddenRes.status).toBe(403);

    // Admin token should succeed.
    const { AuthService } = await import('./modules/auth/auth.service');
    const adminEmail = 'rbac-admin@example.com';
    const passwordHash = await AuthService.hashPassword(PASSWORD);
    await fake.prisma.authAccount.create({
      data: { email: adminEmail, passwordHash, roles: { create: { roleId: fake._internal.adminRole.id } } },
    });
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: PASSWORD, platform: 'web' });
    const adminMfaCode = lastEmail(adminEmail, 'otp').body;
    const adminVerify = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ mfaToken: adminLogin.body.mfaToken, code: adminMfaCode });

    const allowedRes = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminVerify.body.accessToken}`)
      .send({ email: 'newstaff2@example.com', firstName: 'Sam', lastName: 'Tan', roleId: fake._internal.staffRole.id });
    expect(allowedRes.status).toBe(201);
  });

  it('rotates refresh tokens and revokes the whole session family on reuse', async () => {
    const email = 'refresh1@example.com';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, firstName: 'Ann', lastName: 'Bell' });
    const code = lastEmail(email, 'otp').body;
    await request(app).post('/api/v1/auth/otp/verify').send({ email, code });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, platform: 'web' });
    const originalCookie = loginRes.headers['set-cookie'];

    const refresh1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(refresh1.status).toBe(200);
    const rotatedCookie = refresh1.headers['set-cookie'];

    // Replaying the original (already-rotated) token must be rejected.
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(reuse.status).toBe(401);

    // Reuse detection revokes the whole session family, including the freshly-rotated one.
    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', rotatedCookie);
    expect(afterReuse.status).toBe(401);
  });

  it('password reset invalidates previously-issued access tokens', async () => {
    const email = 'resetme@example.com';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD, firstName: 'Ann', lastName: 'Bell' });
    const code = lastEmail(email, 'otp').body;
    await request(app).post('/api/v1/auth/otp/verify').send({ email, code });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, platform: 'web' });
    const oldAccessToken = loginRes.body.accessToken;

    // Sanity: the pre-reset token currently works against a protected route.
    const preCheck = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${oldAccessToken}`);
    expect(preCheck.status).toBe(200);

    // Issue a second token that we'll actually test post-reset (logout doesn't invalidate the JWT itself).
    const loginRes2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, platform: 'web' });
    const accessToken = loginRes2.body.accessToken;

    await request(app).post('/api/v1/auth/password-reset/request').send({ email });
    const resetToken = lastEmail(email, 'passwordReset').body;
    expect(resetToken).toBeTruthy();

    const confirmRes = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: resetToken, newPassword: 'N3wStr0ng!Pass' });
    expect(confirmRes.status).toBe(200);

    const postResetCheck = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(postResetCheck.status).toBe(401);
  });
});
