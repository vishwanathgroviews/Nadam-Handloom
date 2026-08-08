"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolesAndPermissions = getRolesAndPermissions;
const prisma_1 = require("../../config/prisma");
async function getRolesAndPermissions(authAccountId) {
    const userRoles = await prisma_1.prisma.userRole.findMany({
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
    const roleNames = new Set();
    const permissionNames = new Set();
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
//# sourceMappingURL=permission.service.js.map