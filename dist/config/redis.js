"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisConnected = exports.redisClient = void 0;
exports.connectRedis = connectRedis;
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 3000,
        // Don't auto-retry forever in the background: every OTP/rate-limit code path
        // already has an in-memory fallback, so a bad/incompatible Redis should fail
        // once (letting connectRedis() below catch it) rather than block startup or
        // spam reconnect attempts indefinitely.
        reconnectStrategy: false,
    },
});
exports.isRedisConnected = false;
exports.redisClient.on('error', (err) => {
    if (exports.isRedisConnected) {
        console.error('Redis Client Error:', err.message);
    }
    exports.isRedisConnected = false;
});
exports.redisClient.on('connect', () => {
    exports.isRedisConnected = true;
    console.log('✅ Redis Client Connected');
});
async function connectRedis() {
    try {
        if (!exports.redisClient.isOpen) {
            await exports.redisClient.connect();
        }
    }
    catch (error) {
        exports.isRedisConnected = false;
        console.warn('⚠️ Could not connect to Redis. Falling back to in-memory mode for OTPs and Rate Limiting.');
    }
}
//# sourceMappingURL=redis.js.map