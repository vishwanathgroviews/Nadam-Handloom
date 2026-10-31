import { describe, it, expect } from 'vitest';
import { api, prisma, makeAccount, newDevice, newMobile, forgetCodeLimits } from '../support/helpers.js';

const requestCode = (mobile) => api().post('/api/v2/auth/setup/request-code').send({ mobile });
const verify = (mobile, code, deviceId) => api().post('/api/v2/auth/setup/verify-code').send({ mobile, code, deviceId });
const setPin = (stepToken, pin, device) => api().post('/api/v2/auth/pin/set').send({ stepToken, pin, device });

describe('first-time setup (plan 4.1)', () => {
  it('invited staff: code, then PIN, then signed in on a trusted device', async () => {
    const acc = await makeAccount({ status: 'pending', pin: null });
    const device = newDevice();
    const r1 = await requestCode(acc.mobile);
    expect(r1.status).toBe(202);
    expect(r1.body).toMatchObject({ resendInSeconds: 60, expiresInSeconds: 60 });
    expect(r1.body.devCode).toMatch(/^\d{6}$/);

    const r2 = await verify(acc.mobile, r1.body.devCode, device.id);
    expect(r2.status).toBe(200);
    expect(r2.body.next).toBe('set_pin');

    const r3 = await setPin(r2.body.stepToken, '482916', device);
    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe('signed_in');
    expect(r3.body.user).toMatchObject({ role: 'staff', mobile: acc.mobile });
    expect(r3.body.device).toMatchObject({ deviceId: device.id, isCurrent: true, biometricEnabled: false });

    const saved = await prisma.authAccount.findUnique({ where: { id: acc.id } });
    expect(saved.status).toBe('active');
    expect(saved.mpinHash).toMatch(/^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
    expect(await prisma.trustedDevice.count({ where: { authAccountId: acc.id, revokedAt: null } })).toBe(1);
  });

  it('gives the same reply for an unknown number and sends nothing', async () => {
    const r = await requestCode(newMobile());
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ resendInSeconds: 60, expiresInSeconds: 60 });
  });

  it('does not send codes to removed staff (no Owner/Staff role)', async () => {
    const acc = await makeAccount({ role: 'CUSTOMER', status: 'pending', pin: null });
    const r = await requestCode(acc.mobile);
    expect(r.body.devCode).toBeUndefined();
  });

  it('an already set-up number gets a code, then "already set up" with a reset step', async () => {
    const acc = await makeAccount();
    const device = newDevice();
    const r1 = await requestCode(acc.mobile);
    const r2 = await verify(acc.mobile, r1.body.devCode, device.id);
    expect(r2.body.next).toBe('already_set_up');
    const r3 = await setPin(r2.body.stepToken, '573910', device);
    expect(r3.body.status).toBe('signed_in');
  });

  it('wrong code: 2 tries left, then 1, then used up', async () => {
    const acc = await makeAccount({ status: 'pending', pin: null });
    const r1 = await requestCode(acc.mobile);
    const wrong = r1.body.devCode === '000000' ? '111111' : '000000';
    const a = await verify(acc.mobile, wrong, 'device-12345');
    expect(a.status).toBe(400);
    expect(a.body.error).toMatchObject({ code: 'WRONG_CODE', details: { triesLeft: 2 } });
    expect((await verify(acc.mobile, wrong, 'device-12345')).body.error.details.triesLeft).toBe(1);
    expect((await verify(acc.mobile, wrong, 'device-12345')).body.error.code).toBe('CODE_USED_UP');
    expect((await verify(acc.mobile, r1.body.devCode, 'device-12345')).body.error.code).toBe('CODE_USED_UP');
  });

  it('unknown numbers count wrong codes the same way', async () => {
    const m = newMobile();
    await requestCode(m);
    expect((await verify(m, '123456', 'device-12345')).body.error).toMatchObject({ code: 'WRONG_CODE', details: { triesLeft: 2 } });
    expect((await verify(m, '123456', 'device-12345')).body.error.details.triesLeft).toBe(1);
    expect((await verify(m, '123456', 'device-12345')).body.error.code).toBe('CODE_USED_UP');
  });

  it('an expired code is refused', async () => {
    const acc = await makeAccount({ status: 'pending', pin: null });
    const r1 = await requestCode(acc.mobile);
    await prisma.otpCode.updateMany({ where: { authAccountId: acc.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await verify(acc.mobile, r1.body.devCode, 'device-12345')).body.error.code).toBe('CODE_EXPIRED');
  });

  it('a new code cancels the old one', async () => {
    const acc = await makeAccount({ status: 'pending', pin: null });
    const first = await requestCode(acc.mobile);
    await forgetCodeLimits(acc.mobile);
    const second = await requestCode(acc.mobile);
    if (first.body.devCode !== second.body.devCode) {
      expect((await verify(acc.mobile, first.body.devCode, 'device-12345')).body.error.code).toBe('WRONG_CODE');
    }
    expect((await verify(acc.mobile, second.body.devCode, 'device-12345')).body.next).toBe('set_pin');
  });

  it('resend waits 60 seconds, for every number', async () => {
    for (const m of [newMobile(), (await makeAccount({ status: 'pending', pin: null })).mobile]) {
      await requestCode(m);
      const again = await requestCode(m);
      expect(again.status).toBe(429);
      expect(again.body.error.code).toBe('CODE_RESEND_WAIT');
      expect(again.body.error.details.retryAfterSeconds).toBeGreaterThan(50);
      expect(again.headers['retry-after']).toBeDefined();
    }
  });

  it('at most 5 codes an hour', async () => {
    const m = newMobile();
    const bucket = `v2-code:${m}`;
    for (let i = 0; i < 5; i++) await prisma.rateLimitHit.create({ data: { bucketKey: bucket, createdAt: new Date(Date.now() - (50 - i) * 60_000) } });
    const r = await requestCode(m);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('CODE_TOO_MANY');
    expect(r.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it('refuses weak PINs with the exact rule', async () => {
    const acc = await makeAccount({ mobile: '9123000003', status: 'pending', pin: null });
    const device = newDevice();
    const r1 = await requestCode(acc.mobile);
    const { stepToken } = (await verify(acc.mobile, r1.body.devCode, device.id)).body;
    for (const [pin, problem] of [['111111', 'all_same'], ['123456', 'sequence'], ['000003', 'mobile_tail'], ['12345', null]]) {
      const r = await setPin(stepToken, pin, device);
      expect(r.status).toBe(400);
      if (problem) expect(r.body.error.details.problems).toContain(problem);
    }
  });

  it('the step token only works on the phone that verified the code', async () => {
    const acc = await makeAccount({ status: 'pending', pin: null });
    const device = newDevice();
    const r1 = await requestCode(acc.mobile);
    const { stepToken } = (await verify(acc.mobile, r1.body.devCode, device.id)).body;
    const r = await setPin(stepToken, '482916', newDevice());
    expect(r.body.error.code).toBe('STEP_EXPIRED');
  });

  it('a used step token cannot set the PIN twice', async () => {
    const acc = await makeAccount({ status: 'pending', pin: null });
    const device = newDevice();
    const r1 = await requestCode(acc.mobile);
    const { stepToken } = (await verify(acc.mobile, r1.body.devCode, device.id)).body;
    expect((await setPin(stepToken, '482916', device)).body.status).toBe('signed_in');
    expect((await setPin(stepToken, '573910', device)).body.error.code).toBe('STEP_EXPIRED');
  });
});
