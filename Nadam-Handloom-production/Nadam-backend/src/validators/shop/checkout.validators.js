// Request shapes for checkout and payment (W6).
import { z } from 'zod';
import { PAYMENTS } from '../../config/constants.js';
import { slug } from './bag.validators.js';

const line = z.object({ slug, quantity: z.number().int().min(1).max(50), price: z.number().int().min(0).max(10_000_000) });

// `expect`: what the page showed when Pay was pressed (the total and each line).
export const checkoutBody = z.object({
  addressId: z.uuid('Choose a delivery address.'),
  expect: z.object({ amount: z.number().int().min(0), lines: z.array(line).min(1).max(PAYMENTS.MAX_LINES) }, { error: 'Check your order again.' }),
});

// My orders (W7): 20 at a time.
export const listQuery = z.object({ offset: z.coerce.number().int().min(0).max(10_000).default(0) });

export const numberParam = z.object({ number: z.string().trim().regex(/^NH\d{8}$/, 'We couldn\'t find this order.') });

export const verifyBody = z.object({
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/, 'This payment can\'t be checked.'),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, 'This payment can\'t be checked.'),
  razorpaySignature: z.string().regex(/^[a-fA-F0-9]{64}$/, 'This payment can\'t be checked.'),
});
