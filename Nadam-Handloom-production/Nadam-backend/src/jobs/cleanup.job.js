// Housekeeping every 15 minutes: old Face ID challenges, old v2 rate-limit rows,
// replaced sessions that are past their own expiry, and sign-in records older than
// a year (Module 10, 6.2: everything else in the activity log is kept).
// Website (W1): SMS codes older than 2 days (the limits look back one day), push tokens
// removed 90 days ago, and "Delete my account" requests whose 7 days are over.
// Website (W5): sarees in a signed-in bag left unchanged for 60 days.
import * as Challenge from '../models/authChallenge.model.js';
import * as RateLimit from '../models/rateLimitHit.model.js';
import * as Session from '../models/session.model.js';
import * as PhoneCode from '../models/phoneCode.model.js';
import * as PushToken from '../models/pushToken.model.js';
import { deleteOldSignIns } from '../services/activity.service.js';
import { deleteDueAccounts } from '../services/shop/account.service.js';
import { forgetUnchanged as forgetOldBagItems } from '../services/shop/bag.service.js';

const DAY = 86400_000;

export async function runCleanup() {
  const hourAgo = new Date(Date.now() - 3600_000);
  const [challenges, hits, sessions, signIns, codes, pushTokens, bagItems] = await Promise.all([
    Challenge.deleteOld(hourAgo),
    RateLimit.deleteOld('v2-', new Date(Date.now() - 2 * 3600_000)),
    Session.deleteExpiredRotated(),
    deleteOldSignIns(),
    PhoneCode.deleteOlderThan(new Date(Date.now() - 2 * DAY)),
    PushToken.deleteRemovedBefore(new Date(Date.now() - 90 * DAY)),
    forgetOldBagItems(),
  ]);
  const accountsDeleted = await deleteDueAccounts();
  return {
    challenges: challenges.count, rateLimitHits: hits.count, sessions: sessions.count, signIns,
    phoneCodes: codes.count, pushTokens: pushTokens.count, bagItems: bagItems.count, accountsDeleted,
  };
}

export function startCleanupJob(intervalMs = 15 * 60_000) {
  const timer = setInterval(() => runCleanup().catch((e) => console.error('[cleanup]', e.message)), intervalMs);
  timer.unref();
  return timer;
}
