"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const argon2 = __importStar(require("argon2"));
const prisma_1 = require("../../config/prisma");
// Argon2 options for enterprise-grade hashing
const hashOptions = {
    // node-argon2's .d.cts widens this constant to `number` under esModuleInterop
    // namespace-style imports; cast back to the literal union `Options.type` expects.
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
};
class AuthService {
    static async hashPassword(password) {
        return argon2.hash(password, hashOptions);
    }
    static async verifyPassword(password, hash) {
        return argon2.verify(hash, password);
    }
    static async registerCustomer(data) {
        const passwordHash = await this.hashPassword(data.password);
        // Get the CUSTOMER role ID
        const role = await prisma_1.prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
        if (!role)
            throw new Error('Customer role not found in DB');
        // Run in a transaction to prevent orphaned records
        return await prisma_1.prisma.$transaction(async (tx) => {
            const account = await tx.authAccount.create({
                data: {
                    email: data.email,
                    phone: data.phone,
                    passwordHash,
                    roles: {
                        create: { roleId: role.id }
                    },
                    userProfile: {
                        create: {
                            firstName: data.firstName,
                            lastName: data.lastName
                        }
                    }
                },
                include: {
                    userProfile: true,
                    roles: { include: { role: true } }
                }
            });
            return account;
        });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map