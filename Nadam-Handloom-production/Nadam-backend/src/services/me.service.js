// The signed-in person's own account: profile, Change PIN, devices, Face ID.
import { prisma } from '../config/database.js';
import { AUTH, STEP, REVOKE } from '../config/constants.js';
import * as Account from '../models/authAccount.model.js';
import * as Session from '../models/session.model.js';
import * as lock from './lock.service.js';
import { verifyPin, hashPin } from './pin.service.js';
import { verifyStep } from './token.service.js';
import { stepFor, pinVersion, assertNewPin } from './auth.service.js';
import { signOutOtherDevices } from './device.service.js';
import { audit } from './audit.service.js';
import { presentUser, presentDevice } from '../utils/present.js';
import { PIN_PROBLEM_TEXT } from '../utils/pin.js';
import { badRequest } from '../utils/errors.js';

export const getMe = (auth) => ({
  user: presentUser(auth.account),
  device: presentDevice(auth.device, true),
  sessionExpiresAt: auth.session.expiresAt.toISOString(),
});

// Checks the signed-in person's own PIN (Change PIN, turning on Face ID). The try is counted
// before the PIN is checked; the wrong try that starts a lock also ends this sign-in.
export async function confirmPin({ auth, pin, ctx }) {
  const account = auth.account;
  const taken = await lock.takeTry(account.phone, account);
  if (await verifyPin(account.mpinHash, pin)) {
    await lock.recordSuccess(account);
    return true;
  }
  const r = await lock.failedTry(account.phone, account, taken);
  await audit(r.lockError ? 'login_locked' : 'pin_check_failed', { accountId: account.id, ctx });
  if (r.lockError) {
    await Session.revokeIfActive(auth.session.id, REVOKE.PIN_LOCKED);
    throw r.lockError;
  }
  throw badRequest('WRONG_PIN', 'That\'s not your current PIN.', { triesLeft: r.triesLeft, nextLockMinutes: r.nextLockMinutes });
}

// Change PIN, step 1: check the current PIN. Wrong tries count toward the lock.
export async function verifyCurrentPin({ auth, pin, ctx }) {
  await confirmPin({ auth, pin, ctx });
  return { changeToken: stepFor(STEP.CHANGE_PIN, auth.account, auth.device.deviceId, { sid: auth.session.id }, AUTH.CHANGE_TOKEN_MINUTES) };
}

// Change PIN, step 2: save the new PIN; optionally sign out every other device.
export async function changePin({ auth, changeToken, newPin, signOutOthers, ctx }) {
  const p = verifyStep(changeToken, [STEP.CHANGE_PIN]);
  const account = await Account.findById(auth.accountId);
  if (p.sub !== account.id || p.sid !== auth.session.id || p.stamp !== account.securityStamp || p.pinv !== pinVersion(account)) {
    throw badRequest('STEP_EXPIRED', 'This step timed out. Please start again.');
  }
  assertNewPin(newPin, account);
  if (await verifyPin(account.mpinHash, newPin)) throw badRequest('SAME_AS_CURRENT', PIN_PROBLEM_TEXT.same_as_current);
  const mpinHash = await hashPin(newPin);
  let result = { devicesSignedOut: 0, sessionsEnded: 0 };
  await prisma.$transaction(async (tx) => {
    await Account.setPin(account.id, { mpinHash }, tx);
    if (signOutOthers) {
      result = await signOutOtherDevices({ accountId: account.id, currentSessionId: auth.session.id, currentDeviceRowId: auth.device.id, reason: REVOKE.OTHERS_SIGNED_OUT, ctx, tx });
    }
  });
  await audit('pin_changed', { accountId: account.id, ctx, metadata: { signOutOthers, ...result } });
  return { changed: true, ...result };
}
