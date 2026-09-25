import { describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/fetchImageBuffer', () => ({ fetchImageBuffer: vi.fn(async () => { throw new Error('no logo in tests'); }) }));

import { renderInvoicePdf } from './invoices.pdf';

const textOf = async (pdf: Buffer): Promise<string> => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  let out = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out += content.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return out;
};

const base = {
  documentTitle: 'Invoice',
  documentNumber: 'INV-1',
  dateLabel: '25 Sep 2026',
  gst: { taxableValue: 2857.14, gstAmount: 142.86, cgst: 71.43, sgst: 71.43 },
  total: 3000,
};

describe('invoice PDF', () => {
  it('prints each line\'s barcode on an invoice', async () => {
    const text = await textOf(
      await renderInvoicePdf({
        ...base,
        showBarcode: true,
        lines: [{ name: 'Pattu Saree', barcode: 'NANDAM3136', quantity: 1, unitPrice: 3000, subtotal: 3000 }],
      })
    );
    expect(text).toContain('Barcode');
    expect(text).toContain('NANDAM3136');
  });

  it('has no barcode column on the sales summary', async () => {
    const text = await textOf(
      await renderInvoicePdf({ ...base, lines: [{ name: 'Pattu Saree', quantity: 1, unitPrice: 3000, subtotal: 3000 }] })
    );
    expect(text).not.toContain('Barcode');
  });
});
