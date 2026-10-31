// Website SMS codes (W1, web-01 section 5): sign-in / sign-up and change of mobile.
// Every valid Indian mobile gets a code (a new number is a new customer), so the reply
// is the same whether or not the number has an account. Limits:
//   - one code per 60 seconds and 5 an hour per mobile
//   - per network an hour: 20 per IPv6 /64 block, 60 per IPv4 address (carrier NAT puts
//     many customers behind one IPv4 address): utils/network.js
//   - a daily total for numbers with no account yet (SHOP_SMS_DAILY_LIMIT), against SMS
//     abuse; returning customers are never stopped by it
//   - a code lives 10 minutes (or less if the SMS provider says so) and allows 3 tries
// The limits are checked and the code's row reserved in one locked step, so requests sent
// at the same moment can't all slip through; each try is counted before the code is checked.
import { prisma } from '../../config/database.js';
import { SHOP } from '../../config/constants.js';
import { env } from '../../config/env.js';
import * as Code from '../../models/phoneCode.model.js';
import { sms } from '../sms/index.js';
import { networkOf } from '../../utils/network.js';
import { badRequest, tooMany, unavailable } from '../../utils/errors.js';

const HOUR = 3600_000;
// Read at call time so tests can lower them.
export const limits = { dailyTotal: env.shop.smsDailyLimit, perIpv4Hour: SHOP.CODE_MAX_PER_IPV4_HOUR, perIpv6Hour: SHOP.CODE_MAX_PER_NETWORK_HOUR };

export const codeLifeSeconds = () => Math.min(SHOP.CODE_TTL_SECONDS, sms.codeTtlSeconds ?? SHOP.CODE_TTL_SECONDS);

const wrongCode = (triesLeft) => badRequest('WRONG_CODE', triesLeft === 1 ? 'That code isn\'t right. 1 try left.' : `That code isn't right. ${triesLeft} tries left.`, { triesLeft });
const expiredCode = () => badRequest('CODE_EXPIRED', 'This code has expired. Get a new code.');
const usedUpCode = () => badRequest('CODE_USED_UP', 'Too many wrong tries. Get a new code.');
const alreadyUsedCode = () => badRequest('CODE_ALREADY_USED', 'This code was already used. Get a new code.');
const minutes = (s) => Math.max(1, Math.ceil(s / 60));

// Throws the right "please wait" error when a code may not be sent now.
// net: networkOf(ip); accountId: the number already has an account (or a signed-in
// customer asked for it), so the daily limit for new numbers doesn't apply.
export async function checkLimits({ mobile, purpose, net, accountId = null, db = prisma }) {
  const now = Date.now();
  const last = await Code.latest(mobile, purpose, db);
  if (last) {
    const waited = (now - last.createdAt.getTime()) / 1000;
    if (waited < SHOP.CODE_RESEND_SECONDS) {
      const retryAfterSeconds = Math.ceil(SHOP.CODE_RESEND_SECONDS - waited);
      throw tooMany('CODE_RESEND_WAIT', `A code was sent a moment ago. You can ask for a new one in ${retryAfterSeconds} seconds.`, { retryAfterSeconds });
    }
  }
  const hourAgo = new Date(now - HOUR);
  if ((await Code.countForMobileSince(mobile, hourAgo, db)) >= SHOP.CODE_MAX_PER_HOUR) {
    const oldest = await Code.oldestForMobileSince(mobile, hourAgo, db);
    const retryAfterSeconds = oldest ? Math.ceil((oldest.createdAt.getTime() + HOUR - now) / 1000) : 3600;
    throw tooMany('CODE_TOO_MANY', `Too many codes for this number. Try again in ${minutes(retryAfterSeconds)} minutes.`, { retryAfterSeconds });
  }
  const perNetwork = net?.v6 ? limits.perIpv6Hour : limits.perIpv4Hour;
  if (net && (await Code.countForNetworkSince(net.key, hourAgo, db)) >= perNetwork) {
    const oldest = await Code.oldestForNetworkSince(net.key, hourAgo, db);
    const retryAfterSeconds = oldest ? Math.ceil((oldest.createdAt.getTime() + HOUR - now) / 1000) : 3600;
    throw tooMany('CODE_TOO_MANY_NETWORK', `Too many codes from this network. Try again in ${minutes(retryAfterSeconds)} minutes.`, { retryAfterSeconds });
  }
  if (!accountId && (await Code.countNewNumbersSince(new Date(now - 24 * HOUR), db)) >= limits.dailyTotal) {
    console.error(`[shop:sms] daily limit of ${limits.dailyTotal} codes for new numbers reached: codes to new numbers paused`);
    throw unavailable('SMS_PAUSED', 'We can\'t send codes right now. Please try again later or message us on WhatsApp.');
  }
}

// Sends a code and records it. Returns the reply the website shows.
export async function sendCode({ mobile, purpose, accountId = null, ip }) {
  const net = networkOf(ip);
  // 1. Check the limits and reserve this code's row, one sender at a time.
  const reserved = await prisma.$transaction(async (tx) => {
    await Code.lockSending(tx);
    await checkLimits({ mobile, purpose, net, accountId, db: tx });
    const now = new Date();
    return Code.create({ mobile, purpose, authAccountId: accountId, codeHash: 'pending', usedAt: now, expiresAt: now, ipAddress: net?.key ?? null }, tx);
  });
  // 2. Send. If the SMS service refuses, the reservation goes and the earlier code still works.
  let sent;
  try {
    sent = await sms.send(mobile);
  } catch (err) {
    await Code.remove(reserved.id).catch(() => {});
    throw err;
  }
  // 3. The new code replaces any earlier one.
  const life = codeLifeSeconds();
  await prisma.$transaction(async (tx) => {
    await Code.closeOpen(mobile, purpose, tx);
    await Code.activate(reserved.id, { codeHash: sent.stored, expiresAt: new Date(Date.now() + life * 1000) }, tx);
  });
  const reply = { resendInSeconds: SHOP.CODE_RESEND_SECONDS, expiresInSeconds: life, codeLength: SHOP.CODE_LENGTH };
  if (env.echoCodes && sent.code) reply.devCode = sent.code; // test mode only, never in production
  return reply;
}

// The same reply as a real send, for the bot trap: nothing is sent or recorded.
export const decoyReply = () => ({ resendInSeconds: SHOP.CODE_RESEND_SECONDS, expiresInSeconds: codeLifeSeconds(), codeLength: SHOP.CODE_LENGTH });

// Checks a code. Returns the PhoneCode row (now closed) on success; throws WRONG_CODE,
// CODE_EXPIRED, CODE_USED_UP or CODE_ALREADY_USED otherwise. accountId: for a change of
// mobile, the code must have been asked for by this customer.
export async function verifyCode({ mobile, purpose, code, accountId = null }) {
  const open = await Code.latestOpen(mobile, purpose);
  if (!open || (accountId && open.authAccountId !== accountId)) {
    const last = await Code.latest(mobile, purpose);
    if (last && (!accountId || last.authAccountId === accountId) && last.attempts >= SHOP.CODE_MAX_TRIES && last.expiresAt > new Date()) throw usedUpCode();
    throw expiredCode();
  }
  if (open.expiresAt <= new Date()) {
    await Code.closeIfOpen(open.id);
    throw expiredCode();
  }
  // The try is counted first: requests sent at the same moment can't share one try.
  const attempts = await Code.takeAttempt(open.id, SHOP.CODE_MAX_TRIES);
  if (attempts === null) {
    const now = await Code.findById(open.id);
    if (now && now.attempts >= SHOP.CODE_MAX_TRIES) throw usedUpCode();
    throw expiredCode(); // another request just used it
  }
  let result;
  try {
    result = await sms.verify(open.codeHash, code);
  } catch (err) {
    await Code.giveBackAttempt(open.id); // the SMS service couldn't check it: not the customer's try
    throw err;
  }
  if (result.expired) {
    await Code.closeIfOpen(open.id);
    throw expiredCode();
  }
  if (result.alreadyVerified) {
    // The SMS service says this code was checked before (an earlier reply was lost). It
    // can't say by whom, so the code closes and the customer asks for a new one.
    await Code.closeIfOpen(open.id);
    throw alreadyUsedCode();
  }
  if (!result.ok) {
    const left = SHOP.CODE_MAX_TRIES - attempts;
    if (left <= 0) {
      await Code.closeIfOpen(open.id);
      throw usedUpCode();
    }
    throw wrongCode(left);
  }
  // Two requests with the same right code: only one wins.
  if (!(await Code.closeIfOpen(open.id))) throw expiredCode();
  return open;
}
