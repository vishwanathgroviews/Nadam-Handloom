import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { connectRedis } from './config/redis';
import { prisma } from './config/prisma';

const port = process.env.PORT || 3000;

const startServer = async () => {
  // 1. Connect to Redis (Graceful fallback)
  await connectRedis();

  // 2. Test Prisma Database Connection
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully via Prisma.');
  } catch (error: any) {
    console.warn('⚠️ Could not connect to PostgreSQL database. Make sure PostgreSQL is running locally!');
  }

  // 3. Start Express
  app.listen(port, () => {
    console.log(`🚀 Authentication Backend running on http://localhost:${port}`);
    console.log(`💡 Note: If AWS SES or Redis credentials are inactive, the API automatically uses in-memory mock mode for seamless local testing.`);
  });
};

startServer();
