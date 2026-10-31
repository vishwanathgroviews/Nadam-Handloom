import { describe, it, expect } from 'vitest';
import { api, prisma, signedIn, authed, phoneKeys, newDevice } from '../support/helpers.js';

const challenge = (mobile, deviceId) => api().post('/api/v2/auth/biometric/challenge').send({ mobile, deviceId });
const bioLogin = (body) => api().post('/api/v2/auth/biometric/login').send(body);

async function withFaceId() {
  const ctx = await signedIn();
  const keys = phoneKeys();
  const r = await authed('post', '/api/v2/me/biometric', ctx.session, ctx.device).send({ publicKey: keys.publicKey });
  expect(r.body.biometricEnabled).toBe(true);
  return { ...ctx, keys };
}

describe('Face ID / fingerprint (plan 8.3)', () => {
  it('signs in with a signature from the phone key, even after logging out', async () => {
    const { account, device, session, keys } = await withFaceId();
    await api().post('/api/v2/auth/logout').send({ refreshToken: session.refreshToken });
    const c = await challenge(account.mobile, device.id);
    expect(c.status).toBe(200);
    expect(c.body.payload).toContain(device.id);
    const r = await bioLogin({ challengeId: c.body.challengeId, signature: keys.sign(c.body.payload), device });
    expect(r.body.status).toBe('signed_in');
    expect(await prisma.authEvent.count({ where: { authAccountId: account.id, eventType: 'login_success', metadata: { path: ['method'], equals: 'biometric' } } })).toBe(1);
  });

  it('a challenge works only once', async () => {
    const { account, device, keys } = await withFaceId();
    const c = await challenge(account.mobile, device.id);
    const sig = keys.sign(c.body.payload);
    expect((await bioLogin({ challengeId: c.body.challengeId, signature: sig, device })).body.status).toBe('signed_in');
    expect((await bioLogin({ challengeId: c.body.challengeId, signature: sig, device })).body.error.code).toBe('BIOMETRIC_INVALID');
  });

  it('rejects a signature from another key, an expired challenge, or another device', async () => {
    const { account, device, keys } = await withFaceId();
    const c1 = await challenge(account.mobile, device.id);
    expect((await bioLogin({ challengeId: c1.body.challengeId, signature: phoneKeys().sign(c1.body.payload), device })).body.error.code).toBe('BIOMETRIC_INVALID');

    const c2 = await challenge(account.mobile, device.id);
    await prisma.authChallenge.update({ where: { id: c2.body.challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await bioLogin({ challengeId: c2.body.challengeId, signature: keys.sign(c2.body.payload), device })).body.error.code).toBe('BIOMETRIC_INVALID');

    const c3 = await challenge(account.mobile, device.id);
    expect((await bioLogin({ challengeId: c3.body.challengeId, signature: keys.sign(c3.body.payload), device: newDevice() })).body.error.code).toBe('BIOMETRIC_INVALID');
  });

  it('refuses keys that are not EC P-256', async () => {
    const { session, device } = await signedIn();
    const r = await authed('post', '/api/v2/me/biometric', session, device).send({ publicKey: Buffer.alloc(120, 7).toString('base64') });
    expect(r.body.error.code).toBe('INVALID_PUBLIC_KEY');
  });

  it('is unavailable when turned off, when the device was signed out, or on an unknown device', async () => {
    const off = await withFaceId();
    await authed('delete', '/api/v2/me/biometric', off.session, off.device);
    expect((await challenge(off.account.mobile, off.device.id)).body.error.code).toBe('BIOMETRIC_UNAVAILABLE');

    const out = await withFaceId();
    await prisma.trustedDevice.updateMany({ where: { authAccountId: out.account.id }, data: { revokedAt: new Date() } });
    expect((await challenge(out.account.mobile, out.device.id)).body.error.code).toBe('BIOMETRIC_UNAVAILABLE');

    expect((await challenge(off.account.mobile, newDevice().id)).body.error.code).toBe('BIOMETRIC_UNAVAILABLE');
  });

  it('a locked account cannot sign in with Face ID either', async () => {
    const { account, device } = await withFaceId();
    await prisma.authAccount.update({ where: { id: account.id }, data: { lockedUntil: new Date(Date.now() + 600_000), lockCount: 1 } });
    expect((await challenge(account.mobile, device.id)).status).toBe(423);
  });
});
