// The single Prisma client for the whole server, connected through node-postgres.
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Time limits, so a stalled database (a Neon wake-up, a network blip) gives a quick "try again"
// instead of requests that wait forever: 10 s to get a connection, 28 s per statement (under
// the app's 30-second request timeout), idle connections closed after 30 s.
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 28_000,
  query_timeout: 29_000,
});
// Neon's connection gateway drops the statement_timeout sent when connecting, so each new
// connection also sets it itself (it runs before anything else on that connection).
pool.on('connect', (client) => {
  client.query('SET statement_timeout = 28000').catch(() => {});
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: env.isProduction ? ['error'] : ['error', 'warn'],
  // Stays under the app's 30-second request timeout, so the app never gives up
  // on a change that then completes anyway.
  transactionOptions: { maxWait: 5000, timeout: 25000 },
});

export async function disconnectDatabase() {
  await prisma.$disconnect();
  await pool.end().catch(() => {});
}
