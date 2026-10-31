// AuthEvent: the audit trail (shown in the Activity log, Module 10).
import { prisma } from '../config/database.js';

export const create = (data, db = prisma) => db.authEvent.create({ data });
