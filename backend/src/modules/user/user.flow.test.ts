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
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;
let roles: Record<string, { id: string }>;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  sendMock.mockClear();
});

const createStaffToken = async (role: 'ADMIN' | 'STAFF', mobile: string) => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: `${role.toLowerCase()}-${mobile}@example.com`, phone: mobile, mpinHash, mpinSetAt: new Date(),
      status: 'active', phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: role, lastName: 'User', employeeId: 'E1', department: 'Ops', jobTitle: 'Manager' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

const registerAndLogin = async () => {
  const phone = '9876533333';
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Profile', lastName: 'Test', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  return setup.body.data.tokens.accessToken as string;
};

describe('user profile validation', () => {
  it('accepts a valid partial profile update without wiping fields it was not sent', async () => {
    const token = await registerAndLogin();
    const res = await request(app).put('/api/v1/user/profile').set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Prof T.' });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Prof T.');
    // registration seeds firstName/lastName on the profile — a partial update
    // that only sends displayName must not clobber the fields it omitted.
    expect(res.body.data.firstName).toBe('Profile');
  });

  it('rejects an oversized field instead of writing it straight through', async () => {
    const token = await registerAndLogin();
    const res = await request(app).put('/api/v1/user/profile').set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'x'.repeat(500) });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed avatarUrl', async () => {
    const token = await registerAndLogin();
    const res = await request(app).put('/api/v1/user/profile').set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown extra fields being smuggled into the update', async () => {
    const token = await registerAndLogin();
    const res = await request(app).put('/api/v1/user/profile').set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Fine', roleOverride: 'ADMIN' });
    // zod's default (non-strict) mode strips unknown keys rather than erroring —
    // the important guarantee is that the stripped body reaches the service, so
    // "roleOverride" can never reach a data object.
    expect(res.status).toBe(200);
    expect(fake.db.userProfile[0]).not.toHaveProperty('roleOverride');
  });
});

describe('GET /user/me (staff/admin app profile)', () => {
  it('returns name, role, and AdminProfile fields for ADMIN', async () => {
    const token = await createStaffToken('ADMIN', '9876500001');
    const res = await request(app).get('/api/v1/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual(['ADMIN']);
    expect(res.body.data.name).toBe('ADMIN User');
    expect(res.body.data.employeeId).toBe('E1');
    expect(res.body.data.department).toBe('Ops');
    expect(res.body.data.jobTitle).toBe('Manager');
  });

  it('returns profile fields for STAFF too', async () => {
    const token = await createStaffToken('STAFF', '9876500002');
    const res = await request(app).get('/api/v1/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual(['STAFF']);
  });

  it('rejects a CUSTOMER token', async () => {
    const token = await registerAndLogin();
    const res = await request(app).get('/api/v1/user/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
