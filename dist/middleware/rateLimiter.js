"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const redis_1 = require("../config/redis");
// Max 5 requests per minute per IP
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const inMemoryRateLimitStore = new Map();
const rateLimiter = async (req, res, next) => {
    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `rate-limit:${req.path}:${ip}`;
        if (redis_1.isRedisConnected && redis_1.redisClient.isOpen) {
            const currentRequests = await redis_1.redisClient.incr(key);
            if (currentRequests === 1) {
                await redis_1.redisClient.expire(key, RATE_LIMIT_WINDOW_SECONDS);
            }
            if (currentRequests > RATE_LIMIT_MAX) {
                res.status(429).json({ error: 'Too many requests, please try again later.' });
                return;
            }
            return next();
        }
        // In-memory fallback rate limiter
        const now = Date.now();
        const record = inMemoryRateLimitStore.get(key);
        if (!record || now > record.resetAt) {
            inMemoryRateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 });
            return next();
        }
        record.count += 1;
        if (record.count > RATE_LIMIT_MAX) {
            res.status(429).json({ error: 'Too many requests, please try again later.' });
            return;
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.rateLimiter = rateLimiter;
//# sourceMappingURL=rateLimiter.js.map