import { describe, it, expect } from 'vitest';
import { api, prisma, signedIn, authed, newDevice, phoneKeys } from '../support/helpers.js';

const refresh = (token, deviceId) => api().post('/api/v2/auth/refresh').set('x-device-id', deviceId).send({ refreshToken: token });
const ago = (s) => new Date(Date.now() - s * 1000);

describe('staying signed in (plan 4.4, 8.1)', () => {
  it('renewal returns new keys and a fresh 7 days', async () => {
    const { session, device } = await signedIn();
    const r = await refresh(session.refreshToken, device.id);
    expect(r.status).toBe(200);
    expect(r.body.refreshToken).not.toBe(session.refreshToken);
    expect(r.body.accessToken).not.toBe(session.accessToken);
    expect((await authed('get', '/api/v2/me', r.body, device)).status).toBe(200);
  });

  it('a request with the previous access key after renewal gets "expired", not a sign-out', async () => {
    const { session, device } = await signedIn();
    await refresh(session.refreshToken, device.id);
    const r = await authed('get', '/api/v2/me', session, device);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });

  it('the old refresh key sent again within 10 s, after the new one was used, is a race (409)', async () => {
    const { session, device } = await signedIn();
    const newer = (await refresh(session.refreshToken, device.id)).body;
    expect((await authed('get', '/api/v2/me', newer, device)).status).toBe(200); // the new key is in use
    const r = await refresh(session.refreshToken, device.id);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('REFRESH_RACE');
  });

  it('a renewal whose reply was lost (weak Wi-Fi): the old key renews again, even an hour later; nobody is signed out', async () => {
    const { account, session, device } = await signedIn();
    const keys = phoneKeys();
    await authed('post', '/api/v2/me/biometric', session, device).send({ publicKey: keys.publicKey });
    const lost = (await refresh(session.refreshToken, device.id)).body; // the phone never got this
    await prisma.session.updateMany({ where: { authAccountId: account.id, revokeReason: 'rotated' }, data: { revokedAt: ago(3600) } });
    const again = await refresh(session.refreshToken, device.id);
    expect(again.status).toBe(200);
    expect(again.body.refreshToken).not.toBe(lost.refreshToken);
    expect((await authed('get', '/api/v2/me', again.body, device)).status).toBe(200);
    // the reply that never arrived is replaced; Face ID stays; no "copied key" alarm
    expect((await refresh(lost.refreshToken, device.id)).body.error.code).toBe('SESSION_INVALID');
    expect(await prisma.trustedDevice.count({ where: { authAccountId: account.id, biometricPublicKey: { not: null } } })).toBe(1);
    expect(await prisma.authEvent.count({ where: { authAccountId: account.id, eventType: 'refresh_token_reuse_detected' } })).toBe(0);
    expect(await prisma.authEvent.count({ where: { authAccountId: account.id, eventType: 'session_lost_reply_renewed' } })).toBe(1);
    expect((await refresh(again.body.refreshToken, device.id)).status).toBe(200);
  });

  it('a lost reply on a phone signed out meanwhile stays signed out', async () => {
    const { account, session, device } = await signedIn();
    await refresh(session.refreshToken, device.id);
    await prisma.session.updateMany({ where: { authAccountId: account.id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'device_signed_out' } });
    const r = await refresh(session.refreshToken, device.id);
    expect(r.body.error.code).toBe('SIGNED_OUT_REMOTELY');
  });

  it('an old refresh key used later, after the new one was used, means it was copied: every device is signed out for safety', async () => {
    const { account, session, device } = await signedIn();
    const keys = phoneKeys();
    await authed('post', '/api/v2/me/biometric', session, device).send({ publicKey: keys.publicKey });
    const newer = (await refresh(session.refreshToken, device.id)).body;
    expect((await authed('get', '/api/v2/me', newer, device)).status).toBe(200); // the new key is in use
    await prisma.session.updateMany({ where: { authAccountId: account.id, revokeReason: 'rotated' }, data: { revokedAt: ago(60) } });

    const r = await refresh(session.refreshToken, device.id);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('SIGNED_OUT_FOR_SAFETY');
    // the newest key is dead too, and Face ID keys are gone
    expect((await refresh(newer.refreshToken, device.id)).body.error.code).toBe('SIGNED_OUT_FOR_SAFETY');
    expect(await prisma.trustedDevice.count({ where: { authAccountId: account.id, biometricPublicKey: { not: null } } })).toBe(0);
    expect(await prisma.authEvent.count({ where: { authAccountId: account.id, eventType: 'refresh_token_reuse_detected' } })).toBe(1);
  });

  it('a refresh key used from a different phone is treated as theft', async () => {
    const { session } = await signedIn();
    const r = await refresh(session.refreshToken, newDevice().id);
    expect(r.body.error.code).toBe('SIGNED_OUT_FOR_SAFETY');
  });

  it('after 7 days without use the sign-in ends', async () => {
    const { account, session, device } = await signedIn();
    await prisma.session.updateMany({ where: { authAccountId: account.id }, data: { expiresAt: ago(1) } });
    const r = await refresh(session.refreshToken, device.id);
    expect(r.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('log out ends this session only', async () => {
    const { session, device } = await signedIn();
    expect((await api().post('/api/v2/auth/logout').send({ refreshToken: session.refreshToken })).status).toBe(204);
    expect((await refresh(session.refreshToken, device.id)).body.error.code).toBe('SESSION_INVALID');
    expect((await authed('get', '/api/v2/me', session, device)).body.error.code).toBe('SESSION_INVALID');
  });

  it('access removed by the owner shows ACCESS_REMOVED', async () => {
    const { account, session, device } = await signedIn();
    await prisma.userRole.deleteMany({ where: { authAccountId: account.id } });
    expect((await authed('get', '/api/v2/me', session, device)).body.error.code).toBe('ACCESS_REMOVED');
    expect((await refresh(session.refreshToken, device.id)).body.error.code).toBe('ACCESS_REMOVED');
  });

  it('a security-stamp change elsewhere (e.g. PIN reset in the old app) signs this phone out', async () => {
    const { account, session, device } = await signedIn();
    await prisma.authAccount.update({ where: { id: account.id }, data: { securityStamp: crypto.randomUUID() } });
    expect((await authed('get', '/api/v2/me', session, device)).body.error.code).toBe('PIN_CHANGED');
    expect((await refresh(session.refreshToken, device.id)).body.error.code).toBe('PIN_CHANGED');
  });

  it('rejects requests without a key, or with a key for another phone', async () => {
    const { session } = await signedIn();
    expect((await api().get('/api/v2/me')).body.error.code).toBe('SESSION_INVALID');
    expect((await authed('get', '/api/v2/me', session, newDevice())).body.error.code).toBe('SESSION_INVALID');
  });
});
