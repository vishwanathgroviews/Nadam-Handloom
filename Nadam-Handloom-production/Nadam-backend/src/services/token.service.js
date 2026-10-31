// Sign-in keys.
// - Access token: JWT, 15 minutes, renewed silently by the app.
// - Refresh token: random, 7 days, stored only as a hash, replaced on every renewal.
// - Step token: JWT proving an earlier step passed (SMS code, PIN check), minutes only.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AUTH } from '../config/constants.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { unauthorized, badRequest } from '../utils/errors.js';

const ISSUER = 'nandam-api-v2';
const AUDIENCE = 'nandam-admin-app';

export function signAccess({ accountId, sessionId, role, stamp }) {
  return jwt.sign({ typ: 'access', sid: sessionId, role, stamp }, env.JWT_ACCESS_SECRET, {
    subject: accountId, expiresIn: AUTH.ACCESS_TOKEN_MINUTES * 60, algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE,
  });
}

export function verifyAccess(token) {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    if (p.typ !== 'access') throw new Error('wrong type');
    return p;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('ACCESS_TOKEN_EXPIRED', 'Your access key expired. The app renews it automatically.');
    throw unauthorized('SESSION_INVALID', 'Please sign in again.');
  }
}

export function signStep(purpose, claims, minutes = AUTH.STEP_TOKEN_MINUTES) {
  const { sub, ...rest } = claims;
  return jwt.sign({ typ: 'step', purpose, ...rest }, env.JWT_STEP_SECRET, {
    subject: sub, expiresIn: minutes * 60, algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE,
  });
}

export function verifyStep(token, purposes) {
  let p;
  try {
    p = jwt.verify(token, env.JWT_STEP_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
  } catch {
    throw badRequest('STEP_EXPIRED', 'This step timed out. Please start again.');
  }
  if (p.typ !== 'step' || !purposes.includes(p.purpose)) throw badRequest('STEP_EXPIRED', 'This step timed out. Please start again.');
  return p;
}

export function newRefreshToken() {
  const token = randomToken(48);
  return { token, hash: sha256(token) };
}

export const hashRefreshToken = (token) => sha256(token);
