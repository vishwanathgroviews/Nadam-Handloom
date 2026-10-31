import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeServer } from '../test/fetch.js';

let client;
beforeEach(async () => {
  vi.resetModules();
  client = await import('./client.js');
});

describe('API client', () => {
  it('sends the website header and, for signed-in calls, the short key', async () => {
    const s = fakeServer().on('GET', '/me', 200, { ok: 1 });
    client.accessKey.set('tok-1', 900);
    expect(await client.request('GET', '/me', { auth: true })).toEqual({ ok: 1 });
    expect(s.calls[0].headers).toMatchObject({ 'X-Requested-With': 'nandam-web', Authorization: 'Bearer tok-1' });
  });

  it('turns refusals into ApiError with field messages and wait times', async () => {
    fakeServer().error('POST', '/auth/complete', 400, 'VALIDATION_FAILED', 'Enter your full name.', { issues: [{ field: 'fullName', message: 'Enter your full name.' }, { field: 'email', message: 'Bad email.' }] });
    const err = await client.request('POST', '/auth/complete', { body: {} }).catch((e) => e);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', message: 'Enter your full name.' });
    expect(err.fieldErrors).toEqual({ fullName: 'Enter your full name.', email: 'Bad email.' });
    fakeServer().error('POST', '/auth/code', 429, 'CODE_RESEND_WAIT', 'Wait.', { retryAfterSeconds: 42 });
    expect((await client.request('POST', '/auth/code', { body: {} }).catch((e) => e)).retryAfterSeconds).toBe(42);
  });

  it('a proxy error page (not JSON) becomes a friendly "server busy" with a reference', async () => {
    fakeServer().on('GET', '/config', 502, undefined, { raw: '<html>Bad gateway</html>', headers: { 'x-request-id': 'ab12cd34-0000' } });
    const err = await client.request('GET', '/config').catch((e) => e);
    expect(err).toMatchObject({ code: 'SERVER_BUSY', reference: 'AB12CD34' });
  });

  it('no network: a clear message, never a crash', async () => {
    fakeServer().on('GET', '/config', 0, undefined, { network: true });
    expect((await client.request('GET', '/config').catch((e) => e)).code).toBe('NETWORK');
  });

  it('an expired short key is renewed once and the call retried', async () => {
    const s = fakeServer().error('GET', '/me', 401, 'ACCESS_TOKEN_EXPIRED', 'Expired').on('GET', '/me', 200, { customer: 1 });
    client.accessKey.set('old', 900);
    const renewer = vi.fn(async () => { client.accessKey.set('new', 900); return true; });
    client.setRenewer(renewer);
    expect(await client.request('GET', '/me', { auth: true })).toEqual({ customer: 1 });
    expect(renewer).toHaveBeenCalledTimes(1);
    expect(s.calls.map((c) => c.headers.Authorization)).toEqual(['Bearer old', 'Bearer new']);
  });

  it('a sign-in that ended tells the website (once per call)', async () => {
    fakeServer().error('GET', '/me', 401, 'SIGNED_OUT_REMOTELY', 'You were signed out from another device.');
    client.accessKey.set('tok', 900);
    const seen = [];
    client.on('sessionEnded', (e) => seen.push(e.code));
    await client.request('GET', '/me', { auth: true }).catch(() => {});
    expect(seen).toEqual(['SIGNED_OUT_REMOTELY']);
  });

  it('the website switched off: tells the website', async () => {
    fakeServer().error('POST', '/auth/code', 503, 'MAINTENANCE', 'Back at 6 pm.', { message: 'Back at 6 pm.' });
    const seen = [];
    client.on('maintenance', (m) => seen.push(m));
    await client.request('POST', '/auth/code', { body: {} }).catch(() => {});
    expect(seen).toEqual([{ on: true, message: 'Back at 6 pm.' }]);
  });
});
