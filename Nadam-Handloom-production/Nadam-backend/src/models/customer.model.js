// Customers (W1): an AuthAccount with the CUSTOMER role and a UserProfile. The same
// person may also be an owner or staff member (one account per mobile, option A).
import { prisma } from '../config/database.js';

export const CUSTOMER_INCLUDE = { roles: { include: { role: true } }, userProfile: true, adminProfile: true };

const roleNames = (account) => (account?.roles || []).map((r) => r.role.name);
export const isCustomer = (account) => roleNames(account).includes('CUSTOMER');
// Owners and staff: their mobile and their account are managed in the admin app.
export const isTeamMember = (account) => roleNames(account).some((n) => n === 'ADMIN' || n === 'STAFF');
export const isClosed = (account) => !!account?.deletedAt || account?.status === 'deleted';
// Signed up on the new website (or finished the one-time profile after the old one).
export const hasCompleteProfile = (account) => isCustomer(account) && !!account.userProfile?.profileCompletedAt && !isClosed(account);

export const findByMobile = (phone, db = prisma) => db.authAccount.findUnique({ where: { phone }, include: CUSTOMER_INCLUDE });
export const findById = (id, db = prisma) => db.authAccount.findUnique({ where: { id }, include: CUSTOMER_INCLUDE });

// Emails are kept in lower case; older rows may not be, so the check ignores case.
export const findByEmail = (email, db = prisma) =>
  db.authAccount.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });

let customerRoleId = null;
export async function ensureCustomerRole(authAccountId, db = prisma) {
  customerRoleId ??= (await db.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER', isSystem: true } })).id;
  await db.userRole.upsert({
    where: { authAccountId_roleId: { authAccountId, roleId: customerRoleId } },
    update: {},
    create: { authAccountId, roleId: customerRoleId },
  });
}

export const updateAccount = (id, data, db = prisma) => db.authAccount.update({ where: { id }, data });

export const upsertProfile = (authAccountId, create, update, db = prisma) =>
  db.userProfile.upsert({ where: { authAccountId }, create: { authAccountId, ...create }, update });

export const updateProfile = (authAccountId, data, db = prisma) => db.userProfile.update({ where: { authAccountId }, data });

// One sign-up at a time per mobile number (two taps on "Create account").
export const lockMobile = (mobile, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-mobile:${mobile}`}))`;

// "Delete my account" requests whose 7 days are over.
export const dueForDeletion = (before, db = prisma) =>
  db.userProfile.findMany({ where: { deleteRequestedAt: { lte: before } }, select: { authAccountId: true }, take: 50 });

// Orders still on their way block "Delete my account".
export const openOrderCount = (authAccountId, db = prisma) =>
  db.order.count({ where: { authAccountId, channel: 'online', status: { in: ['paid', 'processing', 'shipped'] } } });
