import { describe, it, expect } from 'vitest';
import { api, prisma, signedIn, signIn, trustDevice, newDevice, authed } from '../support/helpers.js';

describe('my account (plan 4.7, 4.8)', () => {
  it('returns the person, this device and the sign-in expiry', async () => {
    const { session, device } = await signedIn({ role: 'ADMIN', name: 'Lakshmi' });
    const r = await authed('get', '/api/v2/me', session, device);
    expect(r.body.user).toMatchObject({ name: 'Lakshmi Person', role: 'owner' });
    expect(r.body.device).toMatchObject({ deviceId: device.id, isCurrent: true });
    expect(new Date(r.body.sessionExpiresAt) > new Date()).toBe(true);
  });

  it('lists devices and signs one out (it then needs the SMS check again)', async () => {
    const { account, session, device } = await signedIn();
    const tablet = newDevice();
    await trustDevice(account, tablet);
    const tabletSession = await signIn(account, tablet);

    const list = (await authed('get', '/api/v2/me/devices', session, device)).body.devices;
    expect(list).toHaveLength(2);
    expect(list.find((d) => d.isCurrent).deviceId).toBe(device.id);

    const target = list.find((d) => !d.isCurrent);
    const r = await authed('delete', `/api/v2/me/devices/${target.id}`, session, device);
    expect(r.status).toBe(200);
    expect((await authed('get', '/api/v2/me', tabletSession, tablet)).body.error.code).toBe('SIGNED_OUT_REMOTELY');
    expect((await api().post('/api/v2/auth/refresh').set('x-device-id', tablet.id).send({ refreshToken: tabletSession.refreshToken })).body.error.code).toBe('SIGNED_OUT_REMOTELY');
    expect((await api().post('/api/v2/auth/login').send({ mobile: account.mobile, pin: account.pin, device: tablet })).body.status).toBe('verify_device');
  });

  it('cannot sign out this device from the list', async () => {
    const { session, device } = await signedIn();
    const me = (await authed('get', '/api/v2/me', session, device)).body.device;
    const r = await authed('delete', `/api/v2/me/devices/${me.id}`, session, device);
    expect(r.body.error.code).toBe('CANNOT_SIGN_OUT_THIS_DEVICE');
  });

  it('signs out all other devices, including old-app sessions', async () => {
    const { account, session, device } = await signedIn();
    const other = newDevice();
    await trustDevice(account, other);
    await signIn(account, other);
    await prisma.session.create({ data: { authAccountId: account.id, refreshTokenHash: `old-app-${crypto.randomUUID()}`, platform: 'ios', expiresAt: new Date(Date.now() + 86400000) } });
    const r = await authed('post', '/api/v2/me/devices/sign-out-others', session, device);
    expect(r.body).toMatchObject({ devicesSignedOut: 1, sessionsEnded: 2 });
    expect((await authed('get', '/api/v2/me', session, device)).status).toBe(200);
  });
});

describe('Change PIN (plan 4.7)', () => {
  const verify = (s, d, pin) => authed('post', '/api/v2/me/pin/verify', s, d).send({ pin });
  const change = (s, d, body) => authed('post', '/api/v2/me/pin/change', s, d).send(body);

  it('checks the current PIN, then saves a new one', async () => {
    const { account, session, device } = await signedIn();
    const v = await verify(session, device, account.pin);
    expect(v.body.changeToken).toBeDefined();
    const c = await change(session, device, { changeToken: v.body.changeToken, newPin: '482916' });
    expect(c.body).toMatchObject({ changed: true, devicesSignedOut: 0 });
    expect((await signIn({ ...account, pin: '482916' }, device)).status).toBe('signed_in');
    // the change token can't be used twice
    expect((await change(session, device, { changeToken: v.body.changeToken, newPin: '573910' })).body.error.code).toBe('STEP_EXPIRED');
  });

  it('wrong current PIN counts toward the lock; the 5th locks and ends this session', async () => {
    const { session, device } = await signedIn();
    for (const left of [4, 3, 2, 1]) expect((await verify(session, device, '999999')).body.error).toMatchObject({ code: 'WRONG_PIN', details: { triesLeft: left } });
    const r = await verify(session, device, '999999');
    expect(r.status).toBe(423);
    expect((await authed('get', '/api/v2/me', session, device)).body.error.code).toBe('SESSION_INVALID');
  });

  it('refuses the same PIN and weak PINs', async () => {
    const { account, session, device } = await signedIn();
    const { changeToken } = (await verify(session, device, account.pin)).body;
    expect((await change(session, device, { changeToken, newPin: account.pin })).body.error.code).toBe('SAME_AS_CURRENT');
    expect((await change(session, device, { changeToken, newPin: '123456' })).body.error.code).toBe('WEAK_PIN');
  });

  it('"Also sign out my other devices" signs them out', async () => {
    const { account, session, device } = await signedIn();
    const other = newDevice();
    await trustDevice(account, other);
    const otherSession = await signIn(account, other);
    const { changeToken } = (await verify(session, device, account.pin)).body;
    const c = await change(session, device, { changeToken, newPin: '482916', signOutOthers: true });
    expect(c.body.devicesSignedOut).toBe(1);
    expect((await authed('get', '/api/v2/me', otherSession, other)).body.error.code).toBe('SIGNED_OUT_REMOTELY');
  });
});
