import { randomUUID } from 'crypto';

/**
 * A minimal in-memory stand-in for PrismaClient, hand-written to match exactly the
 * query shapes this codebase issues (not a general query engine). Used by tests via
 * `vi.mock('../../config/prisma', () => ({ prisma: fakePrisma }))` so integration
 * tests can exercise real request/response flow through supertest without a live DB.
 */
export function createFakePrisma() {
  const authAccounts = new Map<string, any>();
  const sessions = new Map<string, any>();
  const otpCodes = new Map<string, any>();
  const passwordResetTokens = new Map<string, any>();
  const roles = new Map<string, any>();
  const rolesByName = new Map<string, any>();
  const permissions = new Map<string, any>();
  const userRoles: { authAccountId: string; roleId: string }[] = [];
  const rolePermissions: { roleId: string; permissionId: string }[] = [];
  const authEvents: any[] = [];

  const seedRole = (name: string) => {
    const role = { id: randomUUID(), name, isSystem: true };
    roles.set(role.id, role);
    rolesByName.set(name, role);
    return role;
  };
  const customerRole = seedRole('CUSTOMER');
  const staffRole = seedRole('STAFF');
  const adminRole = seedRole('ADMIN');

  const seedPermission = (name: string) => {
    const perm = { id: randomUUID(), name };
    permissions.set(perm.id, perm);
    return perm;
  };
  const usersRead = seedPermission('users:read');
  const usersWrite = seedPermission('users:write');
  rolePermissions.push({ roleId: adminRole.id, permissionId: usersRead.id });
  rolePermissions.push({ roleId: adminRole.id, permissionId: usersWrite.id });
  rolePermissions.push({ roleId: staffRole.id, permissionId: usersRead.id });

  const matchesOr = (account: any, orClauses: any[]) =>
    orClauses.some((clause: any) =>
      Object.entries(clause).every(([k, v]) => v !== undefined && account[k] === v)
    );

  const findAccountByWhere = (where: any): any | null => {
    for (const account of authAccounts.values()) {
      if (where.deletedAt === null && account.deletedAt !== null) continue;
      if (where.id !== undefined && account.id !== where.id) continue;
      if (where.email !== undefined && account.email !== where.email) continue;
      if (where.phone !== undefined && account.phone !== where.phone) continue;
      if (where.OR && !matchesOr(account, where.OR)) continue;
      return account;
    }
    return null;
  };

  const authAccount = {
    findFirst: async ({ where }: any) => findAccountByWhere(where ?? {}),
    findUnique: async ({ where, select }: any) => {
      const account = where.id !== undefined ? authAccounts.get(where.id) ?? null : findAccountByWhere(where);
      if (!account) return null;
      if (select) {
        const projected: any = {};
        for (const key of Object.keys(select)) projected[key] = account[key];
        return projected;
      }
      return account;
    },
    create: async ({ data }: any) => {
      const id = randomUUID();
      const account = {
        id,
        email: data.email ?? null,
        phone: data.phone ?? null,
        passwordHash: data.passwordHash,
        status: 'active',
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        securityStamp: randomUUID(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        mfaEnabled: data.mfaEnabled ?? false,
        isCompromised: false,
        passwordChangedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      authAccounts.set(id, account);
      if (data.roles?.create) {
        userRoles.push({ authAccountId: id, roleId: data.roles.create.roleId });
      }
      return account;
    },
    update: async ({ where, data }: any) => {
      const account = authAccounts.get(where.id);
      if (!account) throw new Error('Account not found');
      Object.assign(account, data, { updatedAt: new Date() });
      return account;
    },
  };

  const session = {
    create: async ({ data }: any) => {
      const id = randomUUID();
      const row = { id, revokedAt: null, isCompromised: false, createdAt: new Date(), ...data };
      sessions.set(id, row);
      return row;
    },
    findUnique: async ({ where, include }: any) => {
      let row: any = null;
      if (where.id !== undefined) row = sessions.get(where.id) ?? null;
      else if (where.refreshTokenHash !== undefined) {
        row = [...sessions.values()].find((s) => s.refreshTokenHash === where.refreshTokenHash) ?? null;
      }
      if (!row) return null;
      if (include?.authAccount) {
        return { ...row, authAccount: authAccounts.get(row.authAccountId) ?? null };
      }
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = sessions.get(where.id);
      if (!row) throw new Error('Session not found');
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const row of sessions.values()) {
        if (where.authAccountId !== undefined && row.authAccountId !== where.authAccountId) continue;
        if (where.refreshTokenHash !== undefined && row.refreshTokenHash !== where.refreshTokenHash) continue;
        if (where.revokedAt === null && row.revokedAt !== null) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    },
  };

  const otpCode = {
    create: async ({ data }: any) => {
      const id = randomUUID();
      const row = { id, attempts: 0, used: false, createdAt: new Date(), ...data };
      otpCodes.set(id, row);
      return row;
    },
    findFirst: async ({ where }: any) => {
      const candidates = [...otpCodes.values()].filter(
        (row) =>
          row.authAccountId === where.authAccountId &&
          row.purpose === where.purpose &&
          row.used === where.used
      );
      candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return candidates[0] ?? null;
    },
    update: async ({ where, data }: any) => {
      const row = otpCodes.get(where.id);
      if (!row) throw new Error('OtpCode not found');
      if (data.attempts?.increment) row.attempts += data.attempts.increment;
      if (data.used !== undefined) row.used = data.used;
      return row;
    },
  };

  const passwordResetToken = {
    create: async ({ data }: any) => {
      const id = randomUUID();
      const row = { id, used: false, usedAt: null, createdAt: new Date(), ...data };
      passwordResetTokens.set(id, row);
      return row;
    },
    findUnique: async ({ where }: any) => {
      if (where.id !== undefined) return passwordResetTokens.get(where.id) ?? null;
      return [...passwordResetTokens.values()].find((r) => r.tokenHash === where.tokenHash) ?? null;
    },
    update: async ({ where, data }: any) => {
      const row = passwordResetTokens.get(where.id);
      if (!row) throw new Error('PasswordResetToken not found');
      Object.assign(row, data);
      return row;
    },
  };

  const userRole = {
    findMany: async ({ where }: any) => {
      return userRoles
        .filter((ur) => ur.authAccountId === where.authAccountId)
        .map((ur) => {
          const role = roles.get(ur.roleId);
          return {
            ...ur,
            role: {
              ...role,
              permissions: rolePermissions
                .filter((rp) => rp.roleId === ur.roleId)
                .map((rp) => ({ ...rp, permission: permissions.get(rp.permissionId) })),
            },
          };
        });
    },
  };

  const role = {
    findUnique: async ({ where }: any) => rolesByName.get(where.name) ?? null,
  };

  const authEvent = {
    create: async ({ data }: any) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...data };
      authEvents.push(row);
      return row;
    },
  };

  const client: any = {
    authAccount,
    session,
    otpCode,
    passwordResetToken,
    userRole,
    role,
    authEvent,
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),
  };

  return {
    prisma: client,
    // exposed for assertions/seeding in tests
    _internal: { authAccounts, sessions, otpCodes, passwordResetTokens, authEvents, customerRole, staffRole, adminRole },
  };
}
