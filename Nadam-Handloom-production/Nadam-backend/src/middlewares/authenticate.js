// Requires a valid access token and checks, on every request, that the session,
// device and account are still allowed. Sets req.auth for controllers.
import * as Session from '../models/session.model.js';
import { hasAppAccess, appRoleOf } from '../models/authAccount.model.js';
import { verifyAccess } from '../services/token.service.js';
import { errorForReason } from '../services/session.service.js';
import { REVOKE } from '../config/constants.js';
import { unauthorized, unavailable } from '../utils/errors.js';
import { maintenanceFor } from '../services/settings.service.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
    const payload = verifyAccess(token);

    const session = await Session.findById(payload.sid);
    if (!session || session.kind !== 'staff' || session.authAccountId !== payload.sub) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
    if (session.revokedAt) {
      // A request sent with the previous key while the app was renewing it: not a
      // sign-out. "Expired" makes the app retry with the newest key it already holds.
      if (session.revokeReason === REVOKE.ROTATED) throw unauthorized('ACCESS_TOKEN_EXPIRED', 'Your access key was renewed. Retry with the new one.');
      throw errorForReason(session.revokeReason);
    }
    if (session.expiresAt <= new Date()) throw unauthorized('SESSION_EXPIRED', 'Please sign in again.');
    const device = session.trustedDevice;
    if (!device || device.revokedAt) throw errorForReason(REVOKE.DEVICE_SIGNED_OUT);
    if (req.ctx.deviceId && req.ctx.deviceId !== device.deviceId) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
    const account = session.authAccount;
    if (!hasAppAccess(account)) throw errorForReason(REVOKE.ACCESS_REMOVED);
    if (account.securityStamp !== payload.stamp) throw errorForReason(REVOKE.PIN_RESET);

    // The first request with this sign-in: from now on it counts as used (a later return of
    // the key it replaced is a copied key, not a lost reply). Once per sign-in.
    if (!session.usedAt) await Session.markUsed(session.id);
    // The role comes from the database, not the token, so a role change applies at once.
    req.auth = { accountId: account.id, account, session, device, role: appRoleOf(account) };
    // Module 11 (6.3): while the staff app is paused, staff get the owner's message
    // instead (their own profile still loads, so the app can show who is signed in).
    const paused = req.method === 'GET' && req.baseUrl.endsWith('/me') && req.path === '/' ? null : await maintenanceFor(account);
    if (paused) throw unavailable('MAINTENANCE', paused.message || 'The staff app is paused for a short while. Please try again soon.', { message: paused.message });
    return next();
  } catch (err) {
    return next(err);
  }
}
