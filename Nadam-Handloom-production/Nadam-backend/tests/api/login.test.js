import { describe, it, expect } from 'vitest';
import { api, prisma, makeAccount, newDevice, newMobile, trustDevice } from '../support/helpers.js';

const login = (mobile, pin, device) => api().post('/api/v2/auth/login').send({ mobile, pin, device });
const pastLock = (id) => prisma.authAccount.update({ where: { id }, data: { lockedUntil: new Date(Date.now() - 1000) } });

describe('daily sign-in (plan 4.2)', () => {
  it('signs in on a trusted device with the right PIN', async () => {
    const acc = await makeAccount({ role: 'ADMIN' });
    const device = newDevice();
    await trustDevice(acc, device);
    const r = await login(acc.mobile, acc.pin, device);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'signed_in', accessTokenExpiresIn: 900, user: { role: 'owner' } });
    expect(r.body.refreshToken.length).toBeGreaterThan(40);
    const days = (new Date(r.body.sessionExpiresAt) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
  });

  it('wrong PIN: tries left count down, then a 15-minute lock', async () => {
    const acc = await makeAccount();
    const device = newDevice();
    for (const left of [4, 3, 2, 1]) {
      const r = await login(acc.mobile, '999999', device);
      expect(r.status).toBe(401);
      expect(r.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS', details: { triesLeft: left, nextLockMinutes: 15 } });
    }
    const locked = await login(acc.mobile, '999999', device);
    expect(locked.status).toBe(423);
    expect(locked.body.error.details).toMatchObject({ lockCount: 1, lockMinutes: 15, nextLockMinutes: 30 });
    // Even the right PIN is refused while locked
    expect((await login(acc.mobile, acc.pin, device)).status).toBe(423);
  });

  it('after a lock ends there are 5 fresh tries, and the next lock is 30 then 60 minutes', async () => {
    const acc = await makeAccount();
    const device = newDevice();
    for (const expected of [15, 30, 60, 60]) {
      for (let i = 0; i < 4; i++) expect((await login(acc.mobile, '999999', device)).status).toBe(401);
      const r = await login(acc.mobile, '999999', device);
      expect(r.status).toBe(423);
      expect(r.body.error.details.lockMinutes).toBe(expected);
      await pastLock(acc.id);
    }
  });

  it('a successful sign-in resets the lock steps', async () => {
    const acc = await makeAccount();
    const device = newDevice();
    await trustDevice(acc, device);
    for (let i = 0; i < 5; i++) await login(acc.mobile, '999999', device);
    await pastLock(acc.id);
    expect((await login(acc.mobile, acc.pin, device)).body.status).toBe('signed_in');
    const saved = await prisma.authAccount.findUnique({ where: { id: acc.id } });
    expect(saved).toMatchObject({ failedLoginAttempts: 0, lockCount: 0, lockedUntil: null });
  });

  it('unknown numbers get exactly the same replies, including the lock', async () => {
    const m = newMobile();
    const device = newDevice();
    for (const left of [4, 3, 2, 1]) expect((await login(m, '246810', device)).body.error.details.triesLeft).toBe(left);
    const r = await login(m, '246810', device);
    expect(r.status).toBe(423);
    expect(r.body.error.details.lockMinutes).toBe(15);
  });

  it('removed staff and not-yet-set-up accounts get the generic reply', async () => {
    const removed = await makeAccount({ role: 'CUSTOMER' });
    const pending = await makeAccount({ status: 'pending', pin: null });
    for (const a of [removed, pending]) {
      const r = await login(a.mobile, '135792', newDevice());
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('a correct PIN on a new phone needs an SMS code first (plan 4.3)', async () => {
    const acc = await makeAccount();
    const device = newDevice('android');
    const r1 = await login(acc.mobile, acc.pin, device);
    expect(r1.body).toMatchObject({ status: 'verify_device' });
    expect(r1.body.mobileMasked).toContain('•••');
    expect(r1.body.accessToken).toBeUndefined();

    const r2 = await api().post('/api/v2/auth/device/request-code').send({ stepToken: r1.body.stepToken });
    expect(r2.status).toBe(202);
    const r3 = await api().post('/api/v2/auth/device/verify-code').send({ stepToken: r1.body.stepToken, code: r2.body.devCode, device });
    expect(r3.body.status).toBe('signed_in');
    expect(await prisma.trustedDevice.count({ where: { authAccountId: acc.id, deviceId: device.id, revokedAt: null } })).toBe(1);
    // Next time: no SMS
    expect((await login(acc.mobile, acc.pin, device)).body.status).toBe('signed_in');
  });

  it('old 4-digit PIN: signs in once, then must set a 6-digit PIN (plan 4.6)', async () => {
    const acc = await makeAccount({ pin: '1357' });
    const device = newDevice();
    await trustDevice(acc, device);
    const r1 = await login(acc.mobile, '1357', device);
    expect(r1.body.status).toBe('upgrade_pin');
    const r2 = await api().post('/api/v2/auth/pin/set').send({ stepToken: r1.body.stepToken, pin: '482916', device });
    expect(r2.body.status).toBe('signed_in');
    expect((await login(acc.mobile, '1357', device)).status).toBe(401);
    expect((await login(acc.mobile, '482916', device)).body.status).toBe('signed_in');
  });

  it('old 4-digit PIN on a new phone: SMS check first, then the upgrade', async () => {
    const acc = await makeAccount({ pin: '1357' });
    const device = newDevice();
    const r1 = await login(acc.mobile, '1357', device);
    expect(r1.body.status).toBe('verify_device');
    const r2 = await api().post('/api/v2/auth/device/request-code').send({ stepToken: r1.body.stepToken });
    const r3 = await api().post('/api/v2/auth/device/verify-code').send({ stepToken: r1.body.stepToken, code: r2.body.devCode, device });
    expect(r3.body.status).toBe('upgrade_pin');
    const r4 = await api().post('/api/v2/auth/pin/set').send({ stepToken: r3.body.stepToken, pin: '482916', device });
    expect(r4.body.status).toBe('signed_in');
  });

  it('records sign-in events in the audit trail', async () => {
    const acc = await makeAccount();
    const device = newDevice();
    await trustDevice(acc, device);
    await login(acc.mobile, '999999', device);
    await login(acc.mobile, acc.pin, device);
    const types = (await prisma.authEvent.findMany({ where: { authAccountId: acc.id }, orderBy: { createdAt: 'asc' } })).map((e) => e.eventType);
    expect(types).toEqual(['login_failed', 'login_success']);
  });
});
