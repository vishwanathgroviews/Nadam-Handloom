// Razorpay's payment window (W6). Its script is loaded only when Pay is pressed, and loaded
// again if it failed. Card and UPI details are typed into Razorpay's own window, never ours.
export const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const LOAD_MS = 20000;

let loading = null;

// Resolves with window.Razorpay. A failed or slow load is forgotten, so Pay can try again.
export function loadRazorpay({ src = SCRIPT_URL, timeoutMs = LOAD_MS } = {}) {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.dataset.rzp = '1';
    const fail = () => {
      clearTimeout(timer);
      el.remove();
      loading = null;
      reject(Object.assign(new Error('The payment window didn\'t load.'), { code: 'RAZORPAY_NOT_LOADED' }));
    };
    const timer = setTimeout(fail, timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else fail();
    };
    el.onerror = fail;
    document.head.appendChild(el);
  });
  return loading;
}

// Apps that open links in their own browser, where payment apps often can't be opened.
const IN_APP = [[/Instagram/i, 'Instagram'], [/FBAN|FBAV|FB_IAB/i, 'Facebook'], [/\bLine\//i, 'LINE'], [/Snapchat/i, 'Snapchat'], [/Twitter|TwitterAndroid/i, 'X'], [/LinkedInApp/i, 'LinkedIn'], [/Pinterest/i, 'Pinterest']];
export function inAppBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  for (const [re, name] of IN_APP) if (re.test(ua)) return name;
  return null;
}

// Opens the window for one payment request from our server (POST /checkout or /pay).
// on: { paid(receipt), failed(reason), closed() }. `closed` comes once, after the window shuts
// without a payment (closed by the customer, or its time ran out with the hold).
export function openRazorpay(Razorpay, rz, on, { color = '#8C1A44', logo } = {}) {
  let done = false;
  const rzp = new Razorpay({
    key: rz.keyId,
    order_id: rz.orderId,
    amount: rz.amount,
    currency: rz.currency,
    name: rz.name,
    description: rz.description,
    ...(logo ? { image: logo } : {}),
    prefill: rz.prefill,
    notes: rz.notes,
    theme: { color },
    timeout: rz.timeoutSeconds,
    remember_customer: false,
    retry: { enabled: true },
    modal: {
      confirm_close: true,
      escape: true,
      ondismiss: () => { if (!done) on.closed(); },
    },
    handler: (r) => {
      done = true;
      on.paid({ razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature });
    },
  });
  rzp.on('payment.failed', (r) => on.failed(r?.error?.description || 'Your bank declined the payment.'));
  rzp.open();
  return rzp;
}
