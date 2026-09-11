import { Request } from 'express';
import { prisma } from '../../config/prisma';

export type AuthEventSource = 'customer_web' | 'staff_app';

interface LogAuthEventInput {
  authAccountId?: string | null;
  eventType: string;
  source: AuthEventSource;
  req?: Request;
  metadata?: Record<string, unknown>;
}

/** Best-effort audit logger — a logging failure must never break the auth request itself. */
export const logAuthEvent = async ({
  authAccountId,
  eventType,
  source,
  req,
  metadata,
}: LogAuthEventInput): Promise<void> => {
  try {
    await prisma.authEvent.create({
      data: {
        authAccountId: authAccountId ?? null,
        eventType,
        source,
        ipAddress: req?.ip ?? null,
        userAgent: req?.headers['user-agent'] ?? null,
        metadata: metadata as any,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log entry:', error);
  }
};
