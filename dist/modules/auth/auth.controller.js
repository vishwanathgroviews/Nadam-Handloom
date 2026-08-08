"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../../config/prisma");
const auth_service_1 = require("./auth.service");
const otpCode_service_1 = require("./otpCode.service");
const email_service_1 = require("./email.service");
const token_service_1 = require("./token.service");
const session_service_1 = require("./session.service");
const mfaToken_service_1 = require("./mfaToken.service");
const passwordReset_service_1 = require("./passwordReset.service");
const permission_service_1 = require("./permission.service");
const auditLog_service_1 = require("./auditLog.service");
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
class AuthError extends Error {
    constructor(message = 'Invalid credentials') {
        super(message);
        this.name = 'AuthError';
    }
}
const respondWithSession = (res, platform, session) => {
    const body = { accessToken: session.accessToken };
    if (platform && platform !== 'web') {
        body.refreshToken = session.refreshToken;
    }
    return res.status(200).json(body);
};
class AuthController {
    static async register(req, res, next) {
        try {
            const { email, phone, password, firstName, lastName } = req.body;
            const existingUser = await prisma_1.prisma.authAccount.findFirst({
                where: { OR: [{ email }, { phone }], deletedAt: null },
            });
            if (existingUser) {
                res.status(400).json({ error: 'Account with this email or phone already exists' });
                return;
            }
            const account = await auth_service_1.AuthService.registerCustomer({ email, phone, password, firstName, lastName });
            const code = await (0, otpCode_service_1.createOtp)(account.id, 'email_verify');
            await (0, email_service_1.sendOtpEmail)(email, code);
            res.status(201).json({
                message: 'Registration successful. Please verify your email with the OTP sent.',
                accountId: account.id,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async adminProvision(req, res, next) {
        try {
            const { email, phone, firstName, lastName, roleId, employeeId, department, jobTitle } = req.body;
            const existingUser = await prisma_1.prisma.authAccount.findFirst({
                where: { OR: [{ email }, { phone }], deletedAt: null },
            });
            if (existingUser) {
                res.status(400).json({ error: 'Account already exists' });
                return;
            }
            // Never-transmitted throwaway password; the real credential is set via the invite's reset link.
            const throwawayPassword = crypto_1.default.randomBytes(32).toString('hex');
            const passwordHash = await auth_service_1.AuthService.hashPassword(throwawayPassword);
            const account = await prisma_1.prisma.$transaction(async (tx) => {
                return await tx.authAccount.create({
                    data: {
                        email,
                        phone,
                        passwordHash,
                        roles: { create: { roleId } },
                        adminProfile: {
                            create: { firstName, lastName, employeeId, department, jobTitle },
                        },
                    },
                });
            });
            if (email) {
                const resetToken = await (0, passwordReset_service_1.generateResetToken)(account.id);
                await (0, email_service_1.sendInviteEmail)(email, resetToken);
            }
            else {
                console.warn(`[adminProvision] Account ${account.id} has no email; invite link was not sent.`);
            }
            await (0, auditLog_service_1.logAuthEvent)({
                accountId: account.id,
                eventType: 'user_provisioned',
                req,
                metadata: { roleId, employeeId },
            });
            res.status(201).json({ message: 'User provisioned successfully', accountId: account.id });
        }
        catch (error) {
            next(error);
        }
    }
    static async login(req, res, next) {
        try {
            const { email, phone, password, platform, deviceName } = req.body;
            const account = await prisma_1.prisma.authAccount.findFirst({
                where: {
                    OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
                    deletedAt: null,
                },
            });
            if (!account) {
                await (0, auditLog_service_1.logAuthEvent)({ accountId: null, eventType: 'login_failure', req, metadata: { reason: 'not_found' } });
                throw new AuthError();
            }
            if (account.status !== 'active') {
                await (0, auditLog_service_1.logAuthEvent)({
                    accountId: account.id,
                    eventType: 'login_failure',
                    req,
                    metadata: { reason: `status_${account.status}` },
                });
                res.status(403).json({ error: 'Account is not active. Please contact support.' });
                return;
            }
            if (account.lockedUntil && account.lockedUntil > new Date()) {
                await (0, auditLog_service_1.logAuthEvent)({ accountId: account.id, eventType: 'login_failure', req, metadata: { reason: 'locked' } });
                res.status(403).json({ error: 'Account locked due to multiple failed login attempts.' });
                return;
            }
            const isMatch = await auth_service_1.AuthService.verifyPassword(password, account.passwordHash);
            if (!isMatch) {
                const attempts = account.failedLoginAttempts + 1;
                const lockedUntil = attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null;
                await prisma_1.prisma.authAccount.update({
                    where: { id: account.id },
                    data: { failedLoginAttempts: attempts, lockedUntil },
                });
                await (0, auditLog_service_1.logAuthEvent)({
                    accountId: account.id,
                    eventType: 'login_failure',
                    req,
                    metadata: { reason: 'bad_password' },
                });
                throw new AuthError();
            }
            await prisma_1.prisma.authAccount.update({
                where: { id: account.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            });
            const { roles, permissions } = await (0, permission_service_1.getRolesAndPermissions)(account.id);
            const mfaRequired = roles.includes('ADMIN') || roles.includes('STAFF') || account.mfaEnabled;
            if (mfaRequired) {
                const code = await (0, otpCode_service_1.createOtp)(account.id, 'login_mfa');
                if (account.email) {
                    await (0, email_service_1.sendOtpEmail)(account.email, code);
                }
                else {
                    console.log(`[login_mfa] OTP for account ${account.id} (no email on file): ${code}`);
                }
                const mfaToken = (0, mfaToken_service_1.generateMfaToken)(account.id);
                await (0, auditLog_service_1.logAuthEvent)({ accountId: account.id, eventType: 'login_mfa_challenge', req });
                res.status(200).json({ mfaRequired: true, mfaToken });
                return;
            }
            const session = await (0, session_service_1.issueSession)(account, roles, permissions, req, res, { platform, deviceName });
            await (0, auditLog_service_1.logAuthEvent)({ accountId: account.id, eventType: 'login_success', req });
            respondWithSession(res, platform, session);
        }
        catch (error) {
            next(error);
        }
    }
    static async refresh(req, res, next) {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
            if (!refreshToken) {
                res.status(401).json({ error: 'No refresh token provided' });
                return;
            }
            const tokenHash = (0, token_service_1.hashRefreshToken)(refreshToken);
            const session = await prisma_1.prisma.session.findUnique({
                where: { refreshTokenHash: tokenHash },
                include: { authAccount: true },
            });
            if (!session || session.authAccount.deletedAt || session.authAccount.status !== 'active') {
                res.status(401).json({ error: 'Invalid or expired refresh token' });
                return;
            }
            if (session.revokedAt) {
                // A previously-rotated refresh token was replayed: treat as compromise.
                await (0, session_service_1.revokeAllSessionsForAccount)(session.authAccountId);
                await prisma_1.prisma.session.updateMany({
                    where: { authAccountId: session.authAccountId },
                    data: { isCompromised: true },
                });
                await (0, auditLog_service_1.logAuthEvent)({
                    accountId: session.authAccountId,
                    eventType: 'refresh_token_reuse_detected',
                    req,
                });
                res.status(401).json({ error: 'Invalid or expired refresh token' });
                return;
            }
            if (session.isCompromised || session.expiresAt < new Date()) {
                res.status(401).json({ error: 'Invalid or expired refresh token' });
                return;
            }
            // Rotate: revoke the old session before issuing a new one.
            await prisma_1.prisma.session.update({
                where: { id: session.id },
                data: { revokedAt: new Date() },
            });
            const { roles, permissions } = await (0, permission_service_1.getRolesAndPermissions)(session.authAccountId);
            const newSession = await (0, session_service_1.issueSession)(session.authAccount, roles, permissions, req, res, {
                platform: session.platform ?? undefined,
                deviceName: session.deviceName ?? undefined,
            });
            await (0, auditLog_service_1.logAuthEvent)({ accountId: session.authAccountId, eventType: 'token_refresh', req });
            res.status(200).json({ accessToken: newSession.accessToken });
        }
        catch (error) {
            next(error);
        }
    }
    static async logout(req, res, next) {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
            if (refreshToken) {
                const tokenHash = (0, token_service_1.hashRefreshToken)(refreshToken);
                await prisma_1.prisma.session.updateMany({
                    where: { refreshTokenHash: tokenHash },
                    data: { revokedAt: new Date() },
                });
            }
            await (0, auditLog_service_1.logAuthEvent)({ accountId: req.user?.id ?? null, eventType: 'logout', req });
            res.clearCookie('refreshToken');
            res.status(200).json({ message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async otpVerify(req, res, next) {
        try {
            const { email, mfaToken, code } = req.body;
            if (mfaToken) {
                let accountId;
                try {
                    accountId = (0, mfaToken_service_1.verifyMfaToken)(mfaToken);
                }
                catch {
                    res.status(400).json({ error: 'Invalid or expired OTP' });
                    return;
                }
                const isValid = await (0, otpCode_service_1.verifyOtp)(accountId, 'login_mfa', code);
                if (!isValid) {
                    await (0, auditLog_service_1.logAuthEvent)({ accountId, eventType: 'otp_verify_failed', req });
                    res.status(400).json({ error: 'Invalid or expired OTP' });
                    return;
                }
                const account = await prisma_1.prisma.authAccount.findUnique({ where: { id: accountId } });
                if (!account) {
                    res.status(400).json({ error: 'Invalid or expired OTP' });
                    return;
                }
                const { roles, permissions } = await (0, permission_service_1.getRolesAndPermissions)(account.id);
                const session = await (0, session_service_1.issueSession)(account, roles, permissions, req, res, {});
                await (0, auditLog_service_1.logAuthEvent)({ accountId: account.id, eventType: 'login_success', req });
                res.status(200).json({ accessToken: session.accessToken, refreshToken: session.refreshToken });
                return;
            }
            const account = await prisma_1.prisma.authAccount.findFirst({ where: { email, deletedAt: null } });
            if (!account) {
                res.status(400).json({ error: 'Invalid or expired OTP' });
                return;
            }
            const isValid = await (0, otpCode_service_1.verifyOtp)(account.id, 'email_verify', code);
            if (!isValid) {
                await (0, auditLog_service_1.logAuthEvent)({ accountId: account.id, eventType: 'otp_verify_failed', req });
                res.status(400).json({ error: 'Invalid or expired OTP' });
                return;
            }
            await prisma_1.prisma.authAccount.update({
                where: { id: account.id },
                data: { emailVerifiedAt: new Date() },
            });
            await (0, auditLog_service_1.logAuthEvent)({ accountId: account.id, eventType: 'email_verified', req });
            res.status(200).json({ message: 'OTP verified successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async otpResend(req, res, next) {
        try {
            const { email, mfaToken } = req.body;
            let accountId;
            let purpose;
            let destinationEmail;
            if (mfaToken) {
                try {
                    accountId = (0, mfaToken_service_1.verifyMfaToken)(mfaToken);
                }
                catch {
                    res.status(400).json({ error: 'Invalid or expired session' });
                    return;
                }
                purpose = 'login_mfa';
                const account = await prisma_1.prisma.authAccount.findUnique({ where: { id: accountId } });
                destinationEmail = account?.email ?? null;
            }
            else {
                const account = await prisma_1.prisma.authAccount.findFirst({ where: { email, deletedAt: null } });
                if (!account) {
                    // Anti-enumeration: respond as if it succeeded.
                    res.status(200).json({ message: 'If an account exists, a new OTP has been sent.' });
                    return;
                }
                accountId = account.id;
                purpose = 'email_verify';
                destinationEmail = account.email;
            }
            const code = await (0, otpCode_service_1.resendOtp)(accountId, purpose);
            if (destinationEmail) {
                await (0, email_service_1.sendOtpEmail)(destinationEmail, code);
            }
            await (0, auditLog_service_1.logAuthEvent)({ accountId, eventType: 'otp_resend', req, metadata: { purpose } });
            res.status(200).json({ message: 'A new OTP has been sent.' });
        }
        catch (error) {
            if (error instanceof otpCode_service_1.OtpResendCooldownError) {
                res.status(429).json({ error: error.message, retryAfterSeconds: error.retryAfterSeconds });
                return;
            }
            next(error);
        }
    }
    static async passwordResetRequest(req, res, next) {
        try {
            const { email, phone } = req.body;
            const account = await prisma_1.prisma.authAccount.findFirst({
                where: {
                    OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
                    deletedAt: null,
                },
            });
            if (account) {
                const resetToken = await (0, passwordReset_service_1.generateResetToken)(account.id);
                if (account.email) {
                    await (0, email_service_1.sendPasswordResetEmail)(account.email, resetToken);
                }
            }
            // Anti-enumeration: always return the same generic response.
            await (0, auditLog_service_1.logAuthEvent)({ accountId: account?.id ?? null, eventType: 'password_reset_requested', req });
            res.status(200).json({ message: 'If an account exists, password reset instructions have been sent.' });
        }
        catch (error) {
            next(error);
        }
    }
    static async passwordResetConfirm(req, res, next) {
        try {
            const { token, newPassword } = req.body;
            const tokenRow = await (0, passwordReset_service_1.validateResetToken)(token);
            if (!tokenRow) {
                res.status(400).json({ error: 'Invalid or expired token' });
                return;
            }
            await (0, passwordReset_service_1.consumeResetTokenAndSetPassword)(tokenRow, newPassword);
            await (0, auditLog_service_1.logAuthEvent)({ accountId: tokenRow.authAccountId, eventType: 'password_reset_completed', req });
            res.status(200).json({ message: 'Password has been reset successfully. Please log in again.' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map