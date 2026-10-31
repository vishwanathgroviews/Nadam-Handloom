// Pincode: India Post's directory, one row per pincode (scripts/load-pincodes.js).
import { prisma } from '../config/database.js';

export const find = (pincode, db = prisma) => db.pincode.findUnique({ where: { pincode } });
