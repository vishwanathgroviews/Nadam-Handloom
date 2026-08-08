"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeResetTokenAndSetPassword = exports.validateResetToken = exports.generateResetToken = void 0;
const crypto_1 = require("crypto");
const prisma_1 = require("../../config/prisma");
const auth_service_1 = require("./auth.service");
const session_service_1 = require("./session.service");
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (token) => (0, crypto_1.createHash)('sha256').update(token).digest('hex');
const generateResetToken = async (authAccountId) => {
    const rawToken = (0, crypto_1.randomBytes)(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    await prisma_1.prisma.passwordResetToken.create({
        data: {
            authAccountId,
            tokenHash,
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
    });
    return rawToken;
};
exports.generateResetToken = generateResetToken;
const validateResetToken = async (rawToken) => {
    const tokenHash = hashToken(rawToken);
    const tokenRow = await prisma_1.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!tokenRow || tokenRow.used || tokenRow.expiresAt < new Date()) {
        return null;
    }
    return tokenRow;
};
exports.validateResetToken = validateResetToken;
const consumeResetTokenAndSetPassword = async (tokenRow, newPassword) => {
    const passwordHash = await auth_service_1.AuthService.hashPassword(newPassword);
    const now = new Date();
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.authAccount.update({
            where: { id: tokenRow.authAccountId },
            data: {
                passwordHash,
                passwordChangedAt: now,
                securityStamp: (0, crypto_1.randomUUID)(),
            },
        });
        await tx.passwordResetToken.update({
            where: { id: tokenRow.id },
            data: { used: true, usedAt: now },
        });
    });
    await (0, session_service_1.revokeAllSessionsForAccount)(tokenRow.authAccountId);
};
exports.consumeResetTokenAndSetPassword = consumeResetTokenAndSetPassword;
//# sourceMappingURL=passwordReset.service.js.map