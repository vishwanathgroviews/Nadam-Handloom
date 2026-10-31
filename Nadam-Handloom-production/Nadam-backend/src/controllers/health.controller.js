import { prisma } from '../config/database.js';
import { sms } from '../services/sms/index.js';

export async function health(_req, res) {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  res.status(database === 'ok' ? 200 : 503).json({ status: database === 'ok' ? 'ok' : 'degraded', database, sms: sms.name, version: '2.0.0' });
}
