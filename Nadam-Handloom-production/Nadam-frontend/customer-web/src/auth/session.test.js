import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeServer, signedInReply } from '../test/fetch.js';

let session;
let client;
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  client = await import('../api/client.js');
  session = await import('./session.js');
});

describe('the sign-in on this browser', () => {
  it('a first-time visitor: no call to the server', async () => {
    const s = fakeServer();
    await session.bootstrap();
    expect(session.authStore.get().status).toBe('signedOut');
    expect(s.calls).toHaveLength(0);
  });

  it('a returning customer is signed in again from the cookie', async () => {
    localStorage.setItem('nh-shop-signed-in', '1');
    fakeServer().on('POST', '/auth/refresh', 200, signedInReply());
    await session.bootstrap();
    expect(session.authStore.get()).toMatchObject({ status: 'signedIn', customer: { fullName: 'Priya Sharma' } });
    expect(client.accessKey.get()).toBe('tok-1');
  });

  it('two renewals at once make one call', async () => {
    localStorage.setItem('nh-shop-signed-in', '1');
    const s = fakeServer().on('POST', '/auth/refresh', 200, signedInReply());
    await Promise.all([session.renew(), session.renew(), session.renew()]);
    expect(s.calls).toHaveLength(1);
  });

  it('another tab renewed a moment ago: tries once more', async () => {
    localStorage.setItem('nh-shop-signed-in', '1');
    const s = fakeServer().error('POST', '/auth/refresh', 409, 'REFRESH_RACE', 'Just renewed').on('POST', '/auth/refresh', 200, signedInReply());
    expect(await session.renew()).toBe(true);
    expect(s.calls).toHaveLength(2);
  });

  it('a sign-in that ended: signed out, with the reason to show', async () => {
    localStorage.setItem('nh-shop-signed-in', '1');
    fakeServer().error('POST', '/auth/refresh', 401, 'SESSION_EXPIRED', 'You were signed out after 30 days without a visit.');
    await session.bootstrap();
    expect(session.authStore.get()).toMatchObject({ status: 'signedOut', ended: { code: 'SESSION_EXPIRED' } });
    expect(localStorage.getItem('nh-shop-signed-in')).toBeNull();
  });

  it('offline when the page opens: keeps trying, never signs out', async () => {
    vi.useFakeTimers();
    localStorage.setItem('nh-shop-signed-in', '1');
    fakeServer().on('POST', '/auth/refresh', 0, undefined, { network: true, keep: true });
    const done = session.bootstrap();
    await vi.runAllTimersAsync();
    await done;
    vi.useRealTimers();
    expect(session.authStore.get().status).toBe('unknown');
    expect(session.authStore.get().bootError.code).toBe('NETWORK');
    expect(localStorage.getItem('nh-shop-signed-in')).toBe('1');
  });

  it('"Sign out" ends here even if the server can\'t be reached', async () => {
    session.signedIn(signedInReply());
    fakeServer().on('POST', '/auth/logout', 0, undefined, { network: true });
    await session.signOut();
    expect(session.authStore.get().status).toBe('signedOut');
    expect(client.accessKey.get()).toBeNull();
  });

  it('signing in on a browser with notifications on: its order updates now go to this customer', async () => {
    localStorage.setItem('nh-push-token', 'tok-of-this-browser');
    globalThis.Notification = { permission: 'granted' };
    try {
      const s = fakeServer().on('POST', '/push/subscribe', 200, { subscribed: true, topics: ['orders'] });
      session.signedIn(signedInReply());
      await new Promise((r) => { setTimeout(r, 0); });
      const call = s.calls.find((c) => c.path.endsWith('/push/subscribe'));
      expect(call).toBeTruthy();
      expect(call.body).toEqual({ token: 'tok-of-this-browser' });
    } finally {
      delete globalThis.Notification;
    }
  });

  it('no notifications on this browser: nothing is sent at sign-in', async () => {
    const s = fakeServer();
    session.signedIn(signedInReply());
    await new Promise((r) => { setTimeout(r, 0); });
    expect(s.calls.filter((c) => c.path.endsWith('/push/subscribe'))).toHaveLength(0);
  });
});

