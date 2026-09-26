import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Prisma's 5s default expired a 23-item Scan to Sell bill (each item is a
    // few round trips to the remote database). 15s fits bills of ~60 items and
    // stays under the staff app's 20s request timeout, so the app never gives
    // up on a sale that then commits anyway.
    transactionOptions: { maxWait: 5000, timeout: 15000 },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
