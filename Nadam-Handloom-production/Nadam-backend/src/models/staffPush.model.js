// Admin app: one notification token per signed-in phone (StaffPushToken).
import { prisma } from '../config/database.js';

export const forDevice = (trustedDeviceId, db = prisma) => db.staffPushToken.findUnique({ where: { trustedDeviceId } });

// The phone's token (a reinstalled app may bring a token another row had: that row goes).
// One phone's sends are taken one at a time: the app sends its token on start and again when
// Android reports it, a moment apart (found on a real phone, 17 Oct 2026).
export function save({ trustedDeviceId, authAccountId, token, platform, payments }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`staff-push:${trustedDeviceId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`staff-push-token:${token}`}))`;
    await tx.staffPushToken.deleteMany({ where: { token, NOT: { trustedDeviceId } } });
    return tx.staffPushToken.upsert({
      where: { trustedDeviceId },
      create: { trustedDeviceId, authAccountId, token, platform, payments },
      update: { authAccountId, token, platform, payments, lastSeenAt: new Date() },
    });
  });
}

export const setPayments = (trustedDeviceId, payments, db = prisma) => db.staffPushToken.updateMany({ where: { trustedDeviceId }, data: { payments } });
export const removeForDevice = (trustedDeviceId, db = prisma) => db.staffPushToken.deleteMany({ where: { trustedDeviceId } });
export const removeById = (id, db = prisma) => db.staffPushToken.deleteMany({ where: { id } });

// Owners' phones that want payment notifications: still an owner, the phone still trusted and
// signed in (a session not ended and not expired).
export const ownerPhones = (now = new Date(), db = prisma) => db.staffPushToken.findMany({
  where: {
    payments: true,
    authAccount: { deletedAt: null, status: { not: 'deleted' }, roles: { some: { role: { name: 'ADMIN' } } } },
    trustedDevice: { revokedAt: null, sessions: { some: { kind: 'staff', revokedAt: null, expiresAt: { gt: now } } } },
  },
  select: { id: true, token: true, platform: true },
});
