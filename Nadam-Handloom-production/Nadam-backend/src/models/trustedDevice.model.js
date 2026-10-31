// TrustedDevice: a phone or tablet that passed the SMS check for an account.
import { prisma } from '../config/database.js';

export const findActive = (authAccountId, deviceId, db = prisma) =>
  db.trustedDevice.findFirst({ where: { authAccountId, deviceId, revokedAt: null } });

export const findById = (id, db = prisma) => db.trustedDevice.findUnique({ where: { id } });

// Trust (or re-trust) this device for this account. A re-trusted device starts
// without Face ID; it must be turned on again.
export const trust = (authAccountId, { id: deviceId, name, platform }, db = prisma) =>
  db.trustedDevice.upsert({
    where: { authAccountId_deviceId: { authAccountId, deviceId } },
    create: { authAccountId, deviceId, name, platform },
    update: { name, platform, revokedAt: null, trustedAt: new Date(), lastSeenAt: new Date() },
  });

export const touch = (id, { name, platform, appVersion } = {}, db = prisma) =>
  db.trustedDevice.update({ where: { id }, data: { lastSeenAt: new Date(), ...(name ? { name } : {}), ...(platform ? { platform } : {}), ...(appVersion ? { appVersion } : {}) } });

export const listActive = (authAccountId, db = prisma) =>
  db.trustedDevice.findMany({ where: { authAccountId, revokedAt: null }, orderBy: { lastSeenAt: 'desc' } });

// Signed out from My devices / Forgot PIN / Change PIN with "sign out others":
// the device must pass the SMS check again, and its Face ID key is dropped.
export const revoke = (id, db = prisma) =>
  db.trustedDevice.update({ where: { id }, data: { revokedAt: new Date(), biometricPublicKey: null, biometricEnabledAt: null } });

export const setBiometricKey = (id, publicKey, db = prisma) =>
  db.trustedDevice.update({ where: { id }, data: { biometricPublicKey: publicKey, biometricEnabledAt: publicKey ? new Date() : null } });

export const clearBiometricForAccount = (authAccountId, db = prisma) =>
  db.trustedDevice.updateMany({ where: { authAccountId }, data: { biometricPublicKey: null, biometricEnabledAt: null } });

// Every phone of an account at once (access removed, "sign out all phones", invite again).
export const revokeAllForAccount = (authAccountId, db = prisma) =>
  db.trustedDevice.updateMany({ where: { authAccountId, revokedAt: null }, data: { revokedAt: new Date(), biometricPublicKey: null, biometricEnabledAt: null } });
