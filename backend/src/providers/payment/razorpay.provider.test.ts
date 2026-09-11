import { createHmac } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';

// Only KEY_SECRET is set (not KEY_ID) — verifyPaymentSignature only needs the
// secret, and this avoids constructing a real Razorpay SDK client in tests.
process.env.RAZORPAY_KEY_SECRET = 'test_secret_value';

const { RazorpayPaymentProvider } = await import('./razorpay.provider');

describe('RazorpayPaymentProvider.verifyPaymentSignature', () => {
  let provider: InstanceType<typeof RazorpayPaymentProvider>;

  beforeEach(() => {
    provider = new RazorpayPaymentProvider();
  });

  it('accepts a correctly computed HMAC signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'test_secret_value').update(`${orderId}|${paymentId}`).digest('hex');

    expect(provider.verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'test_secret_value').update(`${orderId}|${paymentId}`).digest('hex');

    expect(
      provider.verifyPaymentSignature({ orderId, paymentId: 'pay_DIFFERENT', signature })
    ).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', 'wrong_secret').update(`${orderId}|${paymentId}`).digest('hex');

    expect(provider.verifyPaymentSignature({ orderId, paymentId, signature })).toBe(false);
  });

  it('reports as not configured when only the secret (no key id) is present', () => {
    expect(provider.isConfigured()).toBe(false);
  });
});
