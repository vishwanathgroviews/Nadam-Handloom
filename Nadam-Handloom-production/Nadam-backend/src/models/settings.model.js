// The shared settings row (AppConfig 'default'): the old app, the old website and the
// new app all read it (Module 11).
import { prisma } from '../config/database.js';

export const ID = 'default';
export const get = (db = prisma) => db.appConfig.findUnique({ where: { id: ID } });
export const save = (data, db = prisma) => db.appConfig.upsert({ where: { id: ID }, update: data, create: { id: ID, ...data } });

// Owners who can sign in today (active, with a PIN): Settings warns under 2 (6.9).
export const ownersWhoCanSignIn = (db = prisma) =>
  db.authAccount.count({ where: { status: 'active', deletedAt: null, mpinHash: { not: null }, roles: { some: { role: { name: 'ADMIN' } } } } });

// Phones used in the last `days` days, with the app version they last ran.
export const recentPhones = (since, db = prisma) =>
  db.trustedDevice.findMany({
    where: { revokedAt: null, lastSeenAt: { gte: since }, authAccount: { status: 'active', deletedAt: null } },
    select: { name: true, platform: true, appVersion: true, authAccount: { select: { adminProfile: { select: { firstName: true, lastName: true } } } } },
  });

// Shop details changes made after `at`, newest first (to print an old invoice with the
// details of its day).
export const shopChangesSince = (at, db = prisma) =>
  db.authEvent.findMany({ where: { eventType: 'shop_details_updated', createdAt: { gt: at } }, orderBy: { createdAt: 'desc' }, select: { metadata: true } });
