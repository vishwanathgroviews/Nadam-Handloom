// Per-IP request limit, stored in the database (RateLimitHit) so it survives restarts.
// Kept generous: every phone on the shop Wi-Fi shares one IP. The real protection
// is per mobile number (PIN locks and SMS limits in the services).
import { prisma } from '../config/database.js';
import * as RateLimit from '../models/rateLimitHit.model.js';
import { tooMany } from '../utils/errors.js';
import { env } from '../config/env.js';

// Checked and recorded one request at a time per network (a short database lock), so
// requests sent at the same moment are counted exactly: the first `max` pass, the rest wait.
// `by` counts per signed-in person instead (Pay: mobile networks put many phones on one IP).
export const rateLimit = ({ name, max = env.RATE_LIMIT_PER_MINUTE, windowSeconds = 60, by = null }) => async (req, _res, next) => {
  try {
    const who = by ? by(req) : null;
    const key = who ? `v2-acct:${name}:${who}` : `v2-ip:${name}:${req.ip}`;
    const since = new Date(Date.now() - windowSeconds * 1000);
    const allowed = await prisma.$transaction(async (tx) => {
      await RateLimit.lockKey(key, tx);
      if ((await RateLimit.countSince(key, since, tx)) >= max) return false;
      await RateLimit.add(key, tx);
      return true;
    });
    if (!allowed) {
      const oldest = await RateLimit.oldestSince(key, since);
      const retryAfterSeconds = oldest ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + windowSeconds * 1000 - Date.now()) / 1000)) : windowSeconds;
      return next(tooMany('RATE_LIMITED', 'Too many requests from this network. Please wait a minute and try again.', { retryAfterSeconds }));
    }
    return next();
  } catch (err) {
    return next(err);
  }
};
