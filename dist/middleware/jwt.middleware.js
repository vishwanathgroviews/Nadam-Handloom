"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
        return;
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // MFA-pending tokens are single-purpose (for /otp/verify only) and must never
        // be accepted as a real access token.
        if (decoded.typ === 'mfa') {
            res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
            return;
        }
        // Enforce the security stamp against the DB so password resets (which regenerate
        // it) immediately invalidate every access token issued before the reset, even
        // though the JWT itself hasn't expired yet.
        const account = await prisma_1.prisma.authAccount.findUnique({
            where: { id: decoded.id },
            select: { securityStamp: true, status: true, deletedAt: true },
        });
        if (!account ||
            account.deletedAt ||
            account.status !== 'active' ||
            account.securityStamp !== decoded.securityStamp) {
            res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
            return;
        }
        req.user = {
            id: decoded.id,
            roles: decoded.roles ?? [],
            permissions: decoded.permissions ?? [],
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }
};
exports.authenticateJWT = authenticateJWT;
//# sourceMappingURL=jwt.middleware.js.map