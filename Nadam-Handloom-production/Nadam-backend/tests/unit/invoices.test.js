// Module 6: India-time periods, what the search box means, the summary PDF.
import { describe, it, expect } from 'vitest';
import { istRange, istYmd, istSameMonth } from '../../src/utils/day.js';
import { searchWhere } from '../../src/models/invoice.model.js';
import { renderSummaryPdf } from '../../src/services/salesSummaryPdf.service.js';

describe('periods are whole days in India time', () => {
  it('from midnight on the first day to 23:59:59.999 on the last', () => {
    const r = istRange('2026-10-01', '2026-10-31');
    expect(r.from.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-31T18:29:59.999Z');
    expect(istYmd(new Date('2026-10-31T18:29:59Z'))).toBe('2026-10-31');
    expect(istYmd(new Date('2026-10-31T18:30:00Z'))).toBe('2026-11-01');
  });
  it('"the same month" is India\'s month', () => {
    expect(istSameMonth(new Date('2026-09-30T18:31:00Z'), new Date('2026-10-20T10:00:00Z'))).toBe(true);
    expect(istSameMonth(new Date('2026-09-30T18:29:00Z'), new Date('2026-10-20T10:00:00Z'))).toBe(false);
  });
});

describe('the search box', () => {
  const kinds = (q) => JSON.stringify(searchWhere(q));
  it('a short number is an invoice number; 5+ digits also a mobile or order number', () => {
    expect(kinds('17')).toContain('INV-000017');
    expect(kinds('inv-17')).toContain('INV-000017');
    expect(kinds('17')).not.toContain('customerMobile');
    expect(kinds('98765')).toContain('customerMobile');
    expect(kinds('NH12345678')).toContain('orderNumber');
  });
  it('words search the name; a tag finds the invoice with that saree', () => {
    expect(kinds('Sita')).toContain('customerName');
    expect(kinds('NH3136')).toContain('barcode');
    expect(searchWhere('  ')).toBeNull();
  });
});

describe('the summary PDF', () => {
  const data = (n) => ({
    from: '2026-10-01', to: '2026-10-31', label: 'October 2026', channelsText: 'Counter, WhatsApp, Online',
    totals: { invoices: n, sarees: n, taxableValue: 3428.57 * n, cgst: 85.72 * n, sgst: 85.71 * n, total: 3600 * n, cancelled: 1, gstRatePercent: 5 },
    byChannel: { store: 3600 * n }, byPayment: { cash: 3600 * n }, withoutInvoice: { sales: 2, amount: 7200 },
    rows: Array.from({ length: n + 1 }, (_, i) => ({ number: `INV-${String(i + 1).padStart(6, '0')}`, date: '5 Oct 2026', customer: i === 0 ? 'Sita Devi' : 'Walk-in customer', channel: 'store', taxable: 3428.57, cgst: 85.72, sgst: 85.71, total: 3600, cancelled: i === n })),
    products: [{ name: 'Rainbow checks sarees', quantity: n, average: 3600, total: 3600 * n }],
  });
  const pages = (buf) => (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  it('totals page, then the invoices, then sarees by name; long periods run onto more pages', async () => {
    const small = await renderSummaryPdf(data(3));
    expect(small.subarray(0, 4).toString()).toBe('%PDF');
    expect(pages(small)).toBe(2);
    const big = await renderSummaryPdf(data(150));
    expect(pages(big)).toBeGreaterThan(4);
    const none = await renderSummaryPdf({ ...data(0), rows: [], products: [] });
    expect(pages(none)).toBe(1);
  });
});
