import { prisma } from '../../config/prisma';

export interface RolesAndPermissions {
  roles: string[];
  permissions: string[];
}

export async function getRolesAndPermissions(authAccountId: string): Promise<RolesAndPermissions> {
  const userRoles = await prisma.userRole.findMany({
    where: { authAccountId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const roleNames = new Set<string>();
  const permissionNames = new Set<string>();

  for (const userRole of userRoles) {
    roleNames.add(userRole.role.name);
    for (const rolePermission of userRole.role.permissions) {
      permissionNames.add(rolePermission.permission.name);
    }
  }

  return {
    roles: Array.from(roleNames),
    permissions: Array.from(permissionNames),
  };
}
