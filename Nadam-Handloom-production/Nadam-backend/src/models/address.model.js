// Address: a customer's saved delivery addresses. Orders keep their own copy of the
// address (Order.shippingAddress), so editing or deleting one never changes an order.
import { prisma } from '../config/database.js';

export const list = (authAccountId, db = prisma) =>
  db.address.findMany({ where: { authAccountId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });

export const count = (authAccountId, db = prisma) => db.address.count({ where: { authAccountId } });

export const findOwn = (authAccountId, id, db = prisma) => db.address.findFirst({ where: { id, authAccountId } });

export const create = (data, db = prisma) => db.address.create({ data });
export const update = (id, data, db = prisma) => db.address.update({ where: { id }, data });
export const remove = (id, db = prisma) => db.address.delete({ where: { id } });

export const clearDefault = (authAccountId, db = prisma) =>
  db.address.updateMany({ where: { authAccountId, isDefault: true }, data: { isDefault: false } });

export const newest = (authAccountId, db = prisma) =>
  db.address.findFirst({ where: { authAccountId }, orderBy: { updatedAt: 'desc' } });

export const removeAll = (authAccountId, db = prisma) => db.address.deleteMany({ where: { authAccountId } });

// One change to a customer's addresses at a time (the limit and the default stay right).
export const lockFor = (authAccountId, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-addresses:${authAccountId}`}))`;
