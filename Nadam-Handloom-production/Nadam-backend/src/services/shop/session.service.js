// The website's 30-day sign-in (W1, web-01 section 8.2): start, renew with rotation and
// theft detection, sign out here / everywhere, and the "Signed-in devices" list.
import { prisma } from '../../config/database.js';
import { SHOP, SHOP_REVOKE } from '../../config/constants.js';
import * as Sessions from '../../models/shopSession.model.js';
import * as Customer from '../../models/customer.model.js';
import * as Push from '../../models/pushToken.model.js';
import { signShopAccess, newRefreshToken, hashRefreshToken, legacyHash } from './token.service.js';
import { presentCustomer } from './present.js';
import { describeUserAgent } from '../../utils/userAgent.js';
import { shopAudit } from '../audit.service.js';
import { unauthorized, conflict, badRequest, notFound } from '../../utils/errors.js';

const DAY = 86400_000;
const ROTATED_LIKE = [SHOP_REVOKE.ROTATED, SHOP_REVOKE.SUPERSEDED];

// The sign-in a cookie value belongs to (current hash first, then the older one).
async function findByCookie(token) {
  return (await Sessions.findByRefreshHash(hashRefreshToken(token))) || Sessions.findByRefreshHash(legacyHash(token));
}

// What the website shows for each way a sign-in can end.
export function errorForReason(reason) {
  switch (reason) {
    case SHOP_REVOKE.REUSE_DETECTED:
      return unauthorized('SIGNED_OUT_FOR_SAFETY', 'For your safety, you were signed out on every device. Please sign in again.');
    case SHOP_REVOKE.SIGNED_OUT_ELSEWHERE:
      return unauthorized('SIGNED_OUT_REMOTELY', 'You were signed out from another device. Please sign in again.');
    case SHOP_REVOKE.SIGNED_OUT_ALL:
      return unauthorized('SIGNED_OUT_EVERYWHERE', 'You signed out of all devices. Please sign in again.');
    case SHOP_REVOKE.TOO_MANY:
      return unauthorized('SESSION_ENDED', 'This sign-in ended because you signed in on many other devices. Please sign in again.');
    case SHOP_REVOKE.ACCOUNT_DELETED:
      return unauthorized('ACCOUNT_DELETED', 'This account has been deleted.');
    case SHOP_REVOKE.LOGOUT:
      return unauthorized('SIGNED_OUT', 'You signed out. Please sign in again.');
    default:
      return unauthorized('SESSION_INVALID', 'Please sign in again.');
  }
}

export const expiredSession = () => unauthorized('SESSION_EXPIRED', `You were signed out after ${SHOP.SESSION_DAYS} days without a visit. Please sign in again.`);

function payload(account, session) {
  return {
    accessToken: signShopAccess({ accountId: account.id, sessionId: session.id }),
    accessTokenExpiresIn: SHOP.ACCESS_TOKEN_MINUTES * 60,
    sessionExpiresAt: session.expiresAt.toISOString(),
    customer: presentCustomer(account),
  };
}

const rowFor = (ctx) => ({
  deviceName: describeUserAgent(ctx.userAgent).label,
  ipAddress: ctx.ip ?? null,
  userAgent: ctx.userAgent ?? null,
});

// Writes "last seen" at most every few minutes per customer.
export async function touchLastSeen(account) {
  const last = account.userProfile?.lastSeenAt;
  if (!account.userProfile || (last && Date.now() - last.getTime() < SHOP.LAST_SEEN_EVERY_SECONDS * 1000)) return;
  await Customer.updateProfile(account.id, { lastSeenAt: new Date() }).catch(() => {});
}

// A new sign-in on this browser. Returns { refreshToken, expiresAt, body }.
export async function start({ account, ctx }) {
  const { token, hash } = newRefreshToken();
  const now = new Date();
  const session = await prisma.$transaction(async (tx) => {
    await Sessions.lockAccount(account.id, tx);
    const created = await Sessions.create({
      authAccountId: account.id, refreshTokenHash: hash, expiresAt: new Date(now.getTime() + SHOP.SESSION_DAYS * DAY), startedAt: now, ...rowFor(ctx),
    }, tx);
    // At most MAX_SESSIONS browsers: the ones used longest ago end.
    const active = await Sessions.listActive(account.id, tx);
    for (const old of active.slice(SHOP.MAX_SESSIONS)) await Sessions.revokeIfActive(old.id, SHOP_REVOKE.TOO_MANY, tx);
    return created;
  });
  await touchLastSeen(account);
  return { refreshToken: token, expiresAt: session.expiresAt, body: payload(account, session) };
}

async function rotate(s, account, ctx) {
  const { token, hash } = newRefreshToken();
  const next = await prisma.$transaction(async (tx) => {
    await Sessions.lockAccount(account.id, tx);
    if (!(await Sessions.revokeIfActive(s.id, SHOP_REVOKE.ROTATED, tx))) return null;
    return Sessions.create({
      authAccountId: account.id, refreshTokenHash: hash, parentId: s.id, startedAt: s.startedAt ?? s.createdAt,
      expiresAt: new Date(Date.now() + SHOP.SESSION_DAYS * DAY), ...rowFor(ctx),
    }, tx);
  });
  if (!next) return null;
  return { refreshToken: token, expiresAt: next.expiresAt, body: payload(account, next) };
}

// The reply to a renewal was lost (or two tabs renewed at once): the same old key comes
// back within seconds. Its successor never reached the browser, so it is replaced, but
// only when the successor ended by being renewed: a successor ended by "Sign out",
// "Sign out of all devices" or the safety sign-out keeps this browser signed out.
const endedOtherwise = (c) => c.revokedAt && !ROTATED_LIKE.includes(c.revokeReason);

async function renewWithinGrace(s, account, ctx) {
  const children = await Sessions.findChildren(s.id);
  const stopped = children.find(endedOtherwise);
  if (stopped) throw errorForReason(stopped.revokeReason);
  if (children.some((c) => c.revokedAt && c.revokeReason === SHOP_REVOKE.ROTATED)) {
    // The successor was itself renewed already: this is a straggler from a slower tab.
    throw conflict('REFRESH_RACE', 'This sign-in was just renewed. Please try again.');
  }
  const { token, hash } = newRefreshToken();
  const next = await prisma.$transaction(async (tx) => {
    await Sessions.lockAccount(account.id, tx);
    // Looked at again under the lock: a sign-out may have landed a moment ago.
    for (const c of await Sessions.findChildren(s.id, tx)) {
      if (endedOtherwise(c)) throw errorForReason(c.revokeReason);
      if (!c.revokedAt) await Sessions.revokeIfActive(c.id, SHOP_REVOKE.SUPERSEDED, tx);
    }
    return Sessions.create({
      authAccountId: account.id, refreshTokenHash: hash, parentId: s.id, startedAt: s.startedAt ?? s.createdAt,
      expiresAt: new Date(Date.now() + SHOP.SESSION_DAYS * DAY), ...rowFor(ctx),
    }, tx);
  });
  return { refreshToken: token, expiresAt: next.expiresAt, body: payload(account, next) };
}

// Someone used a key that was replaced long ago: it was probably copied. Every website
// sign-in of this customer ends (the admin app is not touched).
async function signOutForSafety(accountId, ctx) {
  await prisma.$transaction(async (tx) => {
    await Sessions.lockAccount(accountId, tx);
    await Sessions.revokeAllFor(accountId, SHOP_REVOKE.REUSE_DETECTED, { compromised: true }, tx);
  });
  await shopAudit('shop_refresh_reuse_detected', { accountId, ctx });
}

function accountProblem(account) {
  if (!account || Customer.isClosed(account)) return SHOP_REVOKE.ACCOUNT_DELETED;
  if (!Customer.isCustomer(account)) return 'invalid';
  return null;
}

// Renews the sign-in from the 30-day cookie.
export async function refresh({ refreshToken, ctx }) {
  if (!refreshToken) throw unauthorized('NOT_SIGNED_IN', 'You are not signed in.');
  const s = await findByCookie(refreshToken);
  if (!s) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
  const account = s.authAccount;

  if (s.revokedAt) {
    if (s.revokeReason === SHOP_REVOKE.ROTATED) {
      if (Date.now() - s.revokedAt.getTime() < SHOP.REFRESH_GRACE_SECONDS * 1000 && !accountProblem(account)) return renewWithinGrace(s, account, ctx);
      await signOutForSafety(s.authAccountId, ctx);
      throw errorForReason(SHOP_REVOKE.REUSE_DETECTED);
    }
    if (s.revokeReason === SHOP_REVOKE.SUPERSEDED) throw unauthorized('SESSION_INVALID', 'Please sign in again.');
    throw errorForReason(s.revokeReason);
  }
  if (s.expiresAt <= new Date()) throw expiredSession();
  const problem = accountProblem(account);
  if (problem) {
    await Sessions.revokeIfActive(s.id, problem === SHOP_REVOKE.ACCOUNT_DELETED ? SHOP_REVOKE.ACCOUNT_DELETED : SHOP_REVOKE.LOGOUT);
    throw errorForReason(problem);
  }
  const out = await rotate(s, account, ctx);
  await touchLastSeen(account);
  if (out) return out;
  // The key ended between reading it and renewing it. Renewed by another request a moment
  // ago: this one gets its own successor. Ended any other way (signed out): signed out.
  const again = await Sessions.findById(s.id);
  if (!again || again.revokeReason !== SHOP_REVOKE.ROTATED) throw errorForReason(again?.revokeReason);
  return renewWithinGrace(again, account, ctx);
}

// Unlinks this browser's push token from the account (shared computers).
async function unlinkPush(pushToken, accountId) {
  if (!pushToken) return;
  const t = await Push.findByToken(pushToken);
  if (t && t.authAccountId === accountId) {
    await Push.update(t.id, { authAccountId: null, topics: t.topics.filter((x) => x !== 'orders') });
  }
}

// "Sign out" on this browser. Always succeeds: there may be nothing to end.
export async function logout({ refreshToken, pushToken, ctx }) {
  if (!refreshToken) return;
  const s = await findByCookie(refreshToken);
  if (!s) return;
  if (await Sessions.revokeIfActive(s.id, SHOP_REVOKE.LOGOUT)) {
    await unlinkPush(pushToken, s.authAccountId);
    await shopAudit('shop_signed_out', { accountId: s.authAccountId, ctx });
  }
}

// "Sign out of all devices": every website sign-in ends at once (each request checks its
// sign-in, so other browsers are out on their next click). Their notifications stop too.
export async function logoutAll({ accountId, ctx }) {
  const ended = await prisma.$transaction(async (tx) => {
    await Sessions.lockAccount(accountId, tx);
    return Sessions.revokeAllFor(accountId, SHOP_REVOKE.SIGNED_OUT_ALL, {}, tx);
  });
  const tokens = await Push.activeForAccount(accountId);
  for (const t of tokens) await Push.update(t.id, { authAccountId: null, topics: t.topics.filter((x) => x !== 'orders') });
  await shopAudit('shop_signed_out_all', { accountId, ctx, metadata: { sessionsEnded: ended, pushUnlinked: tokens.length } });
  return { sessionsEnded: ended };
}

// Follows renewals forward to the active sign-in a (possibly older) id belongs to.
async function activeFrom(id) {
  let s = await Sessions.findById(id);
  for (let hops = 0; s && s.revokedAt && ROTATED_LIKE.includes(s.revokeReason) && hops < 200; hops++) {
    const kids = await Sessions.findChildren(s.id);
    s = kids.find((k) => !k.revokedAt) || kids.at(-1) || null;
  }
  return s && !s.revokedAt && s.expiresAt > new Date() ? s : null;
}

export async function listSessions({ accountId, currentSessionId }) {
  const rows = await Sessions.listActive(accountId);
  return rows
    .map((s) => {
      const ua = describeUserAgent(s.userAgent);
      return {
        id: s.id,
        label: s.deviceName || ua.label,
        browser: ua.browser,
        system: ua.system,
        device: ua.device,
        signedInAt: (s.startedAt || s.createdAt).toISOString(),
        lastActiveAt: s.createdAt.toISOString(),
        isCurrent: s.id === currentSessionId,
      };
    })
    .sort((a, b) => (b.isCurrent - a.isCurrent) || b.lastActiveAt.localeCompare(a.lastActiveAt));
}

export async function signOutSession({ accountId, id, currentSessionId, ctx }) {
  const s = await activeFrom(id);
  if (!s || s.authAccountId !== accountId) throw notFound('SESSION_NOT_FOUND', 'That device is no longer signed in.');
  if (s.id === currentSessionId) throw badRequest('USE_SIGN_OUT', 'This is the device you are using. Use "Sign out" instead.');
  await Sessions.revokeIfActive(s.id, SHOP_REVOKE.SIGNED_OUT_ELSEWHERE);
  await shopAudit('shop_device_signed_out', { accountId, ctx, metadata: { device: s.deviceName } });
  return { sessions: await listSessions({ accountId, currentSessionId }) };
}
