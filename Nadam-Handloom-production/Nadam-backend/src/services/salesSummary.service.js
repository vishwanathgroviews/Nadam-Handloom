// Module 6: the sales summary for a month or any dates (owners, sales.view). Made fresh
// every time, never stored. The figures are the invoices' own (number, taxable value,
// CGST, SGST, total as printed on each invoice), so the summary always matches the
// invoices list for the same period (6.7).
//
// - Cancelled invoices are listed and marked, never counted (6.4).
// - Sales recorded without an invoice: one separate line, outside the GST totals (6.3).
// - The PDF: a totals page, every invoice, then sarees by name (6.2 C); the CSV has one
//   row per invoice for Excel (6.6).
import * as I from '../models/invoice.model.js';
import { customerLabel, rangeOf } from './invoiceBook.service.js';
import { PAID_BY_TEXT } from './invoice.service.js';
import { renderSummaryPdf } from './salesSummaryPdf.service.js';
import { shopDetails } from './settings.service.js';
import { sumMoney } from '../utils/gst.js';
import { istDate, istYmd } from '../utils/day.js';
import { env } from '../config/env.js';

export const CHANNELS = ['store', 'whatsapp', 'online'];
const CHANNEL_TEXT = { store: 'Counter', whatsapp: 'WhatsApp', online: 'Online' };
const num = (d) => Number(d ?? 0);

function periodLabel(from, to) {
  if (from === to) return istDate(new Date(`${from}T12:00:00+05:30`));
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const month = new Date(Date.UTC(fy, fm - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (fy === ty && fm === tm && fd === 1 && td === lastDay) return month;
  if (fy === ty && fm === tm && fd === 1 && to === istYmd()) return `${month} (so far)`;
  return `${istDate(new Date(`${from}T12:00:00+05:30`))} – ${istDate(new Date(`${to}T12:00:00+05:30`))}`;
}

export async function summaryData({ from, to, channels }) {
  const range = rangeOf({ from, to }, { maxDays: 366 });
  const chs = CHANNELS.filter((c) => channels.includes(c));
  const [invoices, without] = await Promise.all([I.forSummary({ range, channels: chs }), I.salesWithout({ range, channels: chs })]);
  const rows = invoices.map((inv) => {
    const cancelled = I.isCancelledInvoice(inv);
    return {
      number: inv.invoiceNumber,
      date: istDate(inv.generatedAt),
      ymd: istYmd(inv.generatedAt),
      customer: customerLabel(inv),
      mobile: inv.customerMobile ?? '',
      channel: inv.channel,
      paidBy: PAID_BY_TEXT[inv.order.paymentMethod] ?? (inv.channel === 'online' ? 'Online payment' : ''),
      paymentMethod: inv.order.paymentMethod ?? (inv.channel === 'online' ? 'online' : null),
      orderNumber: inv.order.orderNumber,
      taxable: num(inv.taxableValue),
      cgst: num(inv.cgstAmount),
      sgst: num(inv.sgstAmount),
      total: num(inv.totalAmount),
      cancelled,
      items: inv.order.items,
    };
  });
  const live = rows.filter((r) => !r.cancelled);
  const add = (pick) => sumMoney(live.map(pick));
  const by = (key, list) => Object.fromEntries(list.map((k) => [k, sumMoney(live.filter((r) => (r[key] ?? 'none') === k).map((r) => r.total))]).filter(([, v]) => v));
  const products = new Map();
  for (const r of live) {
    for (const it of r.items) {
      const e = products.get(it.nameSnapshot) ?? { name: it.nameSnapshot, quantity: 0, paise: 0 };
      e.quantity += it.quantity;
      e.paise += Math.round(num(it.priceSnapshot) * 100) * it.quantity;
      products.set(it.nameSnapshot, e);
    }
  }
  return {
    from, to,
    label: periodLabel(from, to),
    channels: chs,
    channelsText: chs.map((c) => CHANNEL_TEXT[c]).join(', '),
    totals: {
      invoices: live.length,
      sarees: live.reduce((t, r) => t + r.items.reduce((s, it) => s + it.quantity, 0), 0),
      taxableValue: add((r) => r.taxable),
      cgst: add((r) => r.cgst),
      sgst: add((r) => r.sgst),
      total: add((r) => r.total),
      cancelled: rows.length - live.length,
      gstRatePercent: env.company.gstRatePercent,
    },
    byChannel: by('channel', CHANNELS),
    byPayment: by('paymentMethod', ['cash', 'upi', 'card', 'online', 'none']),
    withoutInvoice: { sales: without.length, amount: sumMoney(without.map((o) => num(o.total))) },
    rows,
    products: [...products.values()].map((p) => ({ name: p.name, quantity: p.quantity, total: p.paise / 100, average: Math.round(p.paise / p.quantity) / 100 })).sort((a, b) => b.total - a.total),
  };
}

const fileStem = (d) => `Nandam-Sales-summary-${d.from}${d.to !== d.from ? `-to-${d.to}` : ''}`;

// What the app shows before sharing.
export async function summary(query) {
  const d = await summaryData(query);
  return {
    summary: {
      from: d.from, to: d.to, label: d.label, channels: d.channels, channelsText: d.channelsText,
      totals: d.totals, byChannel: d.byChannel, byPayment: d.byPayment, withoutInvoice: d.withoutInvoice,
      empty: d.rows.length === 0,
      pdfName: `${fileStem(d)}.pdf`,
      csvName: `${fileStem(d).replace('Sales-summary', 'Invoices')}.csv`,
    },
  };
}

export async function summaryPdf(query) {
  const d = await summaryData(query);
  return { buffer: await renderSummaryPdf(d, await shopDetails()), fileName: `${fileStem(d)}.pdf` };
}

// One row per invoice for Excel or Google Sheets (6.6). UTF-8 with a BOM so Excel
// reads ₹ and Telugu names correctly; amounts as plain numbers.
export async function summaryCsv(query) {
  const d = await summaryData(query);
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    // Text that starts like a formula (= + - @, a tab or a return; e.g. a website customer's
    // name) would run as one in Excel: a leading apostrophe keeps it plain text. Numbers stay.
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Invoice number', 'Date', 'Customer', 'Mobile', 'Channel', 'Paid by', 'Order number', 'Taxable value', 'CGST', 'SGST', 'Total', 'Status'];
  const lines = d.rows.map((r) => [r.number, r.ymd, r.customer, r.mobile, CHANNEL_TEXT[r.channel], r.paidBy, r.orderNumber, r.taxable.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.total.toFixed(2), r.cancelled ? 'Cancelled' : 'Valid']);
  const text = `﻿${[head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n')}\r\n`;
  return { buffer: Buffer.from(text, 'utf8'), fileName: `${fileStem(d).replace('Sales-summary', 'Invoices')}.csv` };
}
