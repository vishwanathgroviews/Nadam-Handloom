// Razorpay's window (W6): the script loads only when asked, a failed load can be tried again,
// in-app browsers are recognised, and the window's answers reach the page in our own words.
import { describe, it, expect, beforeEach, vi } from 'vitest';

let rz;
beforeEach(async () => {
  vi.resetModules();
  delete window.Razorpay;
  document.head.querySelectorAll('script[data-rzp]').forEach((s) => s.remove());
  rz = await import('./razorpay.js');
});
const script = () => document.head.querySelector('script[data-rzp]');

describe('loading the script', () => {
  it('adds Razorpay\'s script once and answers window.Razorpay when it has loaded', async () => {
    const a = rz.loadRazorpay();
    const b = rz.loadRazorpay();
    expect(document.head.querySelectorAll('script[data-rzp]')).toHaveLength(1);
    expect(script().src).toBe('https://checkout.razorpay.com/v1/checkout.js');
    window.Razorpay = function Fake() {};
    script().onload();
    await expect(a).resolves.toBe(window.Razorpay);
    await expect(b).resolves.toBe(window.Razorpay);
    await expect(rz.loadRazorpay()).resolves.toBe(window.Razorpay); // already there: no new script
  });

  it('a failed load is forgotten, so Pay can try again', async () => {
    const a = rz.loadRazorpay();
    script().onerror();
    await expect(a).rejects.toMatchObject({ code: 'RAZORPAY_NOT_LOADED' });
    expect(script()).toBeNull();
    rz.loadRazorpay();
    expect(script()).not.toBeNull();
  });

  it('a load that never finishes ends after the time limit', async () => {
    vi.useFakeTimers();
    const a = rz.loadRazorpay({ timeoutMs: 1000 });
    vi.advanceTimersByTime(1001);
    await expect(a).rejects.toMatchObject({ code: 'RAZORPAY_NOT_LOADED' });
    vi.useRealTimers();
  });
});

describe('in-app browsers', () => {
  it('recognises Instagram, Facebook and others; Chrome and Safari are fine', () => {
    expect(rz.inAppBrowser('Mozilla/5.0 (iPhone) Instagram 310.0')).toBe('Instagram');
    expect(rz.inAppBrowser('Mozilla/5.0 (Linux; Android 14) [FBAN/EMA;FBLC/en_US]')).toBe('Facebook');
    expect(rz.inAppBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36')).toBeNull();
    expect(rz.inAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile/15E148 Safari/604.1')).toBeNull();
  });
});

describe('the window', () => {
  function FakeRazorpay(options) {
    FakeRazorpay.last = this;
    this.options = options;
    this.events = {};
    this.on = (name, fn) => { this.events[name] = fn; };
    this.open = vi.fn();
  }
  const request = { keyId: 'rzp_test_x', orderId: 'order_ABC', amount: 850000, currency: 'INR', name: 'Nandam Handlooms', description: 'Order NH12345678', prefill: { name: 'Priya', contact: '+919876543210', email: '' }, notes: { orderNumber: 'NH12345678' }, timeoutSeconds: 880 };

  it('opens with our payment request, the shop colour and the hold as its time limit', () => {
    rz.openRazorpay(FakeRazorpay, request, { paid: vi.fn(), failed: vi.fn(), closed: vi.fn() }, { color: '#8C1A44' });
    const o = FakeRazorpay.last.options;
    expect(o).toMatchObject({ key: 'rzp_test_x', order_id: 'order_ABC', amount: 850000, currency: 'INR', timeout: 880, theme: { color: '#8C1A44' }, remember_customer: false, prefill: request.prefill });
    expect(FakeRazorpay.last.open).toHaveBeenCalled();
  });

  it('paid: the receipt in our words, and closing afterwards is not "not completed"', () => {
    const on = { paid: vi.fn(), failed: vi.fn(), closed: vi.fn() };
    rz.openRazorpay(FakeRazorpay, request, on);
    FakeRazorpay.last.options.handler({ razorpay_order_id: 'order_ABC', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' });
    FakeRazorpay.last.options.modal.ondismiss();
    expect(on.paid).toHaveBeenCalledWith({ razorpayOrderId: 'order_ABC', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig' });
    expect(on.closed).not.toHaveBeenCalled();
  });

  it('a failed try, then the window closed', () => {
    const on = { paid: vi.fn(), failed: vi.fn(), closed: vi.fn() };
    rz.openRazorpay(FakeRazorpay, request, on);
    FakeRazorpay.last.events['payment.failed']({ error: { description: 'Your bank declined it' } });
    FakeRazorpay.last.options.modal.ondismiss();
    expect(on.failed).toHaveBeenCalledWith('Your bank declined it');
    expect(on.closed).toHaveBeenCalledTimes(1);
  });
});
