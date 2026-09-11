import PDFDocument from 'pdfkit';
import { COMPANY } from '../../config/company';
import { fetchImageBuffer } from '../../utils/fetchImageBuffer';
import { GstSplit, splitGst } from '../../utils/gst';

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_SIZE = 40;
const ROW_HEIGHT = 20;
const FOOTER_RESERVE = 150; // room for the GST summary + total block on the last page

export interface InvoiceLine {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InvoiceRenderInput {
  documentTitle: string; // "Invoice" or "Sales Summary"
  documentNumber: string; // invoice number, or a period label for reports
  dateLabel: string;
  customerName?: string | null;
  customerMobile?: string | null;
  lines: InvoiceLine[];
  gst: GstSplit;
  total: number;
}

const getLogoBuffer = async (): Promise<Buffer | null> => {
  try {
    return await fetchImageBuffer(COMPANY.logoUrl);
  } catch (error) {
    console.error('Failed to fetch company logo for PDF header, continuing without it:', error);
    return null;
  }
};

/** Draws the shop letterhead at the top of the current page and returns the y position just below it. */
const drawLetterhead = (doc: PDFKit.PDFDocument, logoBuffer: Buffer | null): number => {
  let y = MARGIN;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, PAGE_WIDTH / 2 - LOGO_SIZE / 2, y, { width: LOGO_SIZE, height: LOGO_SIZE });
    } catch (error) {
      console.error('Failed to embed logo in PDF, skipping:', error);
    }
    y += LOGO_SIZE + 6;
  }

  doc.fontSize(16).fillColor('#000000').font('Helvetica-Bold').text(COMPANY.name, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });
  y += 20;
  doc.fontSize(9).fillColor('#444444').font('Helvetica').text(COMPANY.address, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });
  y += 13;
  doc.text(`Mobile: ${COMPANY.mobile}    GSTIN: ${COMPANY.gstin}`, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });
  y += 18;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#cccccc').stroke();
  return y + 12;
};

const COL = {
  name: { x: MARGIN, width: 250 },
  qty: { x: MARGIN + 250, width: 50 },
  price: { x: MARGIN + 300, width: 100 },
  subtotal: { x: MARGIN + 400, width: USABLE_WIDTH - 400 },
};

const drawTableHeader = (doc: PDFKit.PDFDocument, y: number): number => {
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
  doc.text('Product', COL.name.x, y, { width: COL.name.width });
  doc.text('Qty', COL.qty.x, y, { width: COL.qty.width, align: 'right' });
  doc.text('Price', COL.price.x, y, { width: COL.price.width, align: 'right' });
  doc.text('Subtotal', COL.subtotal.x, y, { width: COL.subtotal.width, align: 'right' });
  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#000000').stroke();
  return y + 6;
};

const money = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const renderInvoicePdf = async (input: InvoiceRenderInput): Promise<Buffer> => {
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const logoBuffer = await getLogoBuffer();

  let y = drawLetterhead(doc, logoBuffer);

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(input.documentTitle, MARGIN, y);
  y += 18;
  doc.fontSize(9).font('Helvetica');
  doc.text(`${input.documentTitle} No: ${input.documentNumber}`, MARGIN, y);
  doc.text(`Date: ${input.dateLabel}`, MARGIN, y, { width: USABLE_WIDTH, align: 'right' });
  y += 14;

  if (input.customerName) {
    doc.font('Helvetica-Bold').text('Customer', MARGIN, y);
    y += 12;
    doc.font('Helvetica').text(input.customerName, MARGIN, y);
    y += 12;
    if (input.customerMobile) {
      doc.text(`Mobile: ${input.customerMobile}`, MARGIN, y);
      y += 12;
    }
  }
  y += 6;

  y = drawTableHeader(doc, y);

  for (const line of input.lines) {
    if (y + ROW_HEIGHT > PAGE_HEIGHT - MARGIN - FOOTER_RESERVE) {
      doc.addPage();
      y = drawLetterhead(doc, logoBuffer);
      y = drawTableHeader(doc, y);
    }

    // Price and Subtotal are both GST-exclusive here, so Subtotal = Price x
    // Qty on every row (line.unitPrice/line.subtotal are the GST-inclusive
    // figures used for the order total and the Taxable Value/CGST/SGST
    // footer, but this table only ever shows the exclusive rate).
    const priceExGst = splitGst(line.unitPrice, COMPANY.gstRatePercent).taxableValue;
    const subtotalExGst = priceExGst * line.quantity;

    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    // height + ellipsis together force single-line truncation ("…") instead
    // of wrapping onto a second line, which would overlap the row below at
    // this fixed ROW_HEIGHT.
    doc.text(line.name, COL.name.x, y, { width: COL.name.width, height: ROW_HEIGHT, ellipsis: true });
    doc.text(String(line.quantity), COL.qty.x, y, { width: COL.qty.width, align: 'right' });
    doc.text(money(priceExGst), COL.price.x, y, { width: COL.price.width, align: 'right' });
    doc.text(money(subtotalExGst), COL.subtotal.x, y, { width: COL.subtotal.width, align: 'right' });
    y += ROW_HEIGHT;
  }

  if (y + FOOTER_RESERVE > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    y = drawLetterhead(doc, logoBuffer);
  }

  y += 6;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#000000').stroke();
  y += 10;

  const summaryX = PAGE_WIDTH - MARGIN - 220;
  const summaryLabelWidth = 130;
  const summaryValueWidth = 90;
  const summaryRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5);
    doc.text(label, summaryX, y, { width: summaryLabelWidth });
    doc.text(value, summaryX + summaryLabelWidth, y, { width: summaryValueWidth, align: 'right' });
    y += bold ? 16 : 13;
  };

  summaryRow('Taxable Value', money(input.gst.taxableValue));
  summaryRow(`CGST @ ${(COMPANY.gstRatePercent / 2).toFixed(2)}%`, money(input.gst.cgst));
  summaryRow(`SGST @ ${(COMPANY.gstRatePercent / 2).toFixed(2)}%`, money(input.gst.sgst));
  y += 4;
  doc.moveTo(summaryX, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#000000').stroke();
  y += 8;
  summaryRow('Total', money(input.total), true);

  doc.end();
  return done;
};
