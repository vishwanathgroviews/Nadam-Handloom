// "Delete my account" (W1, web-01 section 12): a 7-day window to change one's mind.
// Signing in during those days shows "Keep my account". After 7 days the personal
// details go; orders and invoices stay (tax law), linked to an anonymous account.
import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { SHOP, SHOP_REVOKE } from '../../config/constants.js';
import * as Customer from '../../models/customer.model.js';
import * as Sessions from '../../models/shopSession.model.js';
import * as Push from '../../models/pushToken.model.js';
import * as Address from '../../models/address.model.js';
import * as BagItems from '../../models/bag.model.js';
import { deletionOf } from './present.js';
import { storage } from '../storage/index.js';
import { shopAudit } from '../audit.service.js';
import { conflict, forbidden } from '../../utils/errors.js';

const DAY = 86400_000;

export async function requestDeletion({ account, reason, ctx }) {
  if (Customer.isTeamMember(account)) {
    throw forbidden('ACCOUNT_MANAGED_BY_SHOP', 'This account is also used for the shop\'s staff app, so it can only be closed by the shop owner.');
  }
  if (account.userProfile?.deleteRequestedAt) return { deletion: deletionOf(account.userProfile) };
  const open = await Customer.openOrderCount(account.id);
  if (open > 0) {
    throw conflict('OPEN_ORDERS', 'You have orders on the way. You can delete your account after they are delivered.', { openOrders: open });
  }
  const profile = await Customer.updateProfile(account.id, { deleteRequestedAt: new Date() });
  await shopAudit('shop_delete_requested', { accountId: account.id, ctx, metadata: { reason: reason || null } });
  return { deletion: deletionOf(profile) };
}

export async function cancelDeletion({ account, ctx }) {
  if (account.userProfile?.deleteRequestedAt) {
    await Customer.updateProfile(account.id, { deleteRequestedAt: null });
    await shopAudit('shop_delete_cancelled', { accountId: account.id, ctx });
  }
  return { deletion: null };
}

// Removes one customer's personal details. Returns false when it no longer applies.
export async function deleteCustomer(accountId) {
  const done = await prisma.$transaction(async (tx) => {
    const a = await Customer.findById(accountId, tx);
    const asked = a?.userProfile?.deleteRequestedAt;
    if (!a || !asked || asked.getTime() > Date.now() - SHOP.DELETE_AFTER_DAYS * DAY) return null;
    if (Customer.isTeamMember(a)) {
      // Became staff in the meantime: the shop owner manages this account now.
      await Customer.updateProfile(accountId, { deleteRequestedAt: null }, tx);
      return { skipped: true };
    }
    // An order placed during the 7 days is still on its way: the details it needs for
    // delivery stay until it is delivered (the next run tries again).
    if ((await Customer.openOrderCount(accountId, tx)) > 0) return { skipped: true };
    const avatarKey = a.userProfile.avatarKey;
    await tx.authAccount.update({
      where: { id: accountId },
      data: {
        phone: null, email: null, status: 'deleted', deletedAt: new Date(), phoneVerifiedAt: null, emailVerifiedAt: null,
        mpinHash: null, mpinSetAt: null, passwordHash: null, securityStamp: crypto.randomUUID(),
      },
    });
    await tx.userProfile.update({
      where: { authAccountId: accountId },
      data: {
        firstName: 'Deleted', lastName: 'customer', displayName: null, avatarUrl: null, avatarKey: null, preferences: null,
        city: null, state: null, pincode: null, dateOfBirth: null, anniversary: null, language: null,
        marketingOptIn: false, marketingOptInAt: null, signupReferrer: null, lastSeenAt: null,
        deleteRequestedAt: null, deletedAt: new Date(),
      },
    });
    await Address.removeAll(accountId, tx);
    await BagItems.removeAll(accountId, tx); // the saved bag (W5)
    await Sessions.lockAccount(accountId, tx);
    await Sessions.revokeAllFor(accountId, SHOP_REVOKE.ACCOUNT_DELETED, {}, tx);
    await Push.removeAllForAccount(accountId, 'account_deleted', tx);
    await tx.phoneCode.deleteMany({ where: { OR: [{ authAccountId: accountId }, ...(a.phone ? [{ mobile: a.phone }] : [])] } });
    await tx.otpCode.deleteMany({ where: { authAccountId: accountId } });
    return { avatarKey };
  });
  if (!done) return false;
  if (done.skipped) return false;
  if (done.avatarKey) await storage().remove(done.avatarKey).catch(() => false);
  await shopAudit('shop_account_deleted', { accountId });
  return true;
}

// Run by the clean-up job: every request whose 7 days are over.
export async function deleteDueAccounts() {
  const due = await Customer.dueForDeletion(new Date(Date.now() - SHOP.DELETE_AFTER_DAYS * DAY));
  let deleted = 0;
  for (const { authAccountId } of due) {
    try {
      if (await deleteCustomer(authAccountId)) deleted += 1;
    } catch (err) {
      console.error(`[shop:delete] could not delete an account: ${err.message}`);
    }
  }
  return deleted;
}
