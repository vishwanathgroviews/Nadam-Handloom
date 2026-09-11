import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  VerifySignatureInput,
} from './payment.provider';

export class RazorpayPaymentProvider implements PaymentProvider {
  private client: Razorpay | null;

  constructor() {
    this.client =
      env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
        ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
        : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!this.client) throw new Error('Razorpay is not configured');
    const order = await this.client.orders.create({
      amount: Math.round(input.amount * 100), // paise
      currency: input.currency,
      receipt: input.receipt,
    });
    return { providerOrderId: order.id, amount: input.amount, currency: input.currency };
  }

  verifyPaymentSignature({ orderId, paymentId, signature }: VerifySignatureInput): boolean {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return expected === signature;
  }

  isWebhookConfigured(): boolean {
    return Boolean(env.RAZORPAY_WEBHOOK_SECRET);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
    const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    // Same length is required before timingSafeEqual — a length mismatch
    // would otherwise throw instead of just failing the comparison.
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  }
}
