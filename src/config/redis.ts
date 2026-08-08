import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
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

export let isRedisConnected = false;

redisClient.on('error', (err) => {
  if (isRedisConnected) {
    console.error('Redis Client Error:', err.message);
  }
  isRedisConnected = false;
});

redisClient.on('connect', () => {
  isRedisConnected = true;
  console.log('✅ Redis Client Connected');
});

export async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error: any) {
    isRedisConnected = false;
    console.warn('⚠️ Could not connect to Redis. Falling back to in-memory mode for OTPs and Rate Limiting.');
  }
}
