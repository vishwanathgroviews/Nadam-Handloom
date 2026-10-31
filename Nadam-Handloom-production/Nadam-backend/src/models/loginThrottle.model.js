// LoginThrottle: wrong-PIN counting for numbers without an app account.
import { prisma } from '../config/database.js';

export const get = (mobile, db = prisma) => db.loginThrottle.findUnique({ where: { mobile } });

export const save = (mobile, data, db = prisma) =>
  db.loginThrottle.upsert({ where: { mobile }, create: { mobile, ...data }, update: data });

// The same as AuthAccount.takePinTry, for a number with no account (so the replies look the same).
export async function takeTry(mobile, max, db = prisma) {
  const rows = await db.$queryRaw`
    INSERT INTO "LoginThrottle" (mobile, "failedAttempts", "lockCount", "updatedAt") VALUES (${mobile}, 1, 0, (now() AT TIME ZONE 'utc'))
    ON CONFLICT (mobile) DO UPDATE SET
      "failedAttempts" = CASE WHEN "LoginThrottle"."lockedUntil" IS NOT NULL AND "LoginThrottle"."lockedUntil" <= (now() AT TIME ZONE 'utc') THEN 1 ELSE "LoginThrottle"."failedAttempts" + 1 END,
      "lockedUntil" = CASE WHEN "LoginThrottle"."lockedUntil" IS NOT NULL AND "LoginThrottle"."lockedUntil" <= (now() AT TIME ZONE 'utc') THEN NULL ELSE "LoginThrottle"."lockedUntil" END,
      "updatedAt" = (now() AT TIME ZONE 'utc')
    WHERE ("LoginThrottle"."lockedUntil" IS NULL OR "LoginThrottle"."lockedUntil" <= (now() AT TIME ZONE 'utc'))
      AND ("LoginThrottle"."failedAttempts" < ${max} OR "LoginThrottle"."lockedUntil" IS NOT NULL)
    RETURNING "failedAttempts" AS tries, "lockCount"`;
  return rows[0] ? { tries: rows[0].tries, lockCount: rows[0].lockCount } : null;
}

export async function lockIfOpen(mobile, now = new Date(), minutesFor, db = prisma) {
  const t = await db.loginThrottle.findUnique({ where: { mobile } });
  if (t?.lockedUntil && t.lockedUntil > now) return t;
  const lockCount = (t?.lockCount ?? 0) + 1;
  const lockedUntil = new Date(now.getTime() + minutesFor(lockCount) * 60000);
  const r = await db.loginThrottle.updateMany({
    where: { mobile, lockCount: t?.lockCount ?? 0, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
    data: { lockCount, lockedUntil, failedAttempts: 0 },
  });
  if (r.count === 1) return { lockCount, lockedUntil };
  return db.loginThrottle.findUnique({ where: { mobile } });
}
