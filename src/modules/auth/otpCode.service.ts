import { prisma } from '../../config/prisma';
import { redisClient, isRedisConnected } from '../../config/redis';
import { generateOtp, hashOtp } from './otp.service';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_TTL_SECONDS = 300;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;

export class OtpResendCooldownError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('OTP resend not yet available');
    this.name = 'OtpResendCooldownError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const redisKey = (accountId: string, purpose: string) => `otp:${accountId}:${purpose}`;

/**
 * Postgres (OtpCode) is authoritative for attempts/used/resend-cooldown/purpose.
 * Redis just caches the hash with a matching TTL as an optional fast-path; it is
 * never treated as more authoritative than the DB row, and a Redis failure is non-fatal.
 */
export const createOtp = async (accountId: string, purpose: string): Promise<string> => {
  const code = generateOtp();
  const codeHash = hashOtp(code);
  const now = Date.now();

  await prisma.otpCode.create({
    data: {
      authAccountId: accountId,
      purpose,
      codeHash,
      expiresAt: new Date(now + OTP_TTL_MS),
      resendAvailableAt: new Date(now + RESEND_COOLDOWN_MS),
    },
  });

  if (isRedisConnected && redisClient.isOpen) {
    try {
      await redisClient.set(redisKey(accountId, purpose), codeHash, { EX: OTP_TTL_SECONDS });
    } catch (e) {
      console.warn('Redis set failed for OTP cache (non-fatal, Postgres remains authoritative)');
    }
  }

  return code;
};

const getLatestOtp = (accountId: string, purpose: string) =>
  prisma.otpCode.findFirst({
    where: { authAccountId: accountId, purpose, used: false },
    orderBy: { createdAt: 'desc' },
  });

export const verifyOtp = async (accountId: string, purpose: string, code: string): Promise<boolean> => {
  const otpRow = await getLatestOtp(accountId, purpose);

  if (!otpRow || otpRow.attempts >= MAX_ATTEMPTS || otpRow.expiresAt < new Date()) {
    return false;
  }

  // Record the attempt regardless of outcome so brute force is capped at MAX_ATTEMPTS.
  await prisma.otpCode.update({
    where: { id: otpRow.id },
    data: { attempts: { increment: 1 } },
  });

  const isMatch = hashOtp(code) === otpRow.codeHash;
  if (!isMatch) return false;

  await prisma.otpCode.update({
    where: { id: otpRow.id },
    data: { used: true },
  });

  if (isRedisConnected && redisClient.isOpen) {
    try {
      await redisClient.del(redisKey(accountId, purpose));
    } catch (e) {
      // best-effort cache cleanup, DB `used` flag is what actually matters
    }
  }

  return true;
};

export const resendOtp = async (accountId: string, purpose: string): Promise<string> => {
  const latest = await getLatestOtp(accountId, purpose);

  if (latest && latest.resendAvailableAt > new Date()) {
    const retryAfterSeconds = Math.ceil((latest.resendAvailableAt.getTime() - Date.now()) / 1000);
    throw new OtpResendCooldownError(retryAfterSeconds);
  }

  return createOtp(accountId, purpose);
};
