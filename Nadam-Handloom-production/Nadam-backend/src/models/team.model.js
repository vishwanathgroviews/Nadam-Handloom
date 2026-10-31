// Team queries: everyone who has, or had, access to the admin app. A team member
// is an AuthAccount with an ADMIN (Owner) or STAFF role; a removed member keeps
// their AdminProfile but has no such role. Customers share the same table.
import { prisma } from '../config/database.js';
import { AUTH } from '../config/constants.js';

const APP_ROLE = { role: { is: { name: { in: AUTH.APP_ROLES } } } };
const notDeleted = { deletedAt: null, status: { not: 'deleted' } };

// Everything the team screens need for one person: roles, names, phones (all of
// them, so "joined since the last invite" can be worked out) and the newest
// sign-in from the old app, which has no trusted-device row.
const memberInclude = {
  roles: { include: { role: true } },
  adminProfile: true,
  userProfile: true,
  trustedDevices: { orderBy: { lastSeenAt: 'desc' } },
  sessions: {
    where: { trustedDeviceId: null, platform: { in: ['ios', 'android'] } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true },
  },
};

export const listMembers = (db = prisma) =>
  db.authAccount.findMany({
    where: { ...notDeleted, OR: [{ roles: { some: APP_ROLE } }, { adminProfile: { isNot: null } }] },
    include: memberInclude,
  });

export const findMember = (id, db = prisma) => db.authAccount.findUnique({ where: { id }, include: memberInclude });

export const findMemberByMobile = (phone, db = prisma) => db.authAccount.findUnique({ where: { phone }, include: memberInclude });

// Names for "Invited by …" / "Removed by …".
export const findNames = (ids, db = prisma) =>
  ids.length
    ? db.authAccount.findMany({ where: { id: { in: ids } }, select: { id: true, adminProfile: { select: { firstName: true, lastName: true } }, userProfile: { select: { firstName: true, lastName: true } } } })
    : [];

const roleIds = {};
async function roleId(name, db) {
  roleIds[name] ??= (await db.role.findUniqueOrThrow({ where: { name } })).id;
  return roleIds[name];
}

export const removeAppRoles = (authAccountId, db = prisma) => db.userRole.deleteMany({ where: { authAccountId, ...APP_ROLE } });

// Gives the account exactly one team role (ADMIN or STAFF). A CUSTOMER role stays.
export async function setAppRole(authAccountId, name, db = prisma) {
  await removeAppRoles(authAccountId, db);
  await db.userRole.create({ data: { authAccountId, roleId: await roleId(name, db) } });
}

// Creates the team profile if the account has none (an owner created before the
// team screens existed may only have a customer profile).
export const upsertProfile = (authAccountId, data, db = prisma) =>
  db.adminProfile.upsert({
    where: { authAccountId },
    create: { authAccountId, firstName: data.firstName ?? 'Team', lastName: data.lastName ?? '', ...data },
    update: data,
  });

export const clearMainOwner = (db = prisma) => db.adminProfile.updateMany({ where: { isMainOwner: true }, data: { isMainOwner: false } });

// Team changes run one at a time (inside a transaction), so two owners acting
// together can never leave the shop without an owner.
const TEAM_LOCK = 72_11_2026;
export const lockTeam = (db) => db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${TEAM_LOCK})`);

// Push notifications stop going to a removed person's phones.
export const deletePushDevices = (authAccountId, db = prisma) => db.deviceToken.deleteMany({ where: { authAccountId } });
