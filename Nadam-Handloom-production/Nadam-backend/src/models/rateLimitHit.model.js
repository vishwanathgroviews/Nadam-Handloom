// RateLimitHit: one row per counted request, grouped by bucket key.
import { prisma } from '../config/database.js';

export const add = (bucketKey, db = prisma) => db.rateLimitHit.create({ data: { bucketKey }, select: { id: true } });
export const lockKey = (bucketKey, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bucketKey}))`;

export const countSince = (bucketKey, since, db = prisma) =>
  db.rateLimitHit.count({ where: { bucketKey, createdAt: { gte: since } } });

export const latest = (bucketKey, db = prisma) =>
  db.rateLimitHit.findFirst({ where: { bucketKey }, orderBy: { createdAt: 'desc' } });

export const deleteOld = (prefix, before, db = prisma) =>
  db.rateLimitHit.deleteMany({ where: { bucketKey: { startsWith: prefix }, createdAt: { lt: before } } });

export const oldestSince = (bucketKey, since, db = prisma) =>
  db.rateLimitHit.findFirst({ where: { bucketKey, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } });
