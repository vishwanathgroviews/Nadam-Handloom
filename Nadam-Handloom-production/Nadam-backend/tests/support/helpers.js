// Shared helpers for API tests: an app instance, test accounts, devices and keys.
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { hashPin } from '../../src/services/pin.service.js';

export const app = createApp();
export const api = () => request(app);
export { prisma };

let counter = 0;
// Unique valid mobile numbers per test run (start 91, never real staff numbers).
export const newMobile = () => `91${String(Date.now()).slice(-5)}${String(counter++).padStart(3, '0')}`.slice(0, 10);

export const newDevice = (platform = 'ios') => ({ id: `test-${crypto.randomUUID()}`, name: platform === 'ios' ? 'Test iPhone' : 'Test Pixel', platform });

const roleIds = {};
async function roleId(name) {
  roleIds[name] ??= (await prisma.role.findUnique({ where: { name } })).id;
  return roleIds[name];
}

// role: 'ADMIN' | 'STAFF' | 'CUSTOMER' | null
export async function makeAccount({ mobile = newMobile(), role = 'STAFF', status = 'active', pin = '135792', name = 'Test' } = {}) {
  const mpinHash = pin ? await hashPin(pin) : null;
  const account = await prisma.authAccount.create({ data: { phone: mobile, status, mpinHash, mpinSetAt: mpinHash ? new Date() : null } });
  if (role) await prisma.userRole.create({ data: { authAccountId: account.id, roleId: await roleId(role) } });
  await prisma.adminProfile.create({ data: { authAccountId: account.id, firstName: name, lastName: 'Person' } });
  return { ...account, mobile, pin };
}

export async function trustDevice(account, device) {
  return prisma.trustedDevice.create({ data: { authAccountId: account.id, deviceId: device.id, name: device.name, platform: device.platform } });
}

// Signs in on an already-trusted device and returns the sign-in reply.
export async function signIn(account, device, pin = account.pin) {
  const res = await api().post('/api/v2/auth/login').send({ mobile: account.mobile, pin, device });
  if (res.body.status !== 'signed_in') throw new Error(`sign-in failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

// A trusted device plus a signed-in session in one go.
export async function signedIn(opts = {}) {
  const account = await makeAccount(opts);
  const device = opts.device || newDevice();
  await trustDevice(account, device);
  const session = await signIn(account, device);
  return { account, device, session };
}

export const authed = (method, path, session, device) =>
  api()[method](path).set('authorization', `Bearer ${session.accessToken}`).set('x-device-id', device.id);

// A P-256 key pair standing in for the phone's security chip.
export function phoneKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    sign: (payload) => crypto.sign('sha256', Buffer.from(payload), { key: privateKey, dsaEncoding: 'der' }).toString('base64'),
  };
}

// Lets a test pretend time has passed for the SMS limits on a number.
export const forgetCodeLimits = (mobile) => prisma.rateLimitHit.deleteMany({ where: { bucketKey: { contains: mobile } } });

// Every page of a list API (20 at a time): follows nextOffset until it is null.
// `as` is a caller like O / S in the test files: (method, path) => request.
export async function allPages(as, path, key) {
  const items = [];
  const pages = [];
  let offset = 0;
  for (;;) {
    const r = await as('get', `${path}${path.includes('?') ? '&' : '?'}offset=${offset}`);
    if (r.status !== 200) throw new Error(`${path} page at ${offset}: ${r.status} ${JSON.stringify(r.body)}`);
    pages.push(r.body);
    items.push(...r.body[key]);
    if (r.body.nextOffset == null) return { items, pages, first: pages[0] };
    offset = r.body.nextOffset;
  }
}
