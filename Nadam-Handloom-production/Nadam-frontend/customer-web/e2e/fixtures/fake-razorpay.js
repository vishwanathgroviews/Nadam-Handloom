/* A stand-in for Razorpay's checkout.js, for the browser tests only (w6.e2e.cjs serves it in
   place of https://checkout.razorpay.com/v1/checkout.js). Its window "pays" through the test
   server's stand-in (POST /api/v2/payments/fake/pay, which exists only with
   PAYMENT_PROVIDER=fake) and answers the page exactly as Razorpay's window does. */
(function () {
  function Razorpay(options) {
    this.options = options;
    this.handlers = {};
    window.__rzpLast = options;
    window.__rzpOpened = (window.__rzpOpened || 0) + 1;
  }
  Razorpay.prototype.on = function (name, fn) { this.handlers[name] = fn; };
  Razorpay.prototype.open = function () {
    var self = this;
    var o = this.options;
    var box = document.createElement('div');
    box.id = 'rzp-test';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Razorpay test window');
    box.style.cssText = 'position:fixed;inset:auto 16px 16px auto;z-index:2147483647;background:#fff;color:#111;border:2px dashed #B79A2B;padding:14px;display:grid;gap:8px;font:600 13px/1.4 system-ui;max-width:300px';
    var t = document.createElement('p');
    t.textContent = o.name + ' · ₹' + (o.amount / 100) + ' · ' + o.order_id;
    box.appendChild(t);
    function post(status) {
      return fetch('/api/v2/payments/fake/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: o.order_id, status: status, method: 'upi' }) }).then(function (r) { return r.json(); });
    }
    function button(label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.onclick = fn;
      box.appendChild(b);
    }
    button('Pay (test)', function () { post('captured').then(function (r) { box.remove(); o.handler(r.receipt); }); });
    button('Fail (test)', function () {
      post('failed').then(function () { if (self.handlers['payment.failed']) self.handlers['payment.failed']({ error: { description: 'Your bank declined the payment (test)' } }); });
    });
    // Paid, but the phone lost the connection: the page never hears back.
    button('Lose connection (test)', function () { post('captured').then(function (r) { window.__rzpLost = r.payment; box.remove(); }); });
    button('Close (test)', function () { box.remove(); if (o.modal && o.modal.ondismiss) o.modal.ondismiss(); });
    document.body.appendChild(box);
  };
  window.Razorpay = Razorpay;
}());
