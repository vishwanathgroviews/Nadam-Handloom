import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { sendPushToRoles } from '../notifications/notifications.service';
import { generateInvoiceForOrder } from '../invoices/invoices.service';

type Tx = Prisma.TransactionClient;

/** Writes an event in the same transaction as the change it describes — the core outbox guarantee. */
export const writeEvent = async (tx: Tx, eventType: string, payload: Record<string, unknown>): Promise<void> => {
  await tx.eventsOutbox.create({ data: { eventType, payload: payload as any } });
};

// Handlers: invoice generation, then push notification. If this handler
// throws (e.g. a transient S3 hiccup during invoice generation), the event
// stays undispatched and the next 5s sweep reruns the whole handler —
// generateInvoiceForOrder is idempotent so that retry is a safe no-op, but
// sendPushToRoles isn't, so invoice generation runs first: a retry after an
// invoice-step failure re-sends at most one push, never one per retry after
// the invoice already succeeded. Future consumers (chatbot, analytics)
// subscribe to the same EventsOutbox feed without this module, or anything
// that writes to it, needing to change.
const EVENT_HANDLERS: Record<string, (payload: any) => Promise<void>> = {
  'order.paid': async (payload) => {
    await generateInvoiceForOrder(payload.orderId, 'system');
    await sendPushToRoles(
      ['ADMIN', 'STAFF'],
      'New order received',
      `Order ${payload.orderNumber} — Rs.${payload.total}`,
      { type: 'order.paid', orderId: payload.orderId }
    );
  },
};

export const dispatchPendingEvents = async (): Promise<number> => {
  const pending = await prisma.eventsOutbox.findMany({
    where: { dispatched: false },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  let dispatchedCount = 0;
  for (const event of pending) {
    try {
      const handler = EVENT_HANDLERS[event.eventType];
      if (handler) await handler(event.payload);
      await prisma.eventsOutbox.update({ where: { id: event.id }, data: { dispatched: true } });
      dispatchedCount += 1;
    } catch (error) {
      console.error(`Failed to dispatch event ${event.id} (${event.eventType}):`, error);
      // Left dispatched=false — picked up again on the next sweep.
    }
  }
  return dispatchedCount;
};

/** Short interval — push notifications should feel near-instant, not batched. */
export const startEventDispatchSweep = () => {
  const SWEEP_INTERVAL_MS = 5 * 1000;

  const interval = setInterval(() => {
    dispatchPendingEvents().catch((error) => console.error('Event dispatch sweep failed:', error));
  }, SWEEP_INTERVAL_MS);

  interval.unref();
  return interval;
};
