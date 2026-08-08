import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const roleNames = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
  const roles: Record<string, { id: string }> = {};

  for (const roleName of roleNames) {
    roles[roleName] = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  // Define some core permissions
  const permissionNames = [
    'users:read',
    'users:write',
    'users:delete',
    'roles:read',
    'roles:write',
  ];

  const permissions: Record<string, { id: string }> = {};

  for (const permName of permissionNames) {
    permissions[permName] = await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  // Link roles to permissions
  const rolePermissionMap: Record<string, string[]> = {
    ADMIN: permissionNames,
    STAFF: ['users:read', 'users:write', 'roles:read'],
    CUSTOMER: [],
  };

  for (const [roleName, permNames] of Object.entries(rolePermissionMap)) {
    const role = roles[roleName];
    if (!role) continue;
    for (const permName of permNames) {
      const permission = permissions[permName];
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
