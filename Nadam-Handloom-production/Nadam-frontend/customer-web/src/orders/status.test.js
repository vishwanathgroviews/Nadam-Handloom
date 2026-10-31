// How an order is worded (W7): status, what's next, the progress steps, Buy again's message.
import { describe, it, expect } from 'vitest';
import { amountLabel, nextLine, orderTitle, statusText, steps } from './status.js';
import { buyAgainMessage } from './actions.js';

const base = { number: 'NH1', placedAt: '2026-10-17T04:42:00.000Z', total: 5800, payment: { paidAt: '2026-10-17T04:44:00.000Z' } };
const SH = { carrier: 'DTDC', trackingNumber: 'D7348812905', shippedAt: '2026-10-18T09:30:00.000Z', deliveredAt: '2026-10-21T06:00:00.000Z' };

describe('status words', () => {
  it('each status, and a shop cancel before and after its refund', () => {
    expect(['awaiting_payment', 'confirming', 'paid', 'shipped', 'delivered', 'refunded'].map((status) => statusText({ status })))
      .toEqual(['Waiting for payment', 'Confirming payment', 'Being packed', 'Shipped', 'Delivered', 'Refunded']);
    expect(statusText({ status: 'cancelled_paid', cancelled: { refundedAt: null } })).toBe('Cancelled · refund on its way');
    expect(statusText({ status: 'cancelled_paid', cancelled: { refundedAt: '2026-10-19T00:00:00Z' } })).toBe('Cancelled · refunded');
  });

  it('what happens next, in one line', () => {
    expect(nextLine({ ...base, status: 'paid' })[1]).toBe('Paid 17 Oct. We pack within 2 working days.');
    expect(nextLine({ ...base, status: 'shipped', shipping: SH })).toEqual(['truck', 'Shipped 18 Oct · DTDC D7348812905']);
    expect(nextLine({ ...base, status: 'shipped', shipping: { ...SH, trackingNumber: null } })[1]).toBe('Shipped 18 Oct by DTDC');
    expect(nextLine({ ...base, status: 'delivered', shipping: SH })[1]).toBe('Delivered 21 Oct');
    expect(nextLine({ ...base, status: 'refunded', refund: { amount: 4800, status: 'processed' } })[1]).toBe('₹4,800 refunded to your account');
    expect(nextLine({ ...base, status: 'cancelled_paid', cancelled: { refundedAt: '2026-10-19T05:00:00Z' } })[1]).toBe('Cancelled by the shop. ₹5,800 refunded on 19 Oct.');
    expect(amountLabel({ status: 'awaiting_payment' })).toBe('To pay');
    expect(amountLabel({ status: 'refunded', refund: { status: 'processed' } })).toBe('Refunded');
  });

  it('the title: the first saree and how many more', () => {
    expect(orderTitle({ title: 'Pure Pattu', sarees: 3 })).toBe('Pure Pattu and 2 more');
    expect(orderTitle({ lines: [{ name: 'Plain' }] })).toBe('Plain');
  });

  it('the progress: one step at a time, the next one current', () => {
    const at = (status, shipping = null) => steps({ ...base, status, shipping }).map((s) => (s.done ? 'done' : s.current ? 'now' : '-'));
    expect(at('paid')).toEqual(['done', 'now', '-', '-']);
    expect(at('shipped', SH)).toEqual(['done', 'done', 'done', 'now']);
    expect(at('delivered', SH)).toEqual(['done', 'done', 'done', 'done']);
    expect(steps({ ...base, status: 'shipped', shipping: SH })[2].text).toBe('18 Oct · DTDC');
  });
});

describe('Buy again\'s message', () => {
  const r = (over) => ({ added: [], raised: [], already: [], skipped: [], ...over });
  it('added, raised, already there, sold, gone, the bag full', () => {
    expect(buyAgainMessage(r({ added: [{ name: 'A' }] })).text).toBe('1 saree added to your bag.');
    expect(buyAgainMessage(r({ added: [{ name: 'A' }], raised: [{ name: 'B' }] })).text).toBe('2 sarees added to your bag.');
    expect(buyAgainMessage(r({ already: [{ name: 'A' }] }))).toEqual({ text: 'This saree is already in your bag.', missing: 0, ok: true });
    const none = buyAgainMessage(r({ skipped: [{ name: 'A', reason: 'sold_out' }, { name: 'B', reason: 'sold_out' }] }));
    expect(none).toEqual({ text: 'None of these sarees can be bought now. 2 have sold since.', missing: 2, ok: false });
    expect(buyAgainMessage(r({ added: [{ name: 'A' }], skipped: [{ name: 'B', reason: 'bag_full' }] })).text).toBe('1 saree added to your bag. 1 didn\'t fit: your bag is full (20 sarees).');
  });
});
