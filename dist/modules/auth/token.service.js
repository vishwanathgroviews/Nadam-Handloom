"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashRefreshToken = exports.generateRefreshToken = exports.verifyAccessToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';
// 15 minutes for Access Token
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const generateAccessToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};
exports.generateAccessToken = generateAccessToken;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, JWT_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const generateRefreshToken = () => {
    const token = (0, crypto_1.randomBytes)(64).toString('base64');
    const hash = (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    // Return the raw token to send via HTTP-only cookie, and the hash to store in DB
    return { token, hash };
};
exports.generateRefreshToken = generateRefreshToken;
const hashRefreshToken = (token) => {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
};
exports.hashRefreshToken = hashRefreshToken;
//# sourceMappingURL=token.service.js.map