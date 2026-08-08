"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMfaToken = exports.generateMfaToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';
const MFA_TOKEN_EXPIRES_IN = '5m';
const generateMfaToken = (accountId) => {
    const payload = { accountId, typ: 'mfa' };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRES_IN });
};
exports.generateMfaToken = generateMfaToken;
const verifyMfaToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
    if (decoded.typ !== 'mfa' || !decoded.accountId) {
        throw new Error('Invalid MFA token');
    }
    return decoded.accountId;
};
exports.verifyMfaToken = verifyMfaToken;
//# sourceMappingURL=mfaToken.service.js.map