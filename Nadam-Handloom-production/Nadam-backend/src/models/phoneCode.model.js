// PhoneCode: website SMS codes (W1), keyed by mobile because a new customer has no
// account yet. codeHash is a SHA-256 hash, or "provider:<id>" for Message Central.
// ipAddress holds the sender's network (utils/network.js: an IPv4 address, or an IPv6
// /64 block). A row is reserved (usedAt set, codeHash "pending") before the SMS goes, so
// parallel requests can't slip past the limits; it becomes a live code once the SMS is sent.
import { prisma } from '../config/database.js';

export const create = (data, db = prisma) => db.phoneCode.create({ data });

// The newest code for a number and purpose, used or not.
export const latest = (mobile, purpose, db = prisma) =>
  db.phoneCode.findFirst({ where: { mobile, purpose }, orderBy: { createdAt: 'desc' } });

export const latestOpen = (mobile, purpose, db = prisma) =>
  db.phoneCode.findFirst({ where: { mobile, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } });

export const countForMobileSince = (mobile, since, db = prisma) =>
  db.phoneCode.count({ where: { mobile, createdAt: { gte: since } } });

export const oldestForMobileSince = (mobile, since, db = prisma) =>
  db.phoneCode.findFirst({ where: { mobile, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } });

export const countForNetworkSince = (ipAddress, since, db = prisma) =>
  db.phoneCode.count({ where: { ipAddress, createdAt: { gte: since } } });

export const oldestForNetworkSince = (ipAddress, since, db = prisma) =>
  db.phoneCode.findFirst({ where: { ipAddress, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } });

// Codes sent to numbers with no account yet (the daily limit counts only these).
export const countNewNumbersSince = (since, db = prisma) => db.phoneCode.count({ where: { createdAt: { gte: since }, authAccountId: null } });

// One sender at a time checks the limits and reserves its row (a few milliseconds).
export const lockSending = (db) => db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('shop-sms-send'))");

export const findById = (id, db = prisma) => db.phoneCode.findUnique({ where: { id } });
export const remove = (id, db = prisma) => db.phoneCode.deleteMany({ where: { id } });

// The reserved row becomes the live code.
export const activate = (id, { codeHash, expiresAt }, db = prisma) =>
  db.phoneCode.update({ where: { id }, data: { codeHash, expiresAt, usedAt: null } });

// Takes one try before the code is checked, so parallel guesses can't share a try.
// Returns the tries used now, or null when the code is closed or out of tries.
export async function takeAttempt(id, max, db = prisma) {
  const rows = await db.$queryRaw`UPDATE "PhoneCode" SET attempts = attempts + 1 WHERE id = ${id} AND "usedAt" IS NULL AND attempts < ${max} RETURNING attempts`;
  return rows.length ? rows[0].attempts : null;
}
// The SMS service could not check the code: that try doesn't count.
export const giveBackAttempt = (id, db = prisma) =>
  db.phoneCode.updateMany({ where: { id, attempts: { gt: 0 } }, data: { attempts: { decrement: 1 } } });

// Older codes for the same number and purpose stop working when a new one is sent.
export const closeOpen = (mobile, purpose, db = prisma) =>
  db.phoneCode.updateMany({ where: { mobile, purpose, usedAt: null }, data: { usedAt: new Date() } });

export const addAttempt = (id, db = prisma) =>
  db.phoneCode.update({ where: { id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });

// Closes a code only if it is still open; true when this call closed it (two
// requests with the same right code cannot both succeed).
export async function closeIfOpen(id, db = prisma) {
  const r = await db.phoneCode.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1;
}

// Housekeeping: the limits look back one day at most.
export const deleteOlderThan = (before, db = prisma) => db.phoneCode.deleteMany({ where: { createdAt: { lt: before } } });
