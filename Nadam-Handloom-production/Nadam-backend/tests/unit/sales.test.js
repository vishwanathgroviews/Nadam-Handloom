// Module 5: GST sums (same as the old backend), the shop's day (India time), the invoice PDF.
import { describe, it, expect } from 'vitest';
import { splitGst, billGst, sumMoney } from '../../src/utils/gst.js';
import { istDayStart, istSameDay, istTime, istDate } from '../../src/utils/day.js';
import { renderInvoicePdf } from '../../src/services/invoicePdf.service.js';

describe('GST (prices include 5%)', () => {
  it('splits a price like the old invoices: taxable, then CGST and SGST, adding back exactly', () => {
    expect(splitGst(3600, 5)).toEqual({ taxableValue: 3428.57, gstAmount: 171.43, cgst: 85.72, sgst: 85.71 });
    expect(splitGst(1050, 5)).toEqual({ taxableValue: 1000, gstAmount: 50, cgst: 25, sgst: 25 });
    for (const a of [1, 99.99, 1999.99, 54310, 1000000]) {
      const s = splitGst(a, 5);
      expect(Math.round((s.taxableValue + s.cgst + s.sgst) * 100)).toBe(Math.round(a * 100));
    }
  });
  it('a bill is split line by line and added up, to the paisa', () => {
    const lines = [3600, 1200, 999.99, 0.01];
    const b = billGst(lines, 5);
    expect(Math.round((b.taxableValue + b.cgst + b.sgst) * 100)).toBe(Math.round(sumMoney(lines) * 100));
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });
});

describe('the shop\'s day is India time', () => {
  it('starts at midnight in India, wherever the server is', () => {
    expect(istDayStart(new Date('2026-10-11T19:00:00Z')).toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(istDayStart(new Date('2026-10-11T18:29:59Z')).toISOString()).toBe('2026-10-10T18:30:00.000Z');
    expect(istSameDay(new Date('2026-10-11T18:31:00Z'), new Date('2026-10-12T18:00:00Z'))).toBe(true);
    expect(istSameDay(new Date('2026-10-11T18:29:00Z'), new Date('2026-10-11T18:31:00Z'))).toBe(false);
  });
  it('shows times and dates the Indian way', () => {
    expect(istTime(new Date('2026-10-11T10:45:00Z'))).toBe('4:15 pm');
    expect(istDate(new Date('2026-10-11T10:45:00Z'))).toBe('11 Oct 2026');
  });
});

describe('invoice PDF', () => {
  const input = (n, cancelled = false) => ({
    number: 'INV-000016', orderNumber: 'NH12345678', date: '11 Oct 2026', paidBy: 'Cash', customerName: 'Sita Devi', customerMobile: '9848022338',
    lines: Array.from({ length: n }, (_, i) => ({ name: `Mangalagiri pattu saree ${i + 1} with a very long name that is cut short`, tag: `NH${3000 + i}`, price: 3600 })),
    gst: billGst(Array(n).fill(3600), 5), total: 3600 * n, cancelled,
  });
  const pages = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  it('one page for a small bill; more pages for a 100-saree bill; a cancelled one too', async () => {
    const one = await renderInvoicePdf(input(3));
    expect(one.subarray(0, 4).toString()).toBe('%PDF');
    expect(pages(one)).toBe(1);
    const big = await renderInvoicePdf(input(100));
    expect(pages(big)).toBeGreaterThan(2);
    const cancelled = await renderInvoicePdf(input(3, true));
    expect(cancelled.length).toBeGreaterThan(one.length);
  });
});
