// 7-day sign-ins: start, renew (with rotation and theft detection), end.
import { prisma } from '../config/database.js';
import { AUTH, REVOKE } from '../config/constants.js';
import * as StaffPush from '../models/staffPush.model.js';
import * as Session from '../models/session.model.js';
import * as Device from '../models/trustedDevice.model.js';
import { appRoleOf, hasAppAccess } from '../models/authAccount.model.js';
import { signAccess, newRefreshToken, hashRefreshToken } from './token.service.js';
import { presentUser, presentDevice } from '../utils/present.js';
import { audit } from './audit.service.js';
import { unauthorized, conflict } from '../utils/errors.js';

// What the app shows for each way a session can end.
export function errorForReason(reason) {
  switch (reason) {
    case REVOKE.REUSE_DETECTED:
      return unauthorized('SIGNED_OUT_FOR_SAFETY', 'For your safety, you were signed out on every device. Please sign in again.');
    case REVOKE.DEVICE_SIGNED_OUT:
    case REVOKE.OTHERS_SIGNED_OUT:
      return unauthorized('SIGNED_OUT_REMOTELY', 'This phone was signed out from another device.');
    case REVOKE.PIN_RESET:
      return unauthorized('PIN_CHANGED', 'Your PIN was reset on another device. Please sign in with the new PIN.');
    case REVOKE.ACCESS_REMOVED:
      return unauthorized('ACCESS_REMOVED', 'Your access has been removed. Please contact the owner.');
    default:
      return unauthorized('SESSION_INVALID', 'Please sign in again.');
  }
}

export function signInPayload({ account, session, device, refreshToken }) {
  return {
    status: 'signed_in',
    accessToken: signAccess({ accountId: account.id, sessionId: session.id, role: appRoleOf(account), stamp: account.securityStamp }),
    accessTokenExpiresIn: AUTH.ACCESS_TOKEN_MINUTES * 60,
    refreshToken,
    sessionExpiresAt: session.expiresAt.toISOString(),
    user: presentUser(account),
    device: presentDevice(device, true),
  };
}

export async function startSession({ account, device, ctx }) {
  const { token, hash } = newRefreshToken();
  const session = await Session.create({
    authAccountId: account.id,
    refreshTokenHash: hash,
    platform: device.platform,
    deviceName: device.name,
    ipAddress: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
    expiresAt: new Date(Date.now() + AUTH.SESSION_DAYS * 86400_000),
    trustedDeviceId: device.id,
    stampAtIssue: account.securityStamp,
  });
  const fresh = await Device.touch(device.id, { appVersion: ctx.appVersion });
  return signInPayload({ account, session, device: fresh, refreshToken: token });
}

// Someone used a refresh token that was already replaced: it was probably copied.
// End every session on the account and drop every Face ID key.
export async function signOutForSafety(accountId, ctx, metadata = {}) {
  await prisma.$transaction(async (tx) => {
    await Session.revokeWhere({ authAccountId: accountId }, REVOKE.REUSE_DETECTED, { compromised: true }, tx);
    await Device.clearBiometricForAccount(accountId, tx);
  });
  await audit('refresh_token_reuse_detected', { accountId, ctx, metadata });
}

// Is this sign-in still allowed (device, account, PIN)? Ends it and throws when not.
async function assertStillAllowed(s, account) {
  if (s.trustedDevice.revokedAt) {
    await Session.revokeIfActive(s.id, REVOKE.DEVICE_SIGNED_OUT);
    throw errorForReason(REVOKE.DEVICE_SIGNED_OUT);
  }
  if (!hasAppAccess(account)) {
    await Session.revokeIfActive(s.id, REVOKE.ACCESS_REMOVED);
    throw errorForReason(REVOKE.ACCESS_REMOVED);
  }
  if (s.stampAtIssue && s.stampAtIssue !== account.securityStamp) {
    await Session.revokeIfActive(s.id, REVOKE.PIN_RESET);
    throw errorForReason(REVOKE.PIN_RESET);
  }
}

const childOf = (s, account, hash, ctx) => ({
  authAccountId: s.authAccountId,
  refreshTokenHash: hash,
  platform: s.platform,
  deviceName: s.deviceName,
  ipAddress: ctx.ip ?? null,
  userAgent: ctx.userAgent ?? null,
  expiresAt: new Date(Date.now() + AUTH.SESSION_DAYS * 86400_000), // 7 days from now: renewed on use
  trustedDeviceId: s.trustedDeviceId,
  stampAtIssue: account.securityStamp,
  parentId: s.id,
});

// The phone sent a key that was already renewed. If the renewal it was given has never been
// used, its reply never arrived (weak Wi-Fi, a timeout): replace that renewal and carry on.
// Returns null when the renewal was used, so the old key is a copy (theft).
async function renewLostReply(s, ctx) {
  const kids = await Session.findChildren(s.id);
  if (!kids.length || kids.some((k) => k.usedAt || k.revokeReason === REVOKE.ROTATED)) return null;
  const ended = kids.find((k) => k.revokedAt && k.revokeReason !== REVOKE.SUPERSEDED);
  if (ended) throw errorForReason(ended.revokeReason); // signed out meanwhile: stays signed out
  const account = s.authAccount;
  await assertStillAllowed(s, account);
  const { token, hash } = newRefreshToken();
  const next = await prisma.$transaction(async (tx) => {
    for (const k of kids) {
      if (k.revokedAt) continue;
      if (!(await Session.supersedeIfUnused(k.id, tx))) return null; // used a moment ago
    }
    return Session.create(childOf(s, account, hash, ctx), tx);
  });
  if (!next) return null;
  await audit('session_lost_reply_renewed', { accountId: s.authAccountId, ctx });
  const device = await Device.touch(s.trustedDeviceId, { appVersion: ctx?.appVersion });
  return signInPayload({ account, session: next, device, refreshToken: token });
}

// Renew a sign-in: checks the token, the device, the account, then replaces the token.
export async function refresh({ refreshToken, deviceId, ctx }) {
  const s = await Session.findByRefreshHash(hashRefreshToken(refreshToken));
  // A website sign-in key is never accepted here (and never treated as stolen).
  if (!s || s.kind !== 'staff') throw unauthorized('SESSION_INVALID', 'Please sign in again.');

  if (s.revokedAt) {
    if (s.revokeReason === REVOKE.ROTATED) {
      if (s.trustedDevice?.deviceId === deviceId) {
        const again = await renewLostReply(s, ctx);
        if (again) return again;
        const sinceRotation = Date.now() - s.revokedAt.getTime();
        if (sinceRotation < AUTH.REFRESH_RACE_GRACE_SECONDS * 1000) {
          throw conflict('REFRESH_RACE', 'This sign-in was just renewed. Use the newest key.');
        }
      }
      await signOutForSafety(s.authAccountId, ctx, { reason: 'old refresh token used again' });
      throw errorForReason(REVOKE.REUSE_DETECTED);
    }
    throw errorForReason(s.revokeReason);
  }
  if (s.expiresAt <= new Date()) throw unauthorized('SESSION_EXPIRED', 'For your safety, you were signed out after 7 days without using the app. Please sign in again.');

  if (!s.trustedDevice || s.trustedDevice.deviceId !== deviceId) {
    // A valid key presented by a different device: treat as theft.
    await signOutForSafety(s.authAccountId, ctx, { reason: 'refresh token used on another device' });
    throw errorForReason(REVOKE.REUSE_DETECTED);
  }
  const account = s.authAccount;
  await assertStillAllowed(s, account);

  const { token, hash } = newRefreshToken();
  const next = await prisma.$transaction(async (tx) => {
    const won = await Session.revokeIfActive(s.id, REVOKE.ROTATED, tx);
    if (!won) throw conflict('REFRESH_RACE', 'This sign-in was just renewed. Use the newest key.');
    return Session.create(childOf(s, account, hash, ctx), tx);
  });
  const device = await Device.touch(s.trustedDeviceId, { appVersion: ctx?.appVersion });
  return signInPayload({ account, session: next, device, refreshToken: token });
}

export async function logout({ refreshToken, ctx }) {
  const s = await Session.findByRefreshHash(hashRefreshToken(refreshToken));
  if (s && s.kind === 'staff' && !s.revokedAt && (await Session.revokeIfActive(s.id, REVOKE.LOGOUT))) {
    // A phone signed out gets no more payment notifications.
    if (s.trustedDeviceId) await StaffPush.removeForDevice(s.trustedDeviceId);
    await audit('logout', { accountId: s.authAccountId, ctx });
  }
}
