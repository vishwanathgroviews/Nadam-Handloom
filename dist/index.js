"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = require("./app");
const redis_1 = require("./config/redis");
const prisma_1 = require("./config/prisma");
const port = process.env.PORT || 3000;
const startServer = async () => {
    // 1. Connect to Redis (Graceful fallback)
    await (0, redis_1.connectRedis)();
    // 2. Test Prisma Database Connection
    try {
        await prisma_1.prisma.$connect();
        console.log('✅ PostgreSQL connected successfully via Prisma.');
    }
    catch (error) {
        console.warn('⚠️ Could not connect to PostgreSQL database. Make sure PostgreSQL is running locally!');
    }
    // 3. Start Express
    app_1.app.listen(port, () => {
        console.log(`🚀 Authentication Backend running on http://localhost:${port}`);
        console.log(`💡 Note: If AWS SES or Redis credentials are inactive, the API automatically uses in-memory mock mode for seamless local testing.`);
    });
};
startServer();
//# sourceMappingURL=index.js.map