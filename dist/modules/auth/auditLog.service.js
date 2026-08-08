"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuthEvent = void 0;
const prisma_1 = require("../../config/prisma");
const logAuthEvent = async ({ accountId, eventType, req, metadata }) => {
    try {
        await prisma_1.prisma.authEvent.create({
            data: {
                authAccountId: accountId,
                eventType,
                ipAddress: req.ip ?? null,
                userAgent: req.headers['user-agent'] ?? null,
                metadata: (metadata ?? {}),
            },
        });
    }
    catch (e) {
        // An audit-write failure must never fail the auth request itself.
        console.error('[auditLog] failed to write AuthEvent', e);
    }
};
exports.logAuthEvent = logAuthEvent;
//# sourceMappingURL=auditLog.service.js.map