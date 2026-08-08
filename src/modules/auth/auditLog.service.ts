import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface LogAuthEventParams {
  accountId: string | null;
  eventType: string;
  req: Request;
  metadata?: Record<string, unknown>;
}

export const logAuthEvent = async ({ accountId, eventType, req, metadata }: LogAuthEventParams): Promise<void> => {
  try {
    await prisma.authEvent.create({
      data: {
        authAccountId: accountId,
        eventType,
        ipAddress: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    // An audit-write failure must never fail the auth request itself.
    console.error('[auditLog] failed to write AuthEvent', e);
  }
};
