import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.prisma, __fake: fake };
});

describe('permission.service', () => {
  it('flattens roles/permissions for an account with an ADMIN role', async () => {
    const { getRolesAndPermissions } = await import('./permission.service');
    const { __fake: fake }: any = await import('../../config/prisma');

    const account = await fake.prisma.authAccount.create({
      data: {
        email: 'admin-perm@example.com',
        passwordHash: 'x',
        roles: { create: { roleId: fake._internal.adminRole.id } },
      },
    });

    const { roles, permissions } = await getRolesAndPermissions(account.id);

    expect(roles).toEqual(['ADMIN']);
    expect(permissions.sort()).toEqual(['users:read', 'users:write']);
  });

  it('returns empty arrays for an account with no roles', async () => {
    const { getRolesAndPermissions } = await import('./permission.service');
    const { __fake: fake }: any = await import('../../config/prisma');

    const account = await fake.prisma.authAccount.create({
      data: { email: 'norole@example.com', passwordHash: 'x' },
    });

    const { roles, permissions } = await getRolesAndPermissions(account.id);

    expect(roles).toEqual([]);
    expect(permissions).toEqual([]);
  });
});
