// Website sign-in keys (W1, web-01 section 8).
// - Access key: JWT, 15 minutes, audience "shop", signed with JWT_SHOP_ACCESS_SECRET.
//   The admin app's keys use another secret and audience, so neither side accepts the other's.
// - Profile step key: JWT proving the SMS code passed, for "Complete your profile" (15 minutes).
// - 30-day sign-in: a random 256-bit value in an HttpOnly cookie, stored only as a hash.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { SHOP } from '../../config/constants.js';
import { sha256 } from '../../utils/crypto.js';
import { unauthorized, badRequest } from '../../utils/errors.js';

const ISSUER = 'nandam-api-v2';
export const AUDIENCE = 'shop';
const STEP_AUDIENCE = 'shop-step';

export function signShopAccess({ accountId, sessionId }) {
  return jwt.sign({ typ: 'access', sid: sessionId }, env.JWT_SHOP_ACCESS_SECRET, {
    subject: accountId, expiresIn: SHOP.ACCESS_TOKEN_MINUTES * 60, algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE,
  });
}

export function verifyShopAccess(token) {
  try {
    const p = jwt.verify(token, env.JWT_SHOP_ACCESS_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    if (p.typ !== 'access' || !p.sid || !p.sub) throw new Error('wrong shape');
    return p;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('ACCESS_TOKEN_EXPIRED', 'Your sign-in key expired. The website renews it automatically.');
    throw unauthorized('SESSION_INVALID', 'Please sign in again.');
  }
}

const stepExpired = () => badRequest('STEP_EXPIRED', 'This step timed out. Please enter your mobile number again.');
export const stepExpiredError = stepExpired;

// claims: { mobile, accountId (or null for a new customer), codeId }
export function signProfileStep({ mobile, accountId, codeId }) {
  return jwt.sign({ typ: 'step', purpose: 'shop_profile', mob: mobile, acc: accountId || null, cid: codeId }, env.JWT_STEP_SECRET, {
    expiresIn: SHOP.PROFILE_STEP_MINUTES * 60, algorithm: 'HS256', issuer: ISSUER, audience: STEP_AUDIENCE, jwtid: crypto.randomUUID(),
  });
}

export function verifyProfileStep(token) {
  let p;
  try {
    p = jwt.verify(token, env.JWT_STEP_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: STEP_AUDIENCE });
  } catch {
    throw stepExpired();
  }
  if (p.typ !== 'step' || p.purpose !== 'shop_profile' || !/^[6-9]\d{9}$/.test(p.mob || '')) throw stepExpired();
  return { mobile: p.mob, accountId: p.acc || null, codeId: p.cid };
}

// The 30-day cookie is stored as a hash with the website's own prefix. The old server
// (/api/v1) looks sign-ins up by sha256(value) with no idea of website sign-ins, so a
// copied cookie value must never match there. Sign-ins made before this change (16 Oct 2026) were
// stored as plain sha256: legacyHash finds them, and their next renewal moves them over.
const PREFIX = 'nandam-shop-session-v2:';
export const hashRefreshToken = (token) => sha256(PREFIX + token);
export const legacyHash = (token) => sha256(token);

// 256 random bits, URL-safe, for the 30-day cookie.
export function newRefreshToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}
