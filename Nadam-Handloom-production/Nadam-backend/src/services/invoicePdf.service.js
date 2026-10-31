// The customer's invoice PDF (Module 5). Same layout and sums as the old backend's
// invoices (invoices.pdf.ts), which customers already get: the letterhead, the lines
// with their tag, prices shown without GST, then taxable value, CGST, SGST and the
// total paid. New: "Paid by", the order number, and a CANCELLED stamp (decision 6.2).
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { splitGst, round2 } from '../utils/gst.js';

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_SIZE = 40;
const ROW_HEIGHT = 20;
const FOOTER_RESERVE = 150; // room for the GST block and the total on the last page

// The shop logo travels with the server, so an invoice never waits on a download.
let logo;
function logoBuffer() {
  if (logo === undefined) {
    try {
      logo = fs.readFileSync(new URL('../../assets/logo.png', import.meta.url));
    } catch (e) {
      console.error(`[invoice-pdf] no logo, continuing without it: ${e.message}`);
      logo = null;
    }
  }
  return logo;
}

export const money = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The shop's letterhead (also on the sales summary, Module 6).
// company: the shop details (Module 11 settings), else the server settings.
export function drawLetterhead(doc, company = env.company) {
  let y = MARGIN;
  const img = logoBuffer();
  if (img) {
    try {
      doc.image(img, PAGE_WIDTH / 2 - LOGO_SIZE / 2, y, { width: LOGO_SIZE, height: LOGO_SIZE });
    } catch (e) {
      console.error(`[invoice-pdf] logo could not be placed: ${e.message}`);
    }
    y += LOGO_SIZE + 6;
  }
  doc.fontSize(16).fillColor('#000000').font('Helvetica-Bold').text(company.name, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });
  y += 20;
  doc.fontSize(9).fillColor('#444444').font('Helvetica').text(company.address, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });
  y += 13;
  doc.text(`Mobile: ${/^\d{10}$/.test(String(company.mobile)) ? `+91 ${company.mobile.slice(0, 5)} ${company.mobile.slice(5)}` : company.mobile}    GSTIN: ${company.gstin}`, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });
  y += 18;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#cccccc').stroke();
  return y + 12;
}

// The product column gives up room for the tag; Qty, Price and Subtotal keep the
// same right edge as the old invoice, so the totals block lines up with them.
const COL = {
  sr: { x: MARGIN, width: 28 },
  name: { x: MARGIN + 28, width: 142 },
  tag: { x: MARGIN + 174, width: 96 },
  qty: { x: MARGIN + 270, width: 34 },
  price: { x: MARGIN + 304, width: 96 },
  subtotal: { x: MARGIN + 400, width: USABLE_WIDTH - 400 },
};

function drawTableHeader(doc, y) {
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
  doc.text('#', COL.sr.x, y, { width: COL.sr.width });
  doc.text('Product', COL.name.x, y, { width: COL.name.width });
  doc.text('Tag', COL.tag.x, y, { width: COL.tag.width });
  doc.text('Qty', COL.qty.x, y, { width: COL.qty.width, align: 'right' });
  doc.text('Price', COL.price.x, y, { width: COL.price.width, align: 'right' });
  doc.text('Subtotal', COL.subtotal.x, y, { width: COL.subtotal.width, align: 'right' });
  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#000000').stroke();
  return y + 6;
}

// Website payments tried with Razorpay's test keys on the live server (a TEST- number).
function stampTest(doc) {
  doc.save();
  doc.rotate(-18, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2 + 90] });
  doc.font('Helvetica-Bold').fontSize(30).fillColor('#5A5A5A').fillOpacity(0.35).text('TEST · NOT A TAX INVOICE', PAGE_WIDTH / 2 - 220, PAGE_HEIGHT / 2 + 75, { width: 440, align: 'center' });
  doc.restore();
}

function stampCancelled(doc) {
  doc.save();
  doc.rotate(-18, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2] });
  doc.lineWidth(4).strokeColor('#BF3328').strokeOpacity(0.45).roundedRect(PAGE_WIDTH / 2 - 170, PAGE_HEIGHT / 2 - 40, 340, 80, 10).stroke();
  doc.font('Helvetica-Bold').fontSize(48).fillColor('#BF3328').fillOpacity(0.45).text('CANCELLED', PAGE_WIDTH / 2 - 170, PAGE_HEIGHT / 2 - 23, { width: 340, align: 'center' });
  doc.restore();
}

/**
 * input: { number, orderNumber, date ("11 Oct 2026"), saleDate (only when the invoice was
 * made on a later day), paidBy ("Cash"), customerName,
 * customerMobile, lines: [{ name, tag, price (one piece, with GST), quantity }],
 * rate (GST %, the invoice's own), gst: { taxableValue, gstAmount, cgst, sgst }, igst (W6: one IGST
 * line instead of CGST + SGST), placeOfSupply (online orders), total, cancelled, test (a TEST-
 * number: Razorpay's test keys on the live server, "not a tax invoice"),
 * company (the shop details; Module 11) }
 */
export function renderInvoicePdf(input) {
  const company = input.company || env.company;
  const rate = input.rate ?? env.company.gstRatePercent;
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0, info: { Title: `Invoice ${input.number}`, Author: company.name } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const newPage = () => {
    if (input.cancelled) stampCancelled(doc);
    if (input.test) stampTest(doc);
    return drawLetterhead(doc, company);
  };
  let y = newPage();

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(input.test ? 'Test invoice (not a tax invoice)' : 'Invoice', MARGIN, y);
  y += 18;
  doc.fontSize(9).font('Helvetica');
  doc.text(`Invoice No: ${input.number}`, MARGIN, y);
  doc.text(`Date: ${input.date}`, MARGIN, y, { width: USABLE_WIDTH, align: 'right' });
  y += 12;
  doc.text(`Order No: ${input.orderNumber}`, MARGIN, y);
  if (input.paidBy) doc.text(`Paid by: ${input.paidBy}`, MARGIN, y, { width: USABLE_WIDTH, align: 'right' });
  y += 12;
  // An invoice made later for an earlier sale (Module 6, decision 6.5).
  if (input.saleDate) { doc.text(`Sale date: ${input.saleDate}`, MARGIN, y); y += 12; }
  y += 2;

  if (input.customerName || input.customerMobile) {
    doc.font('Helvetica-Bold').text('Customer', MARGIN, y);
    y += 12;
    doc.font('Helvetica');
    if (input.customerName) { doc.text(input.customerName, MARGIN, y, { width: USABLE_WIDTH / 2 }); y += 12; }
    if (input.customerMobile) { doc.text(`Mobile: ${input.customerMobile}`, MARGIN, y); y += 12; }
  }
  y += 6;
  y = drawTableHeader(doc, y);

  input.lines.forEach((line, i) => {
    if (y + ROW_HEIGHT > PAGE_HEIGHT - MARGIN - FOOTER_RESERVE) {
      doc.addPage();
      y = drawTableHeader(doc, newPage());
    }
    // Price and Subtotal are shown without GST, as on the old invoices; the GST
    // lines below add it back to the total paid.
    const qty = line.quantity || 1; // old-app lines can be several of one design
    const exGst = splitGst(line.price, rate).taxableValue;
    const lineExGst = splitGst(line.price * qty, rate).taxableValue;
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    doc.text(String(i + 1), COL.sr.x, y, { width: COL.sr.width });
    // height + ellipsis: one line, "…" when long, so rows never overlap.
    doc.text(line.name, COL.name.x, y, { width: COL.name.width, height: ROW_HEIGHT, ellipsis: true });
    doc.text(line.tag || '-', COL.tag.x, y, { width: COL.tag.width, height: ROW_HEIGHT, ellipsis: true });
    doc.text(String(qty), COL.qty.x, y, { width: COL.qty.width, align: 'right' });
    doc.text(money(exGst), COL.price.x, y, { width: COL.price.width, align: 'right' });
    doc.text(money(lineExGst), COL.subtotal.x, y, { width: COL.subtotal.width, align: 'right' });
    y += ROW_HEIGHT;
  });

  if (y + FOOTER_RESERVE > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    y = newPage();
  }
  y += 6;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#000000').stroke();
  y += 10;

  const sx = PAGE_WIDTH - MARGIN - 220;
  const row = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor('#000000');
    doc.text(label, sx, y, { width: 130 });
    doc.text(value, sx + 130, y, { width: 90, align: 'right' });
    y += bold ? 16 : 13;
  };
  const half = (rate / 2).toFixed(2);
  if (input.placeOfSupply) row('Place of supply', String(input.placeOfSupply));
  row('Taxable Value', money(input.gst.taxableValue));
  if (input.igst) {
    row(`IGST @ ${Number(rate).toFixed(2)}%`, money(input.gst.gstAmount ?? round2(input.gst.cgst + input.gst.sgst)));
  } else {
    row(`CGST @ ${half}%`, money(input.gst.cgst));
    row(`SGST @ ${half}%`, money(input.gst.sgst));
  }
  y += 4;
  doc.moveTo(sx, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor('#000000').stroke();
  y += 8;
  row('Total (GST included)', money(input.total), true);

  y += 24;
  doc.font('Helvetica').fontSize(9).fillColor('#777777').text(`Thank you for shopping at ${env.company.name}`, MARGIN, y, { width: USABLE_WIDTH, align: 'center' });

  doc.end();
  return done;
}
