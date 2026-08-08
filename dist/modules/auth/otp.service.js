"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashOtp = exports.generateOtp = void 0;
const crypto_1 = require("crypto");
const generateOtp = () => {
    return (0, crypto_1.randomInt)(100000, 999999).toString();
};
exports.generateOtp = generateOtp;
const hashOtp = (code) => {
    return (0, crypto_1.createHash)('sha256').update(code).digest('hex');
};
exports.hashOtp = hashOtp;
//# sourceMappingURL=otp.service.js.map