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

const withActor = (metadata: Record<string, unknown> | undefined, actorId: string | undefined) => {
  if (!actorId) return metadata;
  return { ...(metadata ?? {}), actorId };
};

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
        // The signed-in person who made the request, recorded on every event.
        // authAccountId alone can't say this: for some events it is the
        // account the action was done to (the customer whose order shipped,
        // the person being invited), not the one who did it.
        metadata: withActor(metadata, (req as { user?: { id?: string } } | undefined)?.user?.id) as any,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log entry:', error);
  }
};
