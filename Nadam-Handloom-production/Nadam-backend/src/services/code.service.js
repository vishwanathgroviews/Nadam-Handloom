// SMS codes for setup, Forgot PIN and the new-phone check.
// Limits are applied to EVERY mobile number the same way (registered or not),
// so replies never reveal whether a number has an account:
//   - one code per 60 seconds, at most 5 an hour
//   - a code lives 60 seconds and allows 3 wrong tries
import { AUTH } from '../config/constants.js';
import { env } from '../config/env.js';
import * as RateLimit from '../models/rateLimitHit.model.js';
import * as Otp from '../models/otpCode.model.js';
import * as Account from '../models/authAccount.model.js';
import { sms } from './sms/index.js';
import { badRequest, tooMany } from '../utils/errors.js';

const SENT = (mobile) => `v2-code:${mobile}`;
const MISS = (mobile, purpose) => `v2-codemiss:${purpose}:${mobile}`;

const wrongCode = (triesLeft) => badRequest('WRONG_CODE', 'That code isn\'t right.', { triesLeft });
const expiredCode = () => badRequest('CODE_EXPIRED', 'This code has expired. Send a new code.');
const usedUpCode = () => badRequest('CODE_USED_UP', 'Too many wrong tries. Send a new code.');

// account = the account that should receive the code, or null to send nothing
// (the reply is identical either way).
export async function requestCode({ mobile, purpose, account }) {
  const now = Date.now();
  const last = await RateLimit.latest(SENT(mobile));
  if (last) {
    const waited = (now - last.createdAt.getTime()) / 1000;
    if (waited < AUTH.CODE_RESEND_SECONDS) {
      throw tooMany('CODE_RESEND_WAIT', 'A code was sent a moment ago. Please wait before asking for another.', {
        retryAfterSeconds: Math.ceil(AUTH.CODE_RESEND_SECONDS - waited),
      });
    }
  }
  const hourAgo = new Date(now - 3600_000);
  if ((await RateLimit.countSince(SENT(mobile), hourAgo)) >= AUTH.CODE_MAX_PER_HOUR) {
    const oldest = await RateLimit.oldestSince(SENT(mobile), hourAgo);
    const retryAfterSeconds = oldest ? Math.ceil((oldest.createdAt.getTime() + 3600_000 - now) / 1000) : 3600;
    throw tooMany('CODE_TOO_MANY', 'Too many codes requested. For safety, try again after 1 hour.', { retryAfterSeconds });
  }

  const reply = { resendInSeconds: AUTH.CODE_RESEND_SECONDS, expiresInSeconds: AUTH.CODE_TTL_SECONDS };
  if (!account) {
    await RateLimit.add(SENT(mobile));
    return reply;
  }

  // Send first, record second: if the SMS service refuses, the earlier code still works.
  const sent = await sms.send(mobile);
  await RateLimit.add(SENT(mobile));
  await Otp.supersede(account.id, purpose);
  await Otp.create({
    authAccountId: account.id,
    purpose,
    codeHash: sent.stored,
    expiresAt: new Date(now + AUTH.CODE_TTL_SECONDS * 1000),
    resendAvailableAt: new Date(now + AUTH.CODE_RESEND_SECONDS * 1000),
  });
  if (env.echoCodes && sent.code) reply.devCode = sent.code; // test mode only, never in production
  return reply;
}

// Checks a code. Returns the used OtpCode row on success; throws WRONG_CODE /
// CODE_EXPIRED / CODE_USED_UP otherwise.
export async function verifyCode({ mobile, purpose, account, code }) {
  const lastSent = await RateLimit.latest(SENT(mobile));
  const recent = lastSent && Date.now() - lastSent.createdAt.getTime() < AUTH.CODE_TTL_SECONDS * 1000;
  const otp = account ? await Otp.latestUnused(account.id, purpose) : null;

  if (!otp) {
    if (account) {
      // The last code was used up by wrong tries (still within its life) or is gone.
      const last = await Otp.latest(account.id, purpose);
      if (last && last.attempts >= AUTH.CODE_MAX_TRIES && last.expiresAt > new Date()) throw usedUpCode();
      throw expiredCode();
    }
    // No code was sent to this number (not invited / no account), but one was asked for:
    // count tries exactly like a real code so the reply gives nothing away.
    if (!recent) throw expiredCode();
    const misses = await RateLimit.countSince(MISS(mobile, purpose), lastSent.createdAt);
    await RateLimit.add(MISS(mobile, purpose));
    const left = AUTH.CODE_MAX_TRIES - (misses + 1);
    throw left <= 0 ? usedUpCode() : wrongCode(left);
  }

  if (otp.expiresAt <= new Date()) {
    await Otp.markUsed(otp.id);
    throw expiredCode();
  }
  // The try is counted first: guesses sent at the same moment can't share one try.
  const attempts = await Otp.takeAttempt(otp.id, AUTH.CODE_MAX_TRIES);
  if (attempts === null) {
    const now = await Otp.findById(otp.id);
    if (now && now.attempts >= AUTH.CODE_MAX_TRIES) throw usedUpCode();
    throw expiredCode(); // another request just used it
  }
  let result;
  try {
    result = await sms.verify(otp.codeHash, code);
  } catch (err) {
    await Otp.giveBackAttempt(otp.id); // the SMS service couldn't check it: not the person's try
    throw err;
  }
  if (result.expired) {
    await Otp.markUsed(otp.id);
    throw expiredCode();
  }
  if (result.alreadyVerified) {
    // The SMS service checked this code before (its reply was lost). It can't say by whom,
    // so the code closes and the person asks for a new one.
    await Otp.markUsed(otp.id);
    throw badRequest('CODE_ALREADY_USED', 'This code was already used. Send a new code.');
  }
  if (!result.ok) {
    const left = AUTH.CODE_MAX_TRIES - attempts;
    if (left <= 0) {
      await Otp.markUsed(otp.id);
      throw usedUpCode();
    }
    throw wrongCode(left);
  }
  if (!(await Otp.useIfOpen(otp.id))) throw expiredCode(); // two requests with the right code: one wins
  await Account.markPhoneVerified(account.id);
  return otp;
}
