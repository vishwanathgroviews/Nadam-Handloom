// Wrong-PIN locks, counted per mobile number: 5 tries, then 15 -> 30 -> 60 minutes.
// Registered numbers use the account's own columns (so the old app honours the
// same lock); numbers with no account use LoginThrottle so their replies look the same.
import * as Account from '../models/authAccount.model.js';
import * as Throttle from '../models/loginThrottle.model.js';
import { AUTH } from '../config/constants.js';
import { locked } from '../utils/errors.js';
import { lockMinutes } from '../utils/pin.js';

async function load(mobile, account) {
  if (account) return { account, fails: account.failedLoginAttempts, lockCount: account.lockCount, lockedUntil: account.lockedUntil };
  const t = await Throttle.get(mobile);
  return { account: null, fails: t?.failedAttempts ?? 0, lockCount: t?.lockCount ?? 0, lockedUntil: t?.lockedUntil ?? null };
}

export function lockedError({ lockCount, lockedUntil }) {
  const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  return locked('Too many wrong PINs. Sign-in is locked for a while.', {
    lockedUntil: lockedUntil.toISOString(),
    retryAfterSeconds,
    lockCount,
    lockMinutes: lockMinutes(lockCount),
    nextLockMinutes: lockMinutes(lockCount + 1),
  });
}

// Throws LOCKED while a lock runs. A lock that has ended gives 5 fresh tries.
export async function assertNotLocked(mobile, account) {
  const s = await load(mobile, account);
  if (!s.lockedUntil) return;
  if (s.lockedUntil > new Date()) throw lockedError(s);
  if (account) await Account.endExpiredLock(account.id);
  else await Throttle.save(mobile, { failedAttempts: 0, lockedUntil: null });
}

// Takes one try before the PIN is checked: requests sent at the same moment can't all be
// checked (once the 5 tries are taken, the rest are refused as locked). Returns
// { tries, lockCount }; throws LOCKED when no try is left.
export async function takeTry(mobile, account) {
  const now = new Date();
  const taken = account
    ? await Account.takePinTry(account.id, AUTH.MAX_PIN_TRIES)
    : await Throttle.takeTry(mobile, AUTH.MAX_PIN_TRIES);
  if (taken) return taken;
  // Locked already, or the last tries are being checked right now: the lock starts now.
  const s = account ? await Account.lockIfOpen(account.id, now, lockMinutes) : await Throttle.lockIfOpen(mobile, now, lockMinutes);
  throw lockedError(s);
}

// After a wrong PIN on a try from takeTry. Returns { triesLeft, nextLockMinutes }, or
// { lockError } when it was the last try (the lock starts).
export async function failedTry(mobile, account, taken) {
  if (taken.tries >= AUTH.MAX_PIN_TRIES) {
    const now = new Date();
    const s = account ? await Account.lockIfOpen(account.id, now, lockMinutes) : await Throttle.lockIfOpen(mobile, now, lockMinutes);
    return { lockError: lockedError(s), lockCount: s.lockCount };
  }
  return { triesLeft: AUTH.MAX_PIN_TRIES - taken.tries, nextLockMinutes: lockMinutes(taken.lockCount + 1) };
}

export const recordSuccess = (account) => Account.clearLocks(account.id);
