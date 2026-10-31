// PushToken: browsers that accepted notifications (Firebase Cloud Messaging tokens).
import { prisma } from '../config/database.js';

export const findByToken = (token, db = prisma) => db.pushToken.findUnique({ where: { token } });

export const upsert = (token, create, update, db = prisma) =>
  db.pushToken.upsert({ where: { token }, create: { token, ...create }, update });

export const update = (id, data, db = prisma) => db.pushToken.update({ where: { id }, data });

// Active tokens of a customer that follow a topic.
export const activeForAccount = (authAccountId, topic, db = prisma) =>
  db.pushToken.findMany({ where: { authAccountId, removedAt: null, ...(topic ? { topics: { has: topic } } : {}) } });

export const activeCountForAccount = (authAccountId, db = prisma) =>
  db.pushToken.count({ where: { authAccountId, removedAt: null } });

export const markRemoved = (ids, reason, db = prisma) =>
  db.pushToken.updateMany({ where: { id: { in: ids }, removedAt: null }, data: { removedAt: new Date(), removedReason: reason } });

export const removeAllForAccount = (authAccountId, reason, db = prisma) =>
  db.pushToken.updateMany({ where: { authAccountId, removedAt: null }, data: { removedAt: new Date(), removedReason: reason, authAccountId: null } });

// Housekeeping: tokens removed long ago are deleted.
export const deleteRemovedBefore = (before, db = prisma) => db.pushToken.deleteMany({ where: { removedAt: { lt: before } } });
