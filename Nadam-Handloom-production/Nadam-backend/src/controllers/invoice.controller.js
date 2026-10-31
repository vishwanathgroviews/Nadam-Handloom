// Invoices and the sales summary (Module 6). Owners and Staff open, share and print
// invoices (sell.use); money totals, the summary and corrections are Owners only (the
// routes check it).
import * as book from '../services/invoiceBook.service.js';
import * as summary from '../services/salesSummary.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};
const file = (fn, type) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {});
    res.set('Content-Type', type);
    res.set('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.set('Cache-Control', 'no-store');
    return res.send(out.buffer);
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx });

export const list = send((v, req) => book.listInvoices({ ...who(req), ...v }));
export const get = send((v, req) => book.getInvoice({ ...who(req), id: v.id }));
export const correct = send((v, req) => book.correctCustomer({ ...who(req), id: v.id, name: v.name, mobile: v.mobile }));
export const without = send((v) => book.salesWithoutInvoice(v));
export const makeSummary = send((v) => summary.summary(v));
export const summaryPdf = file((v) => summary.summaryPdf(v), 'application/pdf');
export const summaryCsv = file((v) => summary.summaryCsv(v), 'text/csv; charset=utf-8');
