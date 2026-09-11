import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/prisma', async () => {
  const { createFakePrisma } = await import('../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../config/prisma';
import { rateLimit } from './rateLimit.middleware';
import { TooManyRequestsError } from '../utils/errors';

const fake = (prismaModule as any).__fake;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
});

const makeReq = (ip: string) => ({ ip }) as any;

describe('rateLimit middleware', () => {
  it('allows requests under the limit and blocks once the limit is reached', async () => {
    const middleware = rateLimit('test-route', { max: 3, windowSec: 60 });
    const next = vi.fn();

    for (let i = 0; i < 3; i++) {
      await middleware(makeReq('1.2.3.4'), {} as any, next);
    }
    expect(next).toHaveBeenCalledTimes(3);
    expect(next).not.toHaveBeenCalledWith(expect.anything());

    await middleware(makeReq('1.2.3.4'), {} as any, next);
    expect(next).toHaveBeenLastCalledWith(expect.any(TooManyRequestsError));
  });

  it('tracks separate IPs independently', async () => {
    const middleware = rateLimit('test-route-2', { max: 1, windowSec: 60 });
    const next = vi.fn();

    await middleware(makeReq('1.1.1.1'), {} as any, next);
    await middleware(makeReq('2.2.2.2'), {} as any, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalledWith(expect.anything());
  });
});
