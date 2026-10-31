// /api/v2/shop/checkout and /api/v2/shop/orders (W6, W7): signed-in customers, their own orders.
// Never cached.
import * as checkout from '../../services/shop/checkout.service.js';
import * as orders from '../../services/shop/orders.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    res.set('Cache-Control', 'no-store');
    return res.json(out);
  } catch (err) {
    return next(err);
  }
};
const accountId = (req) => req.customer.accountId;

export const start = send((v, req) => checkout.checkout({ accountId: accountId(req), addressId: v.addressId, expect: v.expect, ctx: req.ctx }));
export const payAgain = send((v, req) => checkout.payAgain({ accountId: accountId(req), number: v.number }));
export const verify = send((v, req) => checkout.verify({ accountId: accountId(req), number: v.number, razorpayOrderId: v.razorpayOrderId, razorpayPaymentId: v.razorpayPaymentId, razorpaySignature: v.razorpaySignature, ctx: req.ctx }));
export const cancel = send((v, req) => checkout.cancelCheckout({ accountId: accountId(req), number: v.number, ctx: req.ctx }));
export const getOrder = send((v, req) => checkout.getOrder({ accountId: accountId(req), number: v.number }));
export const list = send((v, req) => orders.listOrders({ accountId: accountId(req), offset: v.offset }));
export const buyAgain = send((v, req) => orders.buyAgain({ accountId: accountId(req), number: v.number, ctx: req.ctx }));

// The invoice PDF (W7): a download for this customer only, never kept by a shared cache.
export async function invoice(req, res, next) {
  try {
    const { filename, pdf } = await orders.invoiceFile({ accountId: accountId(req), number: req.valid.number, ctx: req.ctx });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(pdf);
  } catch (err) {
    return next(err);
  }
}
