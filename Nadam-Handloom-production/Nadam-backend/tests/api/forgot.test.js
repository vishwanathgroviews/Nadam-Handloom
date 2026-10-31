import { describe, it, expect } from 'vitest';
import { api, prisma, signedIn, signIn, trustDevice, newDevice, newMobile, phoneKeys, authed, makeAccount } from '../support/helpers.js';

const request = (mobile) => api().post('/api/v2/auth/forgot/request-code').send({ mobile });
const verify = (mobile, code, deviceId) => api().post('/api/v2/auth/forgot/verify-code').send({ mobile, code, deviceId });
const setPin = (stepToken, pin, device) => api().post('/api/v2/auth/pin/set').send({ stepToken, pin, device });

describe('Forgot PIN (plan 4.5)', () => {
  it('resets the PIN, signs in here, clears the lock, signs out every other device', async () => {
    const { account, device: oldPhone, session } = await signedIn();
    const keys = phoneKeys();
    await authed('post', '/api/v2/me/biometric', session, oldPhone).send({ publicKey: keys.publicKey });
    await prisma.authAccount.update({ where: { id: account.id }, data: { lockedUntil: new Date(Date.now() + 600_000), lockCount: 2 } });

    const here = newDevice();
    const r1 = await request(account.mobile);
    const r2 = await verify(account.mobile, r1.body.devCode, here.id);
    expect(r2.body.next).toBe('set_pin');
    const r3 = await setPin(r2.body.stepToken, '573910', here);
    expect(r3.body).toMatchObject({ status: 'signed_in', othersSignedOut: 1 });

    const saved = await prisma.authAccount.findUnique({ where: { id: account.id } });
    expect(saved).toMatchObject({ lockedUntil: null, lockCount: 0, failedLoginAttempts: 0 });
    // the old phone: signed out, no longer trusted, Face ID key gone
    expect((await authed('get', '/api/v2/me', session, oldPhone)).body.error.code).toBe('PIN_CHANGED');
    const old = await prisma.trustedDevice.findFirst({ where: { authAccountId: account.id, deviceId: oldPhone.id } });
    expect(old.revokedAt).not.toBeNull();
    expect(old.biometricPublicKey).toBeNull();
    // the old phone now needs the SMS check again
    expect((await api().post('/api/v2/auth/login').send({ mobile: account.mobile, pin: '573910', device: oldPhone })).body.status).toBe('verify_device');
  });

  it('same generic reply for unknown and not-set-up numbers; no code sent', async () => {
    const pending = await makeAccount({ status: 'pending', pin: null });
    for (const m of [newMobile(), pending.mobile]) {
      const r = await request(m);
      expect(r.status).toBe(202);
      expect(r.body).toEqual({ resendInSeconds: 60, expiresInSeconds: 60 });
    }
  });

  it('the reset can reuse a trusted phone without a new SMS check', async () => {
    const account = await makeAccount();
    const phone = newDevice();
    await trustDevice(account, phone);
    const r1 = await request(account.mobile);
    const r2 = await verify(account.mobile, r1.body.devCode, phone.id);
    const r3 = await setPin(r2.body.stepToken, '573910', phone);
    expect(r3.body).toMatchObject({ status: 'signed_in', othersSignedOut: 0 });
    expect((await signIn({ ...account, pin: '573910' }, phone)).status).toBe('signed_in');
  });
});
