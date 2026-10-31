// AuthChallenge: one-time challenge a device signs for Face ID / fingerprint sign-in.
import { prisma } from '../config/database.js';

export const create = (data, db = prisma) => db.authChallenge.create({ data });

export const findWithDevice = (id, db = prisma) =>
  db.authChallenge.findUnique({ where: { id }, include: { trustedDevice: true } });

// Marks it used only once; returns true for the single call that consumed it.
export async function consume(id, db = prisma) {
  const r = await db.authChallenge.updateMany({ where: { id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return r.count === 1;
}

export const deleteOld = (before, db = prisma) => db.authChallenge.deleteMany({ where: { createdAt: { lt: before } } });
