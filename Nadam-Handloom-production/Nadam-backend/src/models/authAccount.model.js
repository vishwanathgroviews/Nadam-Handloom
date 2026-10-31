// AuthAccount: one person who can sign in. The admin app only accepts accounts
// that hold an ADMIN (Owner) or STAFF role and are not deleted.
import { prisma } from '../config/database.js';
import { AUTH } from '../config/constants.js';

export const withRolesAndName = {
  roles: { include: { role: true } },
  adminProfile: true,
  userProfile: true,
};

export const appRoleOf = (account) => {
  const names = (account?.roles || []).map((r) => r.role.name);
  if (names.includes('ADMIN')) return 'ADMIN';
  if (names.includes('STAFF')) return 'STAFF';
  return null;
};

export const hasAppAccess = (account) => !!account && !account.deletedAt && account.status !== 'deleted' && !!appRoleOf(account);

export const displayNameOf = (account) => {
  const p = account?.adminProfile || account?.userProfile;
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || 'Team member';
};

export const findByMobile = (mobile, db = prisma) =>
  db.authAccount.findUnique({ where: { phone: mobile }, include: withRolesAndName });

export const findById = (id, db = prisma) => db.authAccount.findUnique({ where: { id }, include: withRolesAndName });

// The account behind a mobile number, only if it may use the admin app.
export async function findAppAccountByMobile(mobile, db = prisma) {
  const account = await findByMobile(mobile, db);
  return hasAppAccess(account) ? account : null;
}

// Wrong PIN: add one to the counter atomically and return the new count.
// Takes one PIN try before the PIN is checked, in one database step, so tries sent at the
// same moment can't all be checked (an ended lock starts again at 1). Returns
// { tries, lockCount } or null when no try is left (locked, or the tries are in use).
export async function takePinTry(id, max, db = prisma) {
  // Times are stored in UTC without a zone: compare with the database clock in UTC.
  const rows = await db.$queryRaw`
    UPDATE "AuthAccount" SET
      "failedLoginAttempts" = CASE WHEN "lockedUntil" IS NOT NULL AND "lockedUntil" <= (now() AT TIME ZONE 'utc') THEN 1 ELSE "failedLoginAttempts" + 1 END,
      "lockedUntil" = CASE WHEN "lockedUntil" IS NOT NULL AND "lockedUntil" <= (now() AT TIME ZONE 'utc') THEN NULL ELSE "lockedUntil" END,
      "updatedAt" = (now() AT TIME ZONE 'utc')
    WHERE id = ${id}
      AND ("lockedUntil" IS NULL OR "lockedUntil" <= (now() AT TIME ZONE 'utc'))
      AND ("failedLoginAttempts" < ${max} OR "lockedUntil" IS NOT NULL)
    RETURNING "failedLoginAttempts" AS tries, "lockCount"`;
  return rows[0] ? { tries: rows[0].tries, lockCount: rows[0].lockCount } : null;
}

// Starts a lock unless one is already running (two requests can't both lengthen it).
// Returns the lock now in force.
export async function lockIfOpen(id, now = new Date(), minutesFor, db = prisma) {
  const a = await db.authAccount.findUnique({ where: { id }, select: { lockCount: true, lockedUntil: true } });
  if (a.lockedUntil && a.lockedUntil > now) return a;
  const lockCount = a.lockCount + 1;
  const lockedUntil = new Date(now.getTime() + minutesFor(lockCount) * 60000);
  const r = await db.authAccount.updateMany({
    where: { id, lockCount: a.lockCount, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { lockCount, lockedUntil, failedLoginAttempts: 0 },
  });
  if (r.count === 1) return { lockCount, lockedUntil };
  return db.authAccount.findUnique({ where: { id }, select: { lockCount: true, lockedUntil: true } });
}

export const setLock = (id, { lockCount, lockedUntil }, db = prisma) =>
  db.authAccount.update({ where: { id }, data: { lockCount, lockedUntil, failedLoginAttempts: 0 } });

// A lock that has run out: give 5 fresh tries (keep lockCount so the next lock is longer).
export const endExpiredLock = (id, db = prisma) =>
  db.authAccount.update({ where: { id }, data: { lockedUntil: null, failedLoginAttempts: 0 } });

export const clearLocks = (id, db = prisma) =>
  db.authAccount.update({ where: { id }, data: { failedLoginAttempts: 0, lockCount: 0, lockedUntil: null } });

export const setPin = (id, { mpinHash, activate = false, rotateStamp = false, newStamp }, db = prisma) =>
  db.authAccount.update({
    where: { id },
    data: {
      mpinHash,
      mpinSetAt: new Date(),
      ...(activate ? { status: 'active', phoneVerifiedAt: new Date() } : {}),
      ...(rotateStamp ? { securityStamp: newStamp } : {}),
      failedLoginAttempts: 0,
      lockCount: 0,
      lockedUntil: null,
    },
  });

export const markPhoneVerified = (id, db = prisma) => db.authAccount.update({ where: { id }, data: { phoneVerifiedAt: new Date() } });

export const isAppRole = (name) => AUTH.APP_ROLES.includes(name);
