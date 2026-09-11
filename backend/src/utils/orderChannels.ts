import { PAID_STATUSES } from './constants';

// Every way an order can reach the business. Kept in one place so a new
// channel can't be silently missed by one report and counted by another —
// analytics, the invoice list and the sales-summary PDF all build their
// `where` clause from the helper below.
export const ORDER_CHANNELS = ['online', 'store', 'whatsapp'] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];
export type ChannelFilter = 'all' | OrderChannel;

/**
 * The `OR` clause selecting orders that actually count as sales.
 *
 * Store-channel orders are created already `delivered` and are paid at the
 * counter (see inventory.service.ts's createOfflineOrder), so they need no
 * status filter. Online and WhatsApp orders both move through a status
 * lifecycle — an abandoned online checkout sits at `pending_payment` and
 * must never be counted — so both are filtered to PAID_STATUSES.
 */
export const paidOrderWhereClauses = (channel: ChannelFilter = 'all') => {
  const byChannel: Record<OrderChannel, Record<string, unknown>> = {
    store: { channel: 'store' },
    online: { channel: 'online', status: { in: PAID_STATUSES } },
    whatsapp: { channel: 'whatsapp', status: { in: PAID_STATUSES } },
  };

  if (channel === 'all') return Object.values(byChannel);
  return [byChannel[channel]];
};
