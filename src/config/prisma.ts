import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Passing { connectionString } directly to PrismaPg leaves the pool's
// user/password unset in @prisma/adapter-pg 7.x; wrapping it in a real pg.Pool
// is what actually threads the credentials through SASL auth.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
