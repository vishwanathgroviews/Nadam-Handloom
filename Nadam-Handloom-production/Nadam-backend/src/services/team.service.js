// Module 2: the team. Owners invite people, change roles, sign out their phones,
// remove access and hand over the main-owner title. The rules are in
// docs/modules/module-02-roles-and-team.md (section 6).
//
// The shop always keeps an owner without a separate check: only an owner can
// change roles or remove people, nobody can change themselves, and begin()
// re-checks the acting owner inside the lock. So the actor is an owner who stays.
//
// One thing to know: customers and team members share AuthAccount, and the
// website signs customers in with the same PIN. So a website customer who joins
// (or leaves) the team keeps their PIN; everyone else's PIN is cleared when
// access is removed, exactly as the old backend did.
import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { REVOKE } from '../config/constants.js';
import * as Team from '../models/team.model.js';
import * as Device from '../models/trustedDevice.model.js';
import * as Session from '../models/session.model.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { inviteMessage, whatsappUrl } from './inviteMessage.js';
import { audit } from './audit.service.js';
import { maskMobile } from '../utils/phone.js';
import { can, PERMISSION } from '../config/permissions.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

const DB_ROLE = { owner: 'ADMIN', staff: 'STAFF' };
const APP_ROLE = { ADMIN: 'owner', STAFF: 'staff' };
const iso = (d) => (d ? d.toISOString() : null);

const hasRole = (a, name) => a.roles.some((r) => r.role.name === name);
const isCustomer = (a) => hasRole(a, 'CUSTOMER');
const isDeleted = (a) => !!a.deletedAt || a.status === 'deleted';
const canSignIn = (a) => a.status === 'active' && !!a.mpinHash; // the Module 1 sign-in rule
const isMainOwner = (a) => !!a.adminProfile?.isMainOwner;

// Active, Invited or Removed (worked out, not stored).
export function statusOf(a) {
  if (!appRoleOf(a) || isDeleted(a)) return 'removed';
  if (!canSignIn(a)) return 'invited';
  // A website customer can already sign in with their PIN, so they count as
  // joined once they have signed in to the app on a phone since the invite.
  // People from before the team screens (no invite date) are simply active.
  const invitedAt = a.adminProfile?.invitedAt;
  if (!invitedAt) return 'active';
  return a.trustedDevices.some((d) => d.trustedAt >= invitedAt) ? 'active' : 'invited';
}

function lastActiveAt(a) {
  const times = [...a.trustedDevices.map((d) => d.lastSeenAt), a.sessions?.[0]?.createdAt].filter(Boolean);
  return times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : null;
}

export function splitName(name) {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

// What the person looking at this page may do there. The app shows exactly these.
function actionsFor(viewer, a, status) {
  const self = a.id === viewer.id;
  const protectedOne = self || isMainOwner(a);
  return {
    rename: true,
    changeRole: status !== 'removed' && !protectedOne,
    remove: status !== 'removed' && !protectedOne,
    signOutPhones: status === 'active' && !protectedOne,
    shareInvite: status === 'invited',
    reinvite: status === 'removed',
    makeMainOwner: isMainOwner(viewer) && !self && appRoleOf(a) === 'ADMIN' && status === 'active',
  };
}

async function namesById(accounts) {
  const ids = [...new Set(accounts.flatMap((a) => [a.adminProfile?.invitedById, a.adminProfile?.removedById]).filter(Boolean))];
  const rows = await Team.findNames(ids);
  return new Map(rows.map((r) => [r.id, displayNameOf(r)]));
}
const personRef = (id, names) => (id ? { id, name: names.get(id) ?? 'Former team member' } : null);

function presentMember(a, viewer, names) {
  const p = a.adminProfile;
  const role = appRoleOf(a);
  const status = statusOf(a);
  return {
    id: a.id,
    name: displayNameOf(a),
    mobile: a.phone,
    mobileMasked: maskMobile(a.phone),
    role: status === 'removed' ? null : APP_ROLE[role],
    status,
    isMainOwner: isMainOwner(a) && status !== 'removed',
    isYou: a.id === viewer.id,
    isCustomer: isCustomer(a),
    addedAt: iso(p?.createdAt ?? a.createdAt),
    lastActiveAt: iso(lastActiveAt(a)),
    invitedAt: status === 'invited' ? iso(p?.invitedAt ?? p?.createdAt ?? a.createdAt) : null,
    invitedBy: status === 'invited' ? personRef(p?.invitedById, names) : null,
    removedAt: status === 'removed' ? iso(p?.removedAt ?? p?.updatedAt ?? null) : null,
    removedBy: status === 'removed' ? personRef(p?.removedById, names) : null,
    phoneCount: a.trustedDevices.filter((d) => !d.revokedAt).length,
  };
}

const presentPhone = (d) => ({
  id: d.id,
  name: d.name,
  platform: d.platform,
  biometricEnabled: !!d.biometricPublicKey,
  trustedAt: iso(d.trustedAt),
  lastSeenAt: iso(d.lastSeenAt),
});

function inviteFor(a, member, viewer) {
  const text = inviteMessage({
    firstName: splitName(member.name).firstName,
    role: member.role,
    mobile: a.phone,
    hasPin: canSignIn(a),
    fromName: displayNameOf(viewer),
  });
  return { message: text, whatsappUrl: whatsappUrl(a.phone, text) };
}

// The member page: the person, their phones, the invite (if any) and what you may do.
async function detail(id, viewer) {
  const a = await Team.findMember(id);
  if (!a || (!appRoleOf(a) && !a.adminProfile)) throw notFound('MEMBER_NOT_FOUND', 'This person isn\'t in the team any more.');
  const member = presentMember(a, viewer, await namesById([a]));
  return {
    member: {
      ...member,
      phones: member.status === 'active' ? a.trustedDevices.filter((d) => !d.revokedAt).map(presentPhone) : [],
      actions: actionsFor(viewer, a, member.status),
    },
    invite: member.status === 'invited' ? inviteFor(a, member, viewer) : null,
  };
}

const RANK = (m) => (m.isMainOwner ? 0 : m.role === 'owner' ? 1 : 2);
const byRank = (x, y) => RANK(x) - RANK(y) || x.name.localeCompare(y.name);
const byRemoved = (x, y) => (y.removedAt ?? '').localeCompare(x.removedAt ?? '') || x.name.localeCompare(y.name);

export async function listTeam({ viewer, tab = 'team', q = '', offset = 0, limit = PAGE_SIZE }) {
  const accounts = await Team.listMembers();
  const names = await namesById(accounts);
  const members = accounts.map((a) => presentMember(a, viewer, names));
  const inTeam = members.filter((m) => m.status !== 'removed');
  const removed = members.filter((m) => m.status === 'removed');
  const query = q.trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  const matches = (m) => !query || m.name.toLowerCase().includes(query) || (digits.length > 0 && (m.mobile ?? '').includes(digits));
  const shown = (tab === 'removed' ? removed : inTeam).filter(matches).sort(tab === 'removed' ? byRemoved : byRank);
  const page = pageOf(shown, { offset, limit });
  return {
    members: page.items,
    nextOffset: page.nextOffset,
    total: page.total,
    counts: {
      team: inTeam.length,
      removed: removed.length,
      owners: inTeam.filter((m) => m.role === 'owner').length,
      staff: inTeam.filter((m) => m.role === 'staff').length,
      invited: inTeam.filter((m) => m.status === 'invited').length,
    },
    hasMainOwner: inTeam.some((m) => m.isMainOwner),
  };
}

export const getMember = ({ viewer, id }) => detail(id, viewer);

// Every change starts here, inside a transaction: take the team lock, then check
// again that the person making the change is still an owner. Their request was
// checked before the lock, and another owner may have removed them since.
async function begin(tx, viewer) {
  await Team.lockTeam(tx);
  const me = await Team.findMember(viewer.id, tx);
  if (!me || isDeleted(me) || !can(appRoleOf(me), PERMISSION.TEAM_MANAGE)) throw forbidden('FORBIDDEN', 'Only owners can do this.');
  return me;
}

// Loads the person for a change and applies the shared refusals.
async function loadForChange(tx, viewer, id, { mustHaveAccess = true, protect = true } = {}) {
  await begin(tx, viewer);
  const a = await Team.findMember(id, tx);
  if (!a || isDeleted(a) || (!appRoleOf(a) && !a.adminProfile)) throw notFound('MEMBER_NOT_FOUND', 'This person isn\'t in the team any more.');
  if (mustHaveAccess && !appRoleOf(a)) throw conflict('ALREADY_REMOVED', 'This person\'s access was already removed.');
  if (protect && a.id === viewer.id) throw badRequest('CANNOT_CHANGE_SELF', 'You can\'t change your own role or access. Use My account for your own phones.');
  if (protect && isMainOwner(a)) throw forbidden('MAIN_OWNER_PROTECTED', 'The main owner can\'t be removed, made Staff or signed out by another owner.');
  return a;
}

// Gives an existing account (removed member, website customer, closed account)
// team access again, pending setup.
async function grantAccess(tx, a, { roleName, firstName, lastName, viewer }) {
  const keepPin = canSignIn(a) && !isDeleted(a); // a website customer's PIN keeps working
  await tx.authAccount.update({
    where: { id: a.id },
    data: keepPin
      ? {}
      : { status: 'pending', deletedAt: null, mpinHash: null, mpinSetAt: null, failedLoginAttempts: 0, lockCount: 0, lockedUntil: null, securityStamp: crypto.randomUUID() },
  });
  await Team.upsertProfile(a.id, { firstName, lastName, invitedAt: new Date(), invitedById: viewer.id, removedAt: null, removedById: null, isMainOwner: false }, tx);
  await Team.setAppRole(a.id, roleName, tx);
  // Phones trusted before this invite must pass the SMS check again.
  await Device.revokeAllForAccount(a.id, tx);
  return keepPin;
}

export async function invite({ viewer, name, mobile, role, ctx }) {
  const { firstName, lastName } = splitName(name);
  const roleName = DB_ROLE[role];
  const out = await prisma.$transaction(async (tx) => {
    await begin(tx, viewer);
    const existing = await Team.findMemberByMobile(mobile, tx);
    if (existing && appRoleOf(existing) && !isDeleted(existing)) {
      const status = statusOf(existing);
      const who = { id: existing.id, name: displayNameOf(existing), role: APP_ROLE[appRoleOf(existing)] };
      if (status === 'active') throw conflict('ALREADY_IN_TEAM', `${who.name} is already in your team.`, { member: who });
      throw conflict('ALREADY_INVITED', `${who.name} is already invited.`, { member: who });
    }
    if (existing) {
      const keptPin = await grantAccess(tx, existing, { roleName, firstName, lastName, viewer });
      return { id: existing.id, again: !!existing.adminProfile, customer: isCustomer(existing), keptPin, previousRoles: existing.roles.map((r) => r.role.name), wasDeleted: isDeleted(existing) };
    }
    const created = await tx.authAccount.create({
      data: { phone: mobile, status: 'pending', adminProfile: { create: { firstName, lastName, invitedAt: new Date(), invitedById: viewer.id } } },
    });
    await Team.setAppRole(created.id, roleName, tx);
    return { id: created.id, again: false, customer: false, keptPin: false };
  });
  const { id, again, customer, keptPin, previousRoles, wasDeleted } = out;
  if (previousRoles) await audit('admin_reinvited_user', { accountId: id, ctx, metadata: { role: roleName, previousRoles, wasDeleted, keptPin, byUserId: viewer.id } });
  else await audit('admin_provisioned_user', { accountId: id, ctx, metadata: { role: roleName, byUserId: viewer.id } });
  return { ...(await detail(id, viewer)), invitedAgain: again, keptCustomerAccount: customer };
}

export async function reinvite({ viewer, id, role, ctx }) {
  const metadata = await prisma.$transaction(async (tx) => {
    await begin(tx, viewer);
    const a = await Team.findMember(id, tx);
    if (!a || (!appRoleOf(a) && !a.adminProfile)) throw notFound('MEMBER_NOT_FOUND', 'This person isn\'t in the team any more.');
    if (appRoleOf(a) && !isDeleted(a)) throw conflict(statusOf(a) === 'active' ? 'ALREADY_IN_TEAM' : 'ALREADY_INVITED', `${displayNameOf(a)} already has access.`);
    const { firstName, lastName } = splitName(displayNameOf(a));
    const keptPin = await grantAccess(tx, a, { roleName: DB_ROLE[role], firstName, lastName, viewer });
    return { role: DB_ROLE[role], previousRoles: a.roles.map((r) => r.role.name), keptPin, byUserId: viewer.id };
  });
  await audit('admin_reinvited_user', { accountId: id, ctx, metadata });
  return { ...(await detail(id, viewer)), invitedAgain: true };
}

export async function rename({ viewer, id, name, ctx }) {
  const before = await prisma.$transaction(async (tx) => {
    await begin(tx, viewer);
    const a = await Team.findMember(id, tx);
    if (!a || (!appRoleOf(a) && !a.adminProfile)) throw notFound('MEMBER_NOT_FOUND', 'This person isn\'t in the team any more.');
    await Team.upsertProfile(id, splitName(name), tx);
    return displayNameOf(a);
  });
  await audit('admin_renamed_user', { accountId: id, ctx, metadata: { from: before, to: name, byUserId: viewer.id } });
  return detail(id, viewer);
}

// Takes effect on the server at once; the person stays signed in.
export async function changeRole({ viewer, id, role, ctx }) {
  const to = DB_ROLE[role];
  const from = await prisma.$transaction(async (tx) => {
    const a = await loadForChange(tx, viewer, id);
    const current = appRoleOf(a);
    if (current === to) return null;
    await Team.setAppRole(id, to, tx);
    return current;
  });
  if (from) await audit('admin_changed_role', { accountId: id, ctx, metadata: { from, to, byUserId: viewer.id } });
  return detail(id, viewer);
}

// Ends every sign-in, untrusts every phone (Face ID off), stops push messages and
// keeps all history. Their next request on any phone gets "access removed".
export async function remove({ viewer, id, ctx }) {
  const result = await prisma.$transaction(async (tx) => {
    const a = await loadForChange(tx, viewer, id);
    const keepPin = isCustomer(a); // their website sign-in uses the same PIN
    const role = appRoleOf(a);
    await Team.removeAppRoles(id, tx);
    const devices = await Device.revokeAllForAccount(id, tx);
    const sessionsEnded = await Session.revokeWhere({ authAccountId: id }, REVOKE.ACCESS_REMOVED, {}, tx);
    await Team.deletePushDevices(id, tx);
    await tx.authAccount.update({
      where: { id },
      data: { securityStamp: crypto.randomUUID(), ...(keepPin ? {} : { mpinHash: null, mpinSetAt: null, status: 'pending' }) },
    });
    await Team.upsertProfile(id, { removedAt: new Date(), removedById: viewer.id, isMainOwner: false }, tx);
    return { role, devicesSignedOut: devices.count, sessionsEnded, keptPin: keepPin };
  });
  await audit('admin_revoked_user_access', { accountId: id, ctx, metadata: { revokedRoles: [result.role], byUserId: viewer.id, devicesSignedOut: result.devicesSignedOut, sessionsEnded: result.sessionsEnded, keptPin: result.keptPin } });
  return { ...(await detail(id, viewer)), devicesSignedOut: result.devicesSignedOut };
}

// Only the main owner can hand the title to another active owner.
export async function makeMainOwner({ viewer, id, ctx }) {
  await prisma.$transaction(async (tx) => {
    const me = await begin(tx, viewer);
    if (!isMainOwner(me)) throw forbidden('FORBIDDEN', 'Only the main owner can hand over the main-owner title.');
    const a = await Team.findMember(id, tx);
    if (!a || a.id === viewer.id || appRoleOf(a) !== 'ADMIN' || statusOf(a) !== 'active') {
      throw badRequest('NOT_ACTIVE_OWNER', 'Only another owner who has set up the app can become the main owner.');
    }
    await Team.clearMainOwner(tx);
    await Team.upsertProfile(id, { isMainOwner: true }, tx);
  });
  await audit('admin_main_owner_changed', { accountId: id, ctx, metadata: { from: viewer.id, to: id, byUserId: viewer.id } });
  return detail(id, viewer);
}

// That phone needs the PIN and an SMS code again.
export async function signOutPhone({ viewer, id, deviceRowId, ctx }) {
  const device = await prisma.$transaction(async (tx) => {
    await loadForChange(tx, viewer, id);
    const d = await Device.findById(deviceRowId, tx);
    if (!d || d.authAccountId !== id || d.revokedAt) throw notFound('DEVICE_NOT_FOUND', 'That phone is no longer signed in.');
    await Device.revoke(d.id, tx);
    await Session.revokeWhere({ trustedDeviceId: d.id }, REVOKE.DEVICE_SIGNED_OUT, {}, tx);
    return d;
  });
  await audit('session_revoked_by_admin', { accountId: id, ctx, metadata: { device: device.name, byUserId: viewer.id } });
  return detail(id, viewer);
}

// Every phone and old-app sign-in (website sign-ins of a customer are left alone).
export async function signOutAllPhones({ viewer, id, ctx }) {
  const result = await prisma.$transaction(async (tx) => {
    await loadForChange(tx, viewer, id);
    const devices = await Device.revokeAllForAccount(id, tx);
    const sessionsEnded = await Session.revokeWhere(
      { authAccountId: id, OR: [{ trustedDeviceId: { not: null } }, { platform: null }, { platform: { not: 'web' } }] },
      REVOKE.DEVICE_SIGNED_OUT, {}, tx,
    );
    return { devicesSignedOut: devices.count, sessionsEnded };
  });
  await audit('session_revoked_by_admin', { accountId: id, ctx, metadata: { all: true, ...result, byUserId: viewer.id } });
  return { ...(await detail(id, viewer)), ...result };
}
