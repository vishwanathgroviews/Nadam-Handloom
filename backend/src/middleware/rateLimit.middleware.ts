import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitOptions {
  max: number;
  windowSec: number;
}

/** Postgres-backed sliding-window rate limiter, keyed by route + client IP. */
export const rateLimit = (routeKey: string, { max, windowSec }: RateLimitOptions) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const bucketKey = `${routeKey}:${req.ip ?? 'unknown'}`;
      const windowStart = new Date(Date.now() - windowSec * 1000);

      const count = await prisma.rateLimitHit.count({
        where: { bucketKey, createdAt: { gt: windowStart } },
      });

      if (count >= max) {
        return next(new TooManyRequestsError());
      }

      await prisma.rateLimitHit.create({ data: { bucketKey } });
      next();
    } catch (error) {
      next(error);
    }
  };
};

/** Periodically prunes old rate-limit rows so the table doesn't grow unbounded. */
export const startRateLimitCleanup = () => {
  const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
  const RETENTION_MS = 60 * 60 * 1000;

  const interval = setInterval(() => {
    prisma.rateLimitHit
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } })
      .catch((error) => console.error('Rate limit cleanup failed:', error));
  }, PRUNE_INTERVAL_MS);

  interval.unref();
  return interval;
};
