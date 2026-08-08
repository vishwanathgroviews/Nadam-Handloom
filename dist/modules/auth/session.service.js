"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeAllSessionsForAccount = exports.issueSession = exports.buildAccessTokenPayload = void 0;
const prisma_1 = require("../../config/prisma");
const token_service_1 = require("./token.service");
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const buildAccessTokenPayload = (account, roles, permissions) => ({
    id: account.id,
    roles,
    permissions,
    securityStamp: account.securityStamp,
});
exports.buildAccessTokenPayload = buildAccessTokenPayload;
/**
 * Issues a fresh access token + rotated/created refresh-token session, and sets the
 * HttpOnly refresh cookie. Used by login (direct success), otpVerify (post-MFA success),
 * and refresh (rotation).
 */
const issueSession = async (account, roles, permissions, req, res, options = {}) => {
    const payload = (0, exports.buildAccessTokenPayload)(account, roles, permissions);
    const accessToken = (0, token_service_1.generateAccessToken)(payload);
    const { token: refreshToken, hash: refreshHash } = (0, token_service_1.generateRefreshToken)();
    await prisma_1.prisma.session.create({
        data: {
            authAccountId: account.id,
            refreshTokenHash: refreshHash,
            platform: options.platform || 'web',
            deviceName: options.deviceName || 'unknown',
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
        },
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: REFRESH_TOKEN_TTL_MS,
    });
    return { accessToken, refreshToken };
};
exports.issueSession = issueSession;
const revokeAllSessionsForAccount = async (authAccountId) => {
    await prisma_1.prisma.session.updateMany({
        where: { authAccountId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};
exports.revokeAllSessionsForAccount = revokeAllSessionsForAccount;
//# sourceMappingURL=session.service.js.map