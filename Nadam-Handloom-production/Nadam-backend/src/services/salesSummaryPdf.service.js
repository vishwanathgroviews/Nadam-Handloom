// The sales summary PDF (Module 6, decision 6.2 C): a totals page, then every invoice
// in the period (what the accountant needs for GST), then sarees by name with the
// average price (as the old summary). Same letterhead and money format as the invoices.
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { drawLetterhead, money } from './invoicePdf.service.js';
import { istDate } from '../utils/day.js';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const RIGHT = PAGE_WIDTH - MARGIN;
const BOTTOM = PAGE_HEIGHT - MARGIN - 20;
const MAROON = '#7A1F2B';
const CHANNEL_TEXT = { store: 'Counter', whatsapp: 'WhatsApp', online: 'Online' };
const PAY_TEXT = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Online payment', none: 'Not recorded' };
const plain = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function renderSummaryPdf(d, company = env.company) {
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0, info: { Title: `Sales summary ${d.label}`, Author: company.name } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  let page = 1;
  const footer = () => doc.font('Helvetica').fontSize(8).fillColor('#888888').text(`${company.name} · Sales summary · ${d.label} · page ${page}`, MARGIN, PAGE_HEIGHT - MARGIN, { width: PAGE_WIDTH - MARGIN * 2, align: 'center' });
  const newPage = () => { footer(); doc.addPage(); page += 1; return MARGIN; };

  // ---------- page 1: the totals ----------
  let y = drawLetterhead(doc, company);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text('Sales summary', MARGIN, y);
  y += 20;
  doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
  doc.text(`Period: ${d.label} (${istDate(new Date(`${d.from}T12:00:00+05:30`))} to ${istDate(new Date(`${d.to}T12:00:00+05:30`))}, India time)`, MARGIN, y); y += 13;
  doc.text(`Channels: ${d.channelsText}`, MARGIN, y); y += 13;
  doc.text(`Made on ${istDate(new Date())}. Dates are invoice dates. All prices include GST.`, MARGIN, y); y += 20;

  const kv = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor('#000000');
    doc.text(label, MARGIN, y, { width: 300 });
    doc.text(value, RIGHT - 200, y, { width: 200, align: 'right' });
    y += bold ? 17 : 15;
  };
  const rule = () => { doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.6).strokeColor('#cccccc').stroke(); y += 8; };
  const section = (title) => { y += 6; doc.font('Helvetica-Bold').fontSize(11).fillColor(MAROON).text(title, MARGIN, y); y += 17; };
  const t = d.totals;
  const half = (t.gstRatePercent / 2).toFixed(2);
  section('Totals');
  kv('Invoices', String(t.invoices));
  kv('Sarees', String(t.sarees));
  kv('Taxable value', money(t.taxableValue));
  kv(`CGST @ ${half}%`, money(t.cgst));
  kv(`SGST @ ${half}%`, money(t.sgst));
  rule();
  kv('Total (GST included)', money(t.total), true);
  if (Object.keys(d.byChannel).length) {
    section('By channel');
    for (const [k, v] of Object.entries(d.byChannel)) kv(CHANNEL_TEXT[k], money(v));
  }
  if (Object.keys(d.byPayment).length) {
    section('By payment');
    for (const [k, v] of Object.entries(d.byPayment)) kv(PAY_TEXT[k], money(v));
  }
  y += 8;
  doc.font('Helvetica').fontSize(9.5).fillColor('#333333');
  if (t.cancelled) { doc.text(`${t.cancelled} cancelled invoice${t.cancelled === 1 ? ' is' : 's are'} listed on the next pages and not counted in these totals.`, MARGIN, y, { width: RIGHT - MARGIN }); y += 14; }
  if (d.withoutInvoice.sales) {
    doc.font('Helvetica-Bold').text(`Sales recorded without an invoice: ${d.withoutInvoice.sales}, ${money(d.withoutInvoice.amount)}.`, MARGIN, y, { width: RIGHT - MARGIN });
    y += 13;
    doc.font('Helvetica').text('These are not in the totals above (no invoice was issued for them).', MARGIN, y, { width: RIGHT - MARGIN });
    y += 14;
  }
  if (!d.rows.length) { y += 8; doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('No invoices in this period.', MARGIN, y); }

  // ---------- the invoices ----------
  if (d.rows.length) {
    const C = [
      { k: 'number', w: 66, t: 'Invoice' }, { k: 'date', w: 60, t: 'Date' }, { k: 'customer', w: 118, t: 'Customer' }, { k: 'channel', w: 52, t: 'Channel' },
      { k: 'taxable', w: 60, t: 'Taxable', r: true }, { k: 'cgst', w: 45, t: 'CGST', r: true }, { k: 'sgst', w: 45, t: 'SGST', r: true }, { k: 'total', w: 69, t: 'Total', r: true },
    ];
    const head = () => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      let x = MARGIN;
      for (const c of C) { doc.text(c.t, x, y, { width: c.w - 4, align: c.r ? 'right' : 'left' }); x += c.w; }
      y += 12; doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.8).strokeColor('#000000').stroke(); y += 5;
    };
    y = newPage();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(MAROON).text(`Invoices · ${d.label}`, MARGIN, y); y += 20;
    head();
    for (const r of d.rows) {
      if (y > BOTTOM) { y = newPage(); head(); }
      const v = { ...r, channel: CHANNEL_TEXT[r.channel], customer: r.cancelled ? `CANCELLED · ${r.customer}` : r.customer, taxable: plain(r.taxable), cgst: plain(r.cgst), sgst: plain(r.sgst), total: plain(r.total) };
      doc.font('Helvetica').fontSize(8.5).fillColor(r.cancelled ? '#999999' : '#000000');
      let x = MARGIN;
      for (const c of C) { doc.text(String(v[c.k] ?? ''), x, y, { width: c.w - 4, align: c.r ? 'right' : 'left', height: 11, ellipsis: true, strike: r.cancelled && c.r }); x += c.w; }
      y += 14;
    }
    if (y > BOTTOM) y = newPage();
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.8).strokeColor('#000000').stroke(); y += 5;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
    let x = MARGIN;
    const sums = { number: 'Total', date: '', customer: `${t.invoices} invoice${t.invoices === 1 ? '' : 's'}`, channel: '', taxable: plain(t.taxableValue), cgst: plain(t.cgst), sgst: plain(t.sgst), total: plain(t.total) };
    for (const c of C) { doc.text(sums[c.k], x, y, { width: c.w - 4, align: c.r ? 'right' : 'left', height: 11, ellipsis: true }); x += c.w; }
    y += 18;

    // ---------- sarees by name ----------
    const P = [{ k: 'name', w: 275, t: 'Product' }, { k: 'quantity', w: 50, t: 'Qty', r: true }, { k: 'average', w: 90, t: 'Average price', r: true }, { k: 'total', w: 100, t: 'Total', r: true }];
    const phead = () => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      let px = MARGIN;
      for (const c of P) { doc.text(c.t, px, y, { width: c.w - 4, align: c.r ? 'right' : 'left' }); px += c.w; }
      y += 12; doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.8).strokeColor('#000000').stroke(); y += 5;
    };
    if (y > BOTTOM - 80) y = newPage(); else y += 10;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(MAROON).text('Sarees by name', MARGIN, y); y += 20;
    phead();
    for (const p of d.products) {
      if (y > BOTTOM) { y = newPage(); phead(); }
      doc.font('Helvetica').fontSize(8.5).fillColor('#000000');
      let px = MARGIN;
      const v = { name: p.name, quantity: String(p.quantity), average: plain(p.average), total: plain(p.total) };
      for (const c of P) { doc.text(v[c.k], px, y, { width: c.w - 4, align: c.r ? 'right' : 'left', height: 11, ellipsis: true }); px += c.w; }
      y += 14;
    }
  }
  footer();
  doc.end();
  return done;
}
