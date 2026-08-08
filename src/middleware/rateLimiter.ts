import { Request, Response, NextFunction } from 'express';
import { redisClient, isRedisConnected } from '../config/redis';

// Max 5 requests per minute per IP
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const inMemoryRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `rate-limit:${req.path}:${ip}`;

    if (isRedisConnected && redisClient.isOpen) {
      const currentRequests = await redisClient.incr(key);

      if (currentRequests === 1) {
        await redisClient.expire(key, RATE_LIMIT_WINDOW_SECONDS);
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
  } catch (error) {
    next();
  }
};
