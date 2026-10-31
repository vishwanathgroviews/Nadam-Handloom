// Module 2 (Roles and team): every rule in plan section 6 and every invite case in 5.2.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, prisma, makeAccount, signedIn, signIn, trustDevice, newDevice, newMobile, authed, allPages } from '../support/helpers.js';

const T = '/api/v2/team';
const roleNames = async (id) => (await prisma.userRole.findMany({ where: { authAccountId: id }, include: { role: true } })).map((r) => r.role.name).sort();
const oldAppSession = (accountId, platform = 'ios') =>
  prisma.session.create({ data: { authAccountId: accountId, refreshTokenHash: `old-${crypto.randomUUID()}`, platform, expiresAt: new Date(Date.now() + 86400000) } });

// The test database is a copy of the dev data, which has its own main owner.
// These tests make their own owner the main owner and put the old one back after.
let previousMain = null;
let main; // { account, device, session } of the main owner used in these tests
beforeAll(async () => {
  previousMain = await prisma.adminProfile.findFirst({ where: { isMainOwner: true } });
  main = await signedIn({ role: 'ADMIN', name: 'Main' });
  await prisma.adminProfile.updateMany({ where: { isMainOwner: true }, data: { isMainOwner: false } });
  await prisma.adminProfile.update({ where: { authAccountId: main.account.id }, data: { isMainOwner: true } });
});
afterAll(async () => {
  await prisma.adminProfile.updateMany({ where: { isMainOwner: true }, data: { isMainOwner: false } });
  if (previousMain) await prisma.adminProfile.update({ where: { id: previousMain.id }, data: { isMainOwner: true } });
});
const asMain = (method, path) => authed(method, path, main.session, main.device);

describe('permissions (plan 4)', () => {
  it('/me lists the role\'s permissions and the main-owner flag', async () => {
    const owner = (await authed('get', '/api/v2/me', main.session, main.device)).body.user;
    expect(owner).toMatchObject({ role: 'owner', isMainOwner: true });
    expect(owner.permissions).toHaveLength(12);
    expect(owner.permissions).toContain('payments.view'); // Online payments (website), owners only
    const s = await signedIn({ role: 'STAFF' });
    const staff = (await authed('get', '/api/v2/me', s.session, s.device)).body.user;
    expect(staff).toMatchObject({ role: 'staff', isMainOwner: false });
    expect(staff.permissions.sort()).toEqual(['catalog.view', 'orders.manage', 'products.manage', 'sell.use']);
  });

  it('refuses Staff on every team route, on the server', async () => {
    const s = await signedIn({ role: 'STAFF' });
    const id = main.account.id, dev = crypto.randomUUID();
    const calls = [
      ['get', T], ['post', T], ['get', `${T}/${id}`], ['patch', `${T}/${id}`], ['put', `${T}/${id}/role`], ['post', `${T}/${id}/remove`],
      ['post', `${T}/${id}/reinvite`], ['post', `${T}/${id}/main-owner`], ['post', `${T}/${id}/devices/sign-out-all`], ['delete', `${T}/${id}/devices/${dev}`],
    ];
    for (const [m, p] of calls) {
      const r = await authed(m, p, s.session, s.device).send({ name: 'X Y', mobile: '9876543210', role: 'owner' });
      expect(r.status, `${m} ${p}`).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('needs a signed-in person', async () => {
    expect((await api().get(T)).status).toBe(401);
  });
});

describe('team list (plan 5.1)', () => {
  it('shows Active, Invited and Removed people in the right tab, with search and counts', async () => {
    const active = await signedIn({ role: 'STAFF', name: 'Listactive' });
    const invited = await makeAccount({ role: 'STAFF', status: 'pending', pin: null, name: 'Listinvited' });
    const removed = await makeAccount({ role: 'CUSTOMER', status: 'pending', pin: null, name: 'Listremoved' });
    const customerOnly = await makeAccount({ role: 'CUSTOMER', name: 'Shopper' });
    await prisma.adminProfile.delete({ where: { authAccountId: customerOnly.id } }); // a plain website customer

    const { items: members, pages, first: team } = await allPages(asMain, T, 'members');
    expect(pages.every((p) => p.members.length <= 20)).toBe(true);
    const byId = Object.fromEntries(members.map((m) => [m.id, m]));
    expect(byId[active.account.id]).toMatchObject({ status: 'active', role: 'staff', phoneCount: 1 });
    expect(byId[active.account.id].lastActiveAt).not.toBeNull();
    expect(byId[invited.id]).toMatchObject({ status: 'invited', role: 'staff' });
    expect(byId[main.account.id]).toMatchObject({ isYou: true, isMainOwner: true, role: 'owner' });
    expect(byId[removed.id]).toBeUndefined();
    expect(byId[customerOnly.id]).toBeUndefined();
    expect(members[0].isMainOwner).toBe(true); // main owner first
    expect(team.counts.team).toBe(members.length);
    expect(team.total).toBe(members.length);
    expect(team.hasMainOwner).toBe(true);

    const { items: gone } = await allPages(asMain, `${T}?tab=removed`, 'members');
    expect(gone.find((m) => m.id === removed.id)).toMatchObject({ status: 'removed', role: null });
    expect(gone.find((m) => m.id === customerOnly.id)).toBeUndefined();

    const q = (await asMain('get', `${T}?q=listact`)).body.members;
    expect(q.map((m) => m.id)).toEqual([active.account.id]);
    const digits = (await asMain('get', `${T}?q=${invited.mobile.slice(-6)}`)).body.members;
    expect(digits.map((m) => m.id)).toContain(invited.id);
  });
});

describe('invite (plan 5.2)', () => {
  const invite = (body) => asMain('post', T).send(body);

  it('adds a new person as Invited and returns the WhatsApp invite', async () => {
    const mobile = newMobile();
    const r = await invite({ name: '  Venkat   Rao ', mobile, role: 'staff' });
    expect(r.status).toBe(201);
    expect(r.body.member).toMatchObject({ name: 'Venkat Rao', mobile, role: 'staff', status: 'invited' });
    expect(r.body.member.invitedBy).toEqual({ id: main.account.id, name: 'Main Person' });
    expect(r.body.member.actions).toMatchObject({ shareInvite: true, changeRole: true, remove: true, signOutPhones: false });
    expect(r.body.invite.message).toContain('Hi Venkat, you\'ve been added to the Nandam Handlooms team as Staff.');
    expect(r.body.invite.message).toContain(`${mobile.slice(0, 5)} ${mobile.slice(5)}`);
    expect(r.body.invite.message).toContain('First time here?');
    expect(r.body.invite.message).toContain('– Main Person, Nandam Handlooms');
    expect(r.body.invite.whatsappUrl).toBe(`https://wa.me/91${mobile}?text=${encodeURIComponent(r.body.invite.message)}`);
    const a = await prisma.authAccount.findUnique({ where: { phone: mobile }, include: { adminProfile: true } });
    expect(a).toMatchObject({ status: 'pending', mpinHash: null });
    expect(a.adminProfile).toMatchObject({ firstName: 'Venkat', lastName: 'Rao', invitedById: main.account.id });
    expect(await roleNames(a.id)).toEqual(['STAFF']);
    expect(await prisma.authEvent.count({ where: { authAccountId: a.id, eventType: 'admin_provisioned_user' } })).toBe(1);
  });

  it('can add another Owner', async () => {
    const r = await invite({ name: 'Second Owner', mobile: newMobile(), role: 'owner' });
    expect(r.body.member.role).toBe('owner');
    expect(r.body.invite.message).toContain('as an Owner.');
  });

  it('checks the name, number and role', async () => {
    for (const body of [
      { name: 'A', mobile: newMobile(), role: 'staff' },
      { name: '12345', mobile: newMobile(), role: 'staff' },
      { name: '<b>Bad</b>', mobile: newMobile(), role: 'staff' },
      { name: 'x'.repeat(81), mobile: newMobile(), role: 'staff' },
      { name: 'Good Name', mobile: '5123456789', role: 'staff' },
      { name: 'Good Name', mobile: newMobile(), role: 'manager' },
    ]) {
      const r = await invite(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('an active member\'s number: "already in your team"', async () => {
    const s = await signedIn({ role: 'STAFF', name: 'Ravi' });
    const r = await invite({ name: 'Ravi Again', mobile: s.account.mobile, role: 'staff' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'ALREADY_IN_TEAM', details: { member: { id: s.account.id, name: 'Ravi Person', role: 'staff' } } });
  });

  it('an invited number: "already invited"', async () => {
    const p = await makeAccount({ status: 'pending', pin: null, name: 'Suresh' });
    const r = await invite({ name: 'Suresh', mobile: p.mobile, role: 'staff' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('ALREADY_INVITED');
  });

  it('a removed member\'s number: invited again with the new name and role', async () => {
    const k = await makeAccount({ role: 'CUSTOMER', status: 'pending', pin: null, name: 'Kiran' });
    await prisma.adminProfile.update({ where: { authAccountId: k.id }, data: { removedAt: new Date(), removedById: main.account.id } });
    const r = await invite({ name: 'Kiran Kumar', mobile: k.mobile, role: 'owner' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ invitedAgain: true, member: { name: 'Kiran Kumar', role: 'owner', status: 'invited', removedAt: null } });
    expect(await roleNames(k.id)).toEqual(['ADMIN', 'CUSTOMER']);
    const p = await prisma.adminProfile.findUnique({ where: { authAccountId: k.id } });
    expect(p.removedAt).toBeNull();
    expect(await prisma.authEvent.count({ where: { authAccountId: k.id, eventType: 'admin_reinvited_user' } })).toBe(1);
  });

  it('a website customer: joins, keeps their PIN and website sign-in, and counts as joined after signing in on a phone', async () => {
    const c = await makeAccount({ role: 'CUSTOMER', name: 'Meena', pin: '135792' });
    await prisma.adminProfile.delete({ where: { authAccountId: c.id } });
    const before = await prisma.authAccount.findUnique({ where: { id: c.id } });
    const r = await invite({ name: 'Meena Devi', mobile: c.mobile, role: 'staff' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ keptCustomerAccount: true, member: { status: 'invited', isCustomer: true } });
    expect(r.body.invite.message).toContain('the PIN you use on our website');
    const after = await prisma.authAccount.findUnique({ where: { id: c.id } });
    expect(after).toMatchObject({ status: 'active', mpinHash: before.mpinHash, securityStamp: before.securityStamp });
    expect(await roleNames(c.id)).toEqual(['CUSTOMER', 'STAFF']);
    // Their PIN works, and a new phone needs the SMS check.
    const device = newDevice();
    expect((await api().post('/api/v2/auth/login').send({ mobile: c.mobile, pin: '135792', device })).body.status).toBe('verify_device');
    await trustDevice(c, device); // what the SMS check does
    const m = (await asMain('get', `${T}/${c.id}`)).body.member;
    expect(m.status).toBe('active');
  });

  it('an invited person sets up with Module 1 and becomes Active', async () => {
    const mobile = newMobile();
    const inv = (await invite({ name: 'New Starter', mobile, role: 'staff' })).body.member;
    const device = newDevice();
    const code = (await api().post('/api/v2/auth/setup/request-code').send({ mobile })).body.devCode;
    const step = (await api().post('/api/v2/auth/setup/verify-code').send({ mobile, code, deviceId: device.id })).body.stepToken;
    const done = await api().post('/api/v2/auth/pin/set').send({ stepToken: step, pin: '482916', device });
    expect(done.body.status).toBe('signed_in');
    expect(done.body.user.permissions).toContain('products.manage');
    expect((await asMain('get', `${T}/${inv.id}`)).body.member.status).toBe('active');
  });

  it('nothing is sent by SMS when inviting', async () => {
    const mobile = newMobile();
    const r = await invite({ name: 'Quiet Invite', mobile, role: 'staff' });
    expect(await prisma.otpCode.count({ where: { authAccountId: r.body.member.id } })).toBe(0);
  });
});

describe('member page (plan 5.3)', () => {
  it('shows phones and exactly what you may do', async () => {
    const s = await signedIn({ role: 'STAFF', name: 'Phones' });
    const tablet = newDevice('android');
    await trustDevice(s.account, tablet);
    const r = await asMain('get', `${T}/${s.account.id}`);
    expect(r.body.member.phones).toHaveLength(2);
    expect(r.body.member.phones[0]).toHaveProperty('lastSeenAt');
    expect(r.body.member.actions).toEqual({ rename: true, changeRole: true, remove: true, signOutPhones: true, shareInvite: false, reinvite: false, makeMainOwner: false });
    expect(r.body.invite).toBeNull();

    const own = (await asMain('get', `${T}/${main.account.id}`)).body.member;
    expect(own.actions).toMatchObject({ changeRole: false, remove: false, signOutPhones: false, makeMainOwner: false });
  });

  it('another owner sees the main owner as protected', async () => {
    const o = await signedIn({ role: 'ADMIN', name: 'Other' });
    const m = (await authed('get', `${T}/${main.account.id}`, o.session, o.device)).body.member;
    expect(m.actions).toMatchObject({ changeRole: false, remove: false, signOutPhones: false, makeMainOwner: false });
  });

  it('unknown people and plain customers are not found', async () => {
    expect((await asMain('get', `${T}/${crypto.randomUUID()}`)).body.error.code).toBe('MEMBER_NOT_FOUND');
    const c = await makeAccount({ role: 'CUSTOMER' });
    await prisma.adminProfile.delete({ where: { authAccountId: c.id } });
    expect((await asMain('get', `${T}/${c.id}`)).status).toBe(404);
    expect((await asMain('get', `${T}/not-a-uuid`)).body.error.code).toBe('VALIDATION_FAILED');
  });

  it('edits a name (the mobile number cannot be changed)', async () => {
    const s = await makeAccount({ name: 'Old' });
    const r = await asMain('patch', `${T}/${s.id}`).send({ name: 'New Name Here', mobile: '9999999999' });
    expect(r.body.member).toMatchObject({ name: 'New Name Here', mobile: s.mobile });
    expect((await asMain('patch', `${T}/${s.id}`).send({ name: ' ' })).status).toBe(400);
  });
});

describe('roles (plan 5.3, 5.4, 6)', () => {
  it('a role change applies at once, without signing the person out', async () => {
    const s = await signedIn({ role: 'STAFF' });
    expect((await authed('get', T, s.session, s.device)).status).toBe(403);
    const r = await asMain('put', `${T}/${s.account.id}/role`).send({ role: 'owner' });
    expect(r.body.member.role).toBe('owner');
    // Same access key, same session: now an owner.
    const me = (await authed('get', '/api/v2/me', s.session, s.device)).body.user;
    expect(me.role).toBe('owner');
    expect(me.permissions).toContain('team.manage');
    expect((await authed('get', T, s.session, s.device)).status).toBe(200);
    // And back to Staff.
    await asMain('put', `${T}/${s.account.id}/role`).send({ role: 'staff' });
    expect((await authed('get', T, s.session, s.device)).status).toBe(403);
    expect((await authed('get', '/api/v2/me', s.session, s.device)).body.user.role).toBe('staff');
    expect(await prisma.authEvent.count({ where: { authAccountId: s.account.id, eventType: 'admin_changed_role' } })).toBe(2);
  });

  it('you cannot change your own role', async () => {
    const r = await asMain('put', `${T}/${main.account.id}/role`).send({ role: 'staff' });
    expect(r.body.error.code).toBe('CANNOT_CHANGE_SELF');
  });

  it('nobody can make the main owner Staff', async () => {
    const o = await signedIn({ role: 'ADMIN' });
    const r = await authed('put', `${T}/${main.account.id}/role`, o.session, o.device).send({ role: 'staff' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('MAIN_OWNER_PROTECTED');
  });

  it('a removed person\'s role cannot be changed', async () => {
    const k = await makeAccount({ role: 'CUSTOMER', pin: null });
    expect((await asMain('put', `${T}/${k.id}/role`).send({ role: 'owner' })).body.error.code).toBe('ALREADY_REMOVED');
  });
});

describe('remove access (plan 5.3, 6)', () => {
  it('ends every sign-in at once, untrusts every phone, stops push, clears the PIN and keeps history', async () => {
    const s = await signedIn({ role: 'STAFF', name: 'Leaving' });
    const tablet = newDevice('android');
    await trustDevice(s.account, tablet);
    const tabletSession = await signIn(s.account, tablet);
    await prisma.trustedDevice.updateMany({ where: { authAccountId: s.account.id }, data: { biometricPublicKey: 'x'.repeat(100) } });
    await prisma.deviceToken.create({ data: { authAccountId: s.account.id, expoPushToken: `ExponentPushToken[${crypto.randomUUID()}]`, platform: 'ios' } });
    await oldAppSession(s.account.id);

    const r = await asMain('post', `${T}/${s.account.id}/remove`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ devicesSignedOut: 2, member: { status: 'removed', role: null, removedBy: { id: main.account.id } } });
    expect(r.body.member.actions).toMatchObject({ reinvite: true, remove: false, changeRole: false });

    for (const [sess, dev] of [[s.session, s.device], [tabletSession, tablet]]) {
      expect((await authed('get', '/api/v2/me', sess, dev)).body.error.code).toBe('ACCESS_REMOVED');
      expect((await api().post('/api/v2/auth/refresh').set('x-device-id', dev.id).send({ refreshToken: sess.refreshToken })).body.error.code).toBe('ACCESS_REMOVED');
    }
    const login = await api().post('/api/v2/auth/login').send({ mobile: s.account.mobile, pin: s.account.pin, device: s.device });
    expect(login.status).toBe(401);
    const a = await prisma.authAccount.findUnique({ where: { id: s.account.id }, include: { adminProfile: true } });
    expect(a).toMatchObject({ mpinHash: null, status: 'pending', deletedAt: null });
    expect(a.securityStamp).not.toBe(s.account.securityStamp);
    expect(a.adminProfile).toMatchObject({ firstName: 'Leaving', removedById: main.account.id });
    expect(await roleNames(a.id)).toEqual([]);
    expect(await prisma.trustedDevice.count({ where: { authAccountId: a.id, revokedAt: null } })).toBe(0);
    expect(await prisma.trustedDevice.count({ where: { authAccountId: a.id, biometricPublicKey: { not: null } } })).toBe(0);
    expect(await prisma.session.count({ where: { authAccountId: a.id, revokedAt: null } })).toBe(0);
    expect(await prisma.deviceToken.count({ where: { authAccountId: a.id } })).toBe(0);
    const ev = await prisma.authEvent.findFirst({ where: { authAccountId: a.id, eventType: 'admin_revoked_user_access' } });
    expect(ev.metadata).toMatchObject({ revokedRoles: ['STAFF'], byUserId: main.account.id, devicesSignedOut: 2 });
  });

  it('a member who is also a website customer keeps their PIN and customer role', async () => {
    const s = await signedIn({ role: 'STAFF' });
    await prisma.userRole.create({ data: { authAccountId: s.account.id, roleId: (await prisma.role.findUnique({ where: { name: 'CUSTOMER' } })).id } });
    await asMain('post', `${T}/${s.account.id}/remove`);
    const a = await prisma.authAccount.findUnique({ where: { id: s.account.id } });
    expect(a.status).toBe('active');
    expect(a.mpinHash).not.toBeNull();
    expect(await roleNames(a.id)).toEqual(['CUSTOMER']);
  });

  it('refuses: yourself, the main owner, someone already removed', async () => {
    expect((await asMain('post', `${T}/${main.account.id}/remove`)).body.error.code).toBe('CANNOT_CHANGE_SELF');
    const o = await signedIn({ role: 'ADMIN' });
    expect((await authed('post', `${T}/${main.account.id}/remove`, o.session, o.device)).body.error.code).toBe('MAIN_OWNER_PROTECTED');
    const k = await makeAccount({ role: 'CUSTOMER', pin: null });
    expect((await asMain('post', `${T}/${k.id}/remove`)).body.error.code).toBe('ALREADY_REMOVED');
  });

  it('an owner can remove another (non-main) owner', async () => {
    const o = await signedIn({ role: 'ADMIN' });
    const r = await asMain('post', `${T}/${o.account.id}/remove`);
    expect(r.body.member.status).toBe('removed');
    expect((await authed('get', '/api/v2/me', o.session, o.device)).body.error.code).toBe('ACCESS_REMOVED');
  });
});

describe('invite again (plan 5.3)', () => {
  it('brings a removed person back as Invited with the chosen role; they set up again', async () => {
    const s = await signedIn({ role: 'STAFF', name: 'Returning' });
    await asMain('post', `${T}/${s.account.id}/remove`);
    const r = await asMain('post', `${T}/${s.account.id}/reinvite`).send({ role: 'owner' });
    expect(r.body).toMatchObject({ invitedAgain: true, member: { status: 'invited', role: 'owner' } });
    expect(r.body.invite.message).toContain('First time here?');
    expect(await roleNames(s.account.id)).toEqual(['ADMIN']);
    // The old phone is not trusted any more.
    expect((await api().post('/api/v2/auth/login').send({ mobile: s.account.mobile, pin: s.account.pin, device: s.device })).status).toBe(401);
  });

  it('refuses someone who already has access', async () => {
    const s = await makeAccount({ role: 'STAFF' });
    expect((await asMain('post', `${T}/${s.id}/reinvite`).send({ role: 'staff' })).body.error.code).toBe('ALREADY_IN_TEAM');
  });
});

describe('phones (plan 5.3)', () => {
  it('signs out one phone: it needs the PIN and an SMS code again; the other phone carries on', async () => {
    const s = await signedIn({ role: 'STAFF' });
    const tablet = newDevice('android');
    await trustDevice(s.account, tablet);
    const tabletSession = await signIn(s.account, tablet);
    const phones = (await asMain('get', `${T}/${s.account.id}`)).body.member.phones;
    const target = phones.find((p) => p.name === tablet.name && p.platform === 'android');
    const r = await asMain('delete', `${T}/${s.account.id}/devices/${target.id}`);
    expect(r.body.member.phones).toHaveLength(1);
    expect((await authed('get', '/api/v2/me', tabletSession, tablet)).body.error.code).toBe('SIGNED_OUT_REMOTELY');
    expect((await authed('get', '/api/v2/me', s.session, s.device)).status).toBe(200);
    expect((await api().post('/api/v2/auth/login').send({ mobile: s.account.mobile, pin: s.account.pin, device: tablet })).body.status).toBe('verify_device');
    expect((await asMain('delete', `${T}/${s.account.id}/devices/${target.id}`)).body.error.code).toBe('DEVICE_NOT_FOUND');
  });

  it('signs out all phones and old-app sign-ins, but not a customer\'s website sign-in', async () => {
    const s = await signedIn({ role: 'STAFF' });
    await oldAppSession(s.account.id, 'android');
    const web = await oldAppSession(s.account.id, 'web');
    const r = await asMain('post', `${T}/${s.account.id}/devices/sign-out-all`);
    expect(r.body).toMatchObject({ devicesSignedOut: 1, sessionsEnded: 2, member: { phones: [], status: 'active' } });
    expect((await authed('get', '/api/v2/me', s.session, s.device)).body.error.code).toBe('SIGNED_OUT_REMOTELY');
    expect((await prisma.session.findUnique({ where: { id: web.id } })).revokedAt).toBeNull();
  });

  it('refuses: your own phones (use My devices), the main owner\'s phones, someone else\'s phone id', async () => {
    const own = (await asMain('get', `${T}/${main.account.id}`)).body.member.phones[0];
    expect((await asMain('delete', `${T}/${main.account.id}/devices/${own.id}`)).body.error.code).toBe('CANNOT_CHANGE_SELF');
    const o = await signedIn({ role: 'ADMIN' });
    expect((await authed('post', `${T}/${main.account.id}/devices/sign-out-all`, o.session, o.device)).body.error.code).toBe('MAIN_OWNER_PROTECTED');
    const a = await signedIn({ role: 'STAFF' });
    const b = await signedIn({ role: 'STAFF' });
    const bPhone = (await asMain('get', `${T}/${b.account.id}`)).body.member.phones[0];
    expect((await asMain('delete', `${T}/${a.account.id}/devices/${bPhone.id}`)).body.error.code).toBe('DEVICE_NOT_FOUND');
  });
});

describe('main owner (plan 6)', () => {
  it('only the main owner can hand over the title, and only to another active owner', async () => {
    const o = await signedIn({ role: 'ADMIN', name: 'Heir' });
    expect((await authed('post', `${T}/${o.account.id}/main-owner`, o.session, o.device)).body.error.code).toBe('FORBIDDEN');
    const invitedOwner = await makeAccount({ role: 'ADMIN', status: 'pending', pin: null });
    expect((await asMain('post', `${T}/${invitedOwner.id}/main-owner`)).body.error.code).toBe('NOT_ACTIVE_OWNER');
    const staff = await makeAccount({ role: 'STAFF' });
    expect((await asMain('post', `${T}/${staff.id}/main-owner`)).body.error.code).toBe('NOT_ACTIVE_OWNER');
    expect((await asMain('post', `${T}/${main.account.id}/main-owner`)).body.error.code).toBe('NOT_ACTIVE_OWNER');

    const r = await asMain('post', `${T}/${o.account.id}/main-owner`);
    expect(r.body.member.isMainOwner).toBe(true);
    expect(await prisma.adminProfile.count({ where: { isMainOwner: true } })).toBe(1);
    // The old main owner is now an ordinary owner the new one can manage, and can't hand it back.
    const back = await authed('get', `${T}/${main.account.id}`, o.session, o.device);
    expect(back.body.member.actions).toMatchObject({ changeRole: true, remove: true, makeMainOwner: true });
    expect((await asMain('post', `${T}/${o.account.id}/main-owner`)).body.error.code).toBe('FORBIDDEN');
    // Hand it back for the remaining tests.
    await authed('post', `${T}/${main.account.id}/main-owner`, o.session, o.device);
    expect((await authed('get', '/api/v2/me', main.session, main.device)).body.user.isMainOwner).toBe(true);
  });

  it('the database itself allows only one main owner', async () => {
    const o = await makeAccount({ role: 'ADMIN' });
    await expect(prisma.adminProfile.update({ where: { authAccountId: o.id }, data: { isMainOwner: true } })).rejects.toThrow();
  });
});

describe('concurrency', () => {
  it('two owners removing each other at the same moment cannot both succeed (so an owner always remains)', async () => {
    const a = await signedIn({ role: 'ADMIN' });
    const b = await signedIn({ role: 'ADMIN' });
    const [ra, rb] = await Promise.all([
      authed('post', `${T}/${b.account.id}/remove`, a.session, a.device),
      authed('post', `${T}/${a.account.id}/remove`, b.session, b.device),
    ]);
    const ok = [ra, rb].filter((r) => r.status === 200).length;
    expect(ok).toBe(1); // the loser's access was removed before its own request ran
    expect([ra, rb].find((r) => r.status !== 200).body.error.code).toMatch(/ACCESS_REMOVED|FORBIDDEN|ALREADY_REMOVED/);
  });
});
