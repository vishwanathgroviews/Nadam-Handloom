import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createFakePrisma, seedRoles } from '../test/fakePrisma';
import { seedFullCatalog } from './seedMockCatalog';
import { hashSecret } from '../utils/hash';

const isMock =
  process.env.USE_MOCK_DB === 'true' ||
  process.env.DATABASE_URL === 'memory' ||
  process.env.DATABASE_URL === 'mock';

let prismaClient: any;

if (isMock) {
  const fake = createFakePrisma();
  const roles = seedRoles(fake.db);
  seedFullCatalog(fake.db);

  fake.client.$connect = async () => {
    const adminMobile = process.env.SEED_ADMIN_MOBILE || '9999999999';
    const adminMpin = process.env.SEED_ADMIN_MPIN || '000000';
    const mpinHash = await hashSecret(adminMpin);

    const existing = await fake.client.authAccount.findUnique({ where: { phone: adminMobile } });
    if (!existing) {
      const account = await fake.client.authAccount.create({
        data: {
          phone: adminMobile,
          email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
          mpinHash,
          mpinSetAt: new Date(),
          status: 'active',
          phoneVerifiedAt: new Date(),
          emailVerifiedAt: new Date(),
          adminProfile: { create: { firstName: 'Dev', lastName: 'Admin' } },
        },
      });

      await fake.client.userRole.create({
        data: { authAccountId: account.id, roleId: roles.ADMIN!.id },
      });
    }

    const existingSetting = await fake.client.storeSetting.findUnique({ where: { key: 'store_phone' } });
    if (!existingSetting) {
      await fake.client.storeSetting.create({
        data: { key: 'store_phone', value: '+919494170180', updatedAt: new Date() },
      });
    }

    console.log(`[Mock DB] In-memory database active. Admin login: ${adminMobile} / MPIN: ${adminMpin}`);
  };

  fake.client.$disconnect = async () => {};
  prismaClient = fake.client;
} else {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  const globalForPrisma = global as unknown as { prisma: PrismaClient };

  prismaClient =
    globalForPrisma.prisma ||
    new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      transactionOptions: { maxWait: 5000, timeout: 25000 },
    });

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient;
}

export const prisma: PrismaClient = prismaClient;
export default prisma;
