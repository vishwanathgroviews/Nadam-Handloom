// Website (W1): requires a valid customer access key (audience "shop") and checks, on
// every request, that the sign-in, the account and the CUSTOMER role are still there.
// Sets req.customer for controllers. The admin app's keys are refused here.
import * as Sessions from '../models/shopSession.model.js';
import * as Customer from '../models/customer.model.js';
import { verifyShopAccess } from '../services/shop/token.service.js';
import { errorForReason, expiredSession, touchLastSeen } from '../services/shop/session.service.js';
import { SHOP_REVOKE } from '../config/constants.js';
import { unauthorized } from '../utils/errors.js';

async function customerFrom(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const payload = verifyShopAccess(token);
  const session = await Sessions.findById(payload.sid);
  if (!session || session.authAccountId !== payload.sub) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
  if (session.revokedAt) {
    // A request sent with the previous key while the website was renewing it: not a sign-out.
    if (session.revokeReason === SHOP_REVOKE.ROTATED || session.revokeReason === SHOP_REVOKE.SUPERSEDED) {
      throw unauthorized('ACCESS_TOKEN_EXPIRED', 'Your sign-in key was renewed. Retry with the new one.');
    }
    throw errorForReason(session.revokeReason);
  }
  if (session.expiresAt <= new Date()) throw expiredSession();
  const account = session.authAccount;
  if (Customer.isClosed(account)) throw errorForReason(SHOP_REVOKE.ACCOUNT_DELETED);
  if (!Customer.isCustomer(account) || !account.userProfile) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
  touchLastSeen(account); // not awaited: never slows a request
  return { accountId: account.id, account, profile: account.userProfile, session };
}

export async function authenticateCustomer(req, _res, next) {
  try {
    const customer = await customerFrom(req);
    if (!customer) throw unauthorized('NOT_SIGNED_IN', 'Please sign in.');
    req.customer = customer;
    return next();
  } catch (err) {
    return next(err);
  }
}

// For pages anyone can use (push subscribe): a key, if sent, must be valid.
export async function optionalCustomer(req, _res, next) {
  try {
    req.customer = await customerFrom(req);
    return next();
  } catch (err) {
    return next(err);
  }
}
