// OtpCode: an SMS code sent to an account. With Message Central the code itself
// is never known to us: codeHash holds "provider:<verificationId>" instead
// (the same convention as the old backend).
import { prisma } from '../config/database.js';

export const supersede = (authAccountId, purpose, db = prisma) =>
  db.otpCode.updateMany({ where: { authAccountId, purpose, used: false }, data: { used: true } });

export const create = (data, db = prisma) => db.otpCode.create({ data });

export const latestUnused = (authAccountId, purpose, db = prisma) =>
  db.otpCode.findFirst({ where: { authAccountId, purpose, used: false }, orderBy: { createdAt: 'desc' } });

export const markUsed = (id, db = prisma) => db.otpCode.update({ where: { id }, data: { used: true } });

// Takes one try before the code is checked, so guesses sent at the same moment can't share
// a try. Returns the tries used now, or null when the code is used or out of tries.
export async function takeAttempt(id, max, db = prisma) {
  const rows = await db.$queryRaw`UPDATE "OtpCode" SET attempts = attempts + 1 WHERE id = ${id} AND used = false AND attempts < ${max} RETURNING attempts`;
  return rows.length ? rows[0].attempts : null;
}
// The SMS service could not check the code: that try doesn't count.
export const giveBackAttempt = (id, db = prisma) =>
  db.otpCode.updateMany({ where: { id, attempts: { gt: 0 } }, data: { attempts: { decrement: 1 } } });

// Marks it used only if it still was open: true when this call did (two requests with the
// same right code can't both succeed).
export async function useIfOpen(id, db = prisma) {
  const r = await db.otpCode.updateMany({ where: { id, used: false }, data: { used: true } });
  return r.count === 1;
}

export const findById = (id, db = prisma) => db.otpCode.findUnique({ where: { id } });

export const latest = (authAccountId, purpose, db = prisma) =>
  db.otpCode.findFirst({ where: { authAccountId, purpose }, orderBy: { createdAt: 'desc' } });
