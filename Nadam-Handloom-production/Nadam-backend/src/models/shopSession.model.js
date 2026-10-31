// Website sign-ins (Session rows with kind "customer"). One active row per browser;
// every renewal ends the old row (reason "rotated") and creates a child (parentId).
import { prisma } from '../config/database.js';
import { CUSTOMER_INCLUDE } from './customer.model.js';

const KIND = 'customer';
const full = { authAccount: { include: CUSTOMER_INCLUDE } };

export const create = (data, db = prisma) => db.session.create({ data: { ...data, kind: KIND, platform: 'web' } });

export async function findByRefreshHash(refreshTokenHash, db = prisma) {
  const s = await db.session.findUnique({ where: { refreshTokenHash }, include: full });
  return s?.kind === KIND ? s : null;
}

export async function findById(id, db = prisma) {
  const s = await db.session.findUnique({ where: { id }, include: full });
  return s?.kind === KIND ? s : null;
}

// One change at a time to a customer's sign-ins: a renewal and "Sign out of all devices"
// (or the safety sign-out) can't cross, so a renewal never survives a sign-out everywhere.
export const lockAccount = (authAccountId, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-sessions:${authAccountId}`}))`;

export const findChildren = (parentId, db = prisma) =>
  db.session.findMany({ where: { parentId, kind: KIND }, orderBy: { createdAt: 'asc' } });

export async function revokeIfActive(id, reason, db = prisma) {
  const r = await db.session.updateMany({ where: { id, kind: KIND, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  return r.count === 1;
}

export async function revokeAllFor(authAccountId, reason, { compromised = false, exceptId = null } = {}, db = prisma) {
  const r = await db.session.updateMany({
    where: { authAccountId, kind: KIND, revokedAt: null, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    data: { revokedAt: new Date(), revokeReason: reason, ...(compromised ? { isCompromised: true } : {}) },
  });
  return r.count;
}

// Signed-in browsers: active and not expired, newest activity first.
export const listActive = (authAccountId, db = prisma) =>
  db.session.findMany({
    where: { authAccountId, kind: KIND, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
