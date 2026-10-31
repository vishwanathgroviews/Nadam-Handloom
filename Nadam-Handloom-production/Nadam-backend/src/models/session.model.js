// Session: one 7-day sign-in on one device. The refresh token is stored only as
// a SHA-256 hash. Every renewal ends the old row (reason "rotated") and creates a new one.
// kind: "staff" (admin app and old app) or "customer" (the new website, W1). Each side
// only touches its own kind: the website's own queries are in shopSession.model.js.
import { prisma } from '../config/database.js';

const full = { trustedDevice: true, authAccount: { include: { roles: { include: { role: true } }, adminProfile: true, userProfile: true } } };

export const create = (data, db = prisma) => db.session.create({ data });

export const findByRefreshHash = (refreshTokenHash, db = prisma) =>
  db.session.findUnique({ where: { refreshTokenHash }, include: full });

export const findById = (id, db = prisma) => db.session.findUnique({ where: { id }, include: full });

// Ends one session only if it is still active; returns true when this call ended it
// (so two renewals racing for the same token cannot both succeed).
export async function revokeIfActive(id, reason, db = prisma) {
  const r = await db.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  return r.count === 1;
}

// Admin-side bulk sign-outs never end a customer's website sign-ins (kind defaults to staff).
export async function revokeWhere(where, reason, { compromised = false } = {}, db = prisma) {
  const r = await db.session.updateMany({
    where: { kind: 'staff', ...where, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason, ...(compromised ? { isCompromised: true } : {}) },
  });
  return r.count;
}

// Clean-up: rotated rows are kept until their own expiry so a stolen old token is still recognised.
export const deleteExpiredRotated = (db = prisma) =>
  db.session.deleteMany({ where: { revokeReason: { in: ['rotated', 'superseded'] }, expiresAt: { lt: new Date() } } });

// The renewals made from one sign-in (admin app: since 16 Oct 2026).
export const findChildren = (parentId, db = prisma) =>
  db.session.findMany({ where: { parentId, kind: 'staff' }, orderBy: { createdAt: 'asc' } });

// The first request made with a sign-in.
export const markUsed = (id, db = prisma) => db.session.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });

// Replaces a renewal whose reply was lost: only while it is still active and never used.
export async function supersedeIfUnused(id, db = prisma) {
  const r = await db.session.updateMany({ where: { id, revokedAt: null, usedAt: null }, data: { revokedAt: new Date(), revokeReason: 'superseded' } });
  return r.count === 1;
}
