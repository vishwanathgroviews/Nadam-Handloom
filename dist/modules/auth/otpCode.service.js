"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendOtp = exports.verifyOtp = exports.createOtp = exports.OtpResendCooldownError = void 0;
const prisma_1 = require("../../config/prisma");
const redis_1 = require("../../config/redis");
const otp_service_1 = require("./otp.service");
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_TTL_SECONDS = 300;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;
class OtpResendCooldownError extends Error {
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super('OTP resend not yet available');
        this.name = 'OtpResendCooldownError';
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.OtpResendCooldownError = OtpResendCooldownError;
const redisKey = (accountId, purpose) => `otp:${accountId}:${purpose}`;
/**
 * Postgres (OtpCode) is authoritative for attempts/used/resend-cooldown/purpose.
 * Redis just caches the hash with a matching TTL as an optional fast-path; it is
 * never treated as more authoritative than the DB row, and a Redis failure is non-fatal.
 */
const createOtp = async (accountId, purpose) => {
    const code = (0, otp_service_1.generateOtp)();
    const codeHash = (0, otp_service_1.hashOtp)(code);
    const now = Date.now();
    await prisma_1.prisma.otpCode.create({
        data: {
            authAccountId: accountId,
            purpose,
            codeHash,
            expiresAt: new Date(now + OTP_TTL_MS),
            resendAvailableAt: new Date(now + RESEND_COOLDOWN_MS),
        },
    });
    if (redis_1.isRedisConnected && redis_1.redisClient.isOpen) {
        try {
            await redis_1.redisClient.set(redisKey(accountId, purpose), codeHash, { EX: OTP_TTL_SECONDS });
        }
        catch (e) {
            console.warn('Redis set failed for OTP cache (non-fatal, Postgres remains authoritative)');
        }
    }
    return code;
};
exports.createOtp = createOtp;
const getLatestOtp = (accountId, purpose) => prisma_1.prisma.otpCode.findFirst({
    where: { authAccountId: accountId, purpose, used: false },
    orderBy: { createdAt: 'desc' },
});
const verifyOtp = async (accountId, purpose, code) => {
    const otpRow = await getLatestOtp(accountId, purpose);
    if (!otpRow || otpRow.attempts >= MAX_ATTEMPTS || otpRow.expiresAt < new Date()) {
        return false;
    }
    // Record the attempt regardless of outcome so brute force is capped at MAX_ATTEMPTS.
    await prisma_1.prisma.otpCode.update({
        where: { id: otpRow.id },
        data: { attempts: { increment: 1 } },
    });
    const isMatch = (0, otp_service_1.hashOtp)(code) === otpRow.codeHash;
    if (!isMatch)
        return false;
    await prisma_1.prisma.otpCode.update({
        where: { id: otpRow.id },
        data: { used: true },
    });
    if (redis_1.isRedisConnected && redis_1.redisClient.isOpen) {
        try {
            await redis_1.redisClient.del(redisKey(accountId, purpose));
        }
        catch (e) {
            // best-effort cache cleanup, DB `used` flag is what actually matters
        }
    }
    return true;
};
exports.verifyOtp = verifyOtp;
const resendOtp = async (accountId, purpose) => {
    const latest = await getLatestOtp(accountId, purpose);
    if (latest && latest.resendAvailableAt > new Date()) {
        const retryAfterSeconds = Math.ceil((latest.resendAvailableAt.getTime() - Date.now()) / 1000);
        throw new OtpResendCooldownError(retryAfterSeconds);
    }
    return (0, exports.createOtp)(accountId, purpose);
};
exports.resendOtp = resendOtp;
//# sourceMappingURL=otpCode.service.js.map