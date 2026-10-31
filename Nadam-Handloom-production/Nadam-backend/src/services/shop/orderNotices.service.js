// Website W7 (7.8 A): the customer hears when the shop ships or delivers their website order in
// the admin app: a notification on the browsers where they turned on order updates (W1), and
// the order page. Never for counter or WhatsApp orders. Sent in the background, one after
// another, so marking an order never waits for Firebase.
import { notifyCustomer } from './push.service.js';

const link = (order) => `/order/${order.orderNumber}`;

export const noticeFor = {
  shipped: (order, { carrier, awb }) => ({
    type: 'order_shipped',
    title: 'Your order has shipped',
    body: `${order.orderNumber} is on its way with ${carrier}. Tracking number ${awb}. Tap to see it.`,
    link: link(order),
  }),
  delivered: (order) => ({
    type: 'order_delivered',
    title: 'Your order was delivered',
    body: `${order.orderNumber} was delivered. We hope you love it.`,
    link: link(order),
  }),
};

let pending = Promise.resolve();
export function tellCustomer(order, message) {
  if (order.channel !== 'online' || !order.authAccountId) return pending;
  pending = pending
    .then(() => notifyCustomer({ accountId: order.authAccountId, ...message, data: { orderNumber: order.orderNumber } }))
    .catch((err) => console.error(`[order-notices] ${order.orderNumber}: ${err.message}`));
  return pending;
}

// Tests: wait for the notices sent so far.
export const noticesSettled = () => pending;
