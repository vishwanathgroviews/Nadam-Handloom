// Notification: every message sent to a customer, with its result.
import { prisma } from '../config/database.js';

export const create = (data, db = prisma) => db.notification.create({ data });
export const update = (id, data, db = prisma) => db.notification.update({ where: { id }, data });

export const countRecent = (authAccountId, type, since, db = prisma) =>
  db.notification.count({ where: { authAccountId, type, createdAt: { gte: since } } });
