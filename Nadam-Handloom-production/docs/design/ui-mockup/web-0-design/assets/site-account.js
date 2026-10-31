/* Website mock-up: checkout, payment, order confirmation, sign in, create account, SMS code,
   PIN, and My account (orders with DTDC tracking, profile, addresses). The customer, the
   addresses and the orders are SAMPLE data; the sarees in them are real. */
(function () {
  'use strict';
  var NH = window.NH, Site = window.Site, D = Site.D, icon = NH.icon, esc = Site.esc, rs = Site.rs, num = Site.num;
  var STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Odisha', 'Delhi', 'Gujarat', 'West Bengal', 'Other'];
  function fmtDate(iso, opts) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' }); }
  function addrText(a) { return esc(a.line1) + ', ' + esc(a.line2) + ', ' + esc(a.city) + ', ' + esc(a.state) + ' ' + esc(a.pin); }
  function artPage(img, quote, sub, form) {
    return '<div class="auth"><div class="art"><img src="' + img + '" alt=""><div class="q"><span class="eyebrow" style="color:#E9C987">Nandam Handlooms</span><b>' + quote + '</b><span style="opacity:.85">' + sub + '</span></div></div><div class="form"><div>' + form + '</div></div></div>';
  }
  var ART = function () { return D.site['hero-craft-story'] || D.site['hero-pattu-zari-border']; };
  function phoneField(id, val) { return '<div class="field"><label for="' + id + '">Mobile number</label><div class="input-group"><span class="pre">+91</span><input class="input" id="' + id + '" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="10-digit mobile" value="' + (val || '') + '"></div></div>'; }
  function pinField(id, label) { return '<div class="field"><span class="label" id="' + id + '-l">' + label + '</span><div class="pin-row" role="group" aria-labelledby="' + id + '-l">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<input class="input" id="' + id + '-' + i + '" inputmode="numeric" maxlength="1" aria-label="Digit ' + (i + 1) + '" autocomplete="off">'; }).join('') + '</div></div>'; }
  function bindPins(el) {
    el.querySelectorAll('.pin-row').forEach(function (row) {
      var ins = row.querySelectorAll('input');
      ins.forEach(function (inp, i) {
        inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && ins[i + 1]) ins[i + 1].focus(); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) ins[i - 1].focus(); });
        inp.addEventListener('paste', function (e) { var t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault(); t.split('').forEach(function (d, k) { if (ins[k]) ins[k].value = d; }); (ins[t.length] || ins[5]).focus(); });
      });
    });
  }
  function pinVal(el, id) { var v = ''; el.querySelectorAll('input[id^="' + id + '-"]').forEach(function (i) { v += i.value; }); return v; }
  function busy(btn, ms, fn) { btn.classList.add('is-loading'); setTimeout(function () { btn.classList.remove('is-loading'); fn(); }, ms || 700); }
  function err(el, sel, text) { var f = el.querySelector(sel); if (!f) return; var box = f.closest('.field'); box.classList.add('has-error'); var old = box.querySelector('.field-error'); if (old) old.remove(); box.insertAdjacentHTML('beforeend', '<p class="field-error">' + icon('alertc', 'ico-sm') + esc(text) + '</p>'); }
  function clearErr(el) { el.querySelectorAll('.has-error').forEach(function (f) { f.classList.remove('has-error'); }); el.querySelectorAll('.field-error').forEach(function (e) { e.remove(); }); }

  /* ================= Sign in, create account, code, PIN ================= */
  Site.page('signin', function (r, st) {
    var next = r.q.next || 'account';
    return {
      title: 'Sign in', handles: st === 'error' || st === 'popup',
      html: artPage(ART(), 'Welcome back', 'Sign in to check out faster and follow your orders.',
        '<span class="eyebrow">My account</span><h1>Sign in</h1><form data-f class="field" style="gap:1.1rem">' + phoneField('si-phone', st === 'error' ? '98765 43210'.replace(' ', '') : '') + pinField('si-pin', '6-digit PIN') +
        (st === 'error' ? '<div class="alert alert-bad">' + icon('alertc') + '<div><b>Wrong PIN</b>4 tries left. After 5 wrong tries, sign-in pauses for 15 minutes.</div></div>' : '') +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button><a class="link" style="justify-self:center" href="#/forgot">Forgot PIN?</a></form>' +
        '<p class="switch">New here? <a href="#/register?next=' + encodeURIComponent(next) + '">Create an account</a></p><p class="note" style="justify-content:center">' + icon('info', 'ico-sm') + 'Sample: any 10-digit mobile and any 6 digits sign you in.</p>'),
      mount: function (el) {
        bindPins(el);
        el.querySelector('[data-f]').addEventListener('submit', function (e) {
          e.preventDefault(); clearErr(el); var ph = el.querySelector('#si-phone').value.replace(/\D/g, ''), pin = pinVal(el, 'si-pin');
          if (ph.length !== 10) return err(el, '#si-phone', 'Enter your 10-digit mobile number.');
          if (pin.length !== 6) return err(el, '#si-pin-0', 'Enter your 6-digit PIN.');
          busy(e.submitter || el.querySelector('[type=submit]'), 800, function () { NH.setFlag('signedIn', true); Site.toast('Signed in. Welcome back, Priya.'); Site.go(next); });
        });
        if (st === 'popup') Site.confirm({ icon: 'lock', title: 'Sign in paused for safety', text: 'Too many wrong PINs. Try again in 15 minutes, or reset your PIN with an SMS code.', actions: [{ label: 'Reset my PIN', kind: 'btn-primary', fn: function () { Site.go('forgot'); } }, { label: 'OK' }] });
      }
    };
  });
  Site.page('register', function (r, st) {
    return {
      title: 'Create account',
      html: artPage(D.site['hero-kalamkari-border'] || ART(), 'Woven in Mangalagiri, delivered to you', 'An account keeps your addresses and orders in one place.',
        '<span class="eyebrow">New customer</span><h1>Create your account</h1><form data-f style="display:grid;gap:1rem"><div class="grid-2"><div class="field"><label for="rg-f">First name</label><input class="input" id="rg-f" autocomplete="given-name"></div><div class="field"><label for="rg-l">Last name</label><input class="input" id="rg-l" autocomplete="family-name"></div></div>' + phoneField('rg-p') +
        '<div class="grid-2"><div class="field"><label for="rg-s">State</label><select class="select" id="rg-s">' + STATES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label for="rg-pin">Pincode</label><input class="input" id="rg-pin" inputmode="numeric" maxlength="6" autocomplete="postal-code"></div></div>' +
        '<label class="check"><input type="checkbox" id="rg-ok" checked><span>Send me order updates by SMS</span></label><button class="btn btn-primary btn-lg btn-block" type="submit">Send SMS code</button></form><p class="switch">Already have an account? <a href="#/signin">Sign in</a></p>'),
      mount: function (el) {
        el.querySelector('[data-f]').addEventListener('submit', function (e) {
          e.preventDefault(); clearErr(el);
          if (!el.querySelector('#rg-f').value.trim()) return err(el, '#rg-f', 'Enter your first name.');
          if (el.querySelector('#rg-p').value.replace(/\D/g, '').length !== 10) return err(el, '#rg-p', 'Enter a 10-digit mobile number.');
          if (!/^\d{6}$/.test(el.querySelector('#rg-pin').value)) return err(el, '#rg-pin', 'Enter a 6-digit pincode.');
          busy(el.querySelector('[type=submit]'), 800, function () { Site.go('otp?m=' + el.querySelector('#rg-p').value.replace(/\D/g, '').slice(-4)); });
        });
      }
    };
  });
  Site.page('otp', function (r, st) {
    var m = r.q.m || '3210';
    return {
      title: 'SMS code', handles: st === 'error',
      html: artPage(ART(), 'Almost there', 'We sent a 6-digit code to your mobile.',
        '<span class="eyebrow">Step 2 of 3</span><h1>Enter the SMS code</h1><p class="muted">Sent to +91 ••••••' + esc(m) + '. <a class="link" href="#/register">Change number</a></p><form data-f style="display:grid;gap:1.1rem">' + pinField('otp', 'SMS code') +
        (st === 'error' ? '<div class="alert alert-bad">' + icon('alertc') + '<div><b>That code is not right</b>Check the SMS and try again. Codes work for 10 minutes.</div></div>' : '') +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">Verify</button><p class="muted" style="text-align:center;font-size:.9rem" data-resend>Resend code in <b class="tnum" data-sec>60</b>s</p></form><p class="note" style="justify-content:center">' + icon('info', 'ico-sm') + 'Sample code: 123456</p>'),
      mount: function (el) {
        bindPins(el); var s = 60, box = el.querySelector('[data-resend]');
        (function tick() { Site.after(function () { s--; if (s <= 0) { box.innerHTML = '<button type="button" class="btn btn-sm" data-again>' + icon('refresh', 'ico-sm') + 'Resend code</button>'; box.querySelector('[data-again]').addEventListener('click', function () { Site.toast('New code sent (sample)'); s = 60; box.innerHTML = 'Resend code in <b class="tnum" data-sec>60</b>s'; tick(); }); return; } var b = el.querySelector('[data-sec]'); if (b) b.textContent = s; tick(); }, 1000); })();
        el.querySelector('[data-f]').addEventListener('submit', function (e) { e.preventDefault(); clearErr(el); var v = pinVal(el, 'otp'); if (v.length !== 6) return err(el, '#otp-0', 'Enter all 6 digits.'); busy(el.querySelector('[type=submit]'), 700, function () { if (v !== '123456') return err(el, '#otp-0', 'That code is not right. Sample code: 123456.'); Site.go('pin'); }); });
      }
    };
  });
  Site.page('pin', function (r, st) {
    return {
      title: 'Choose your PIN',
      html: artPage(ART(), 'One last step', 'Your PIN signs you in on this and other devices.',
        '<span class="eyebrow">Step 3 of 3</span><h1>Choose a 6-digit PIN</h1><form data-f style="display:grid;gap:1.1rem">' + pinField('p1', 'New PIN') + '<p class="field-hint" data-strength>Avoid 123456, 000000 or your birth year.</p>' + pinField('p2', 'Type it again') +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button></form>'),
      mount: function (el) {
        bindPins(el);
        el.addEventListener('input', function () { var v = pinVal(el, 'p1'), h = el.querySelector('[data-strength]'); if (v.length < 6) { h.textContent = 'Avoid 123456, 000000 or your birth year.'; h.style.color = ''; return; } var weak = /^(\d)\1+$/.test(v) || '0123456789'.indexOf(v) >= 0 || '9876543210'.indexOf(v) >= 0; h.textContent = weak ? 'Too easy to guess. Choose another.' : 'Good PIN.'; h.style.color = weak ? 'var(--bad)' : 'var(--ok)'; });
        el.querySelector('[data-f]').addEventListener('submit', function (e) {
          e.preventDefault(); clearErr(el); var a = pinVal(el, 'p1'), b = pinVal(el, 'p2');
          if (a.length !== 6) return err(el, '#p1-0', 'Enter 6 digits.'); if (/^(\d)\1+$/.test(a) || '0123456789'.indexOf(a) >= 0) return err(el, '#p1-0', 'Too easy to guess. Choose another.'); if (a !== b) return err(el, '#p2-0', 'The two PINs don’t match.');
          busy(el.querySelector('[type=submit]'), 900, function () { NH.setFlag('signedIn', true); Site.toast('Account created. Welcome!'); Site.go(Site.bagCount() ? 'checkout' : 'account'); });
        });
      }
    };
  });
  Site.page('forgot', function (r, st) {
    var step = r.q.s || '1';
    var forms = {
      '1': '<span class="eyebrow">Forgot PIN</span><h1>Reset your PIN</h1><p class="muted">We will send an SMS code to your mobile.</p><form data-f style="display:grid;gap:1.1rem">' + phoneField('fg-p') + '<button class="btn btn-primary btn-lg btn-block" type="submit">Send SMS code</button></form>',
      '2': '<span class="eyebrow">Forgot PIN</span><h1>Enter the code and a new PIN</h1><form data-f style="display:grid;gap:1.1rem">' + pinField('fc', 'SMS code') + pinField('fn', 'New PIN') + '<button class="btn btn-primary btn-lg btn-block" type="submit">Save new PIN</button></form><p class="note" style="justify-content:center">' + icon('info', 'ico-sm') + 'Sample code: 123456</p>'
    };
    return {
      title: 'Forgot PIN',
      html: artPage(ART(), 'It happens', 'Reset your PIN with a code sent to your mobile.', forms[step] + '<p class="switch"><a href="#/signin">Back to sign in</a></p>'),
      mount: function (el) {
        bindPins(el);
        el.querySelector('[data-f]').addEventListener('submit', function (e) {
          e.preventDefault(); clearErr(el);
          if (step === '1') { if (el.querySelector('#fg-p').value.replace(/\D/g, '').length !== 10) return err(el, '#fg-p', 'Enter your 10-digit mobile number.'); return busy(el.querySelector('[type=submit]'), 700, function () { Site.go('forgot?s=2'); }); }
          if (pinVal(el, 'fc') !== '123456') return err(el, '#fc-0', 'That code is not right. Sample code: 123456.');
          if (pinVal(el, 'fn').length !== 6) return err(el, '#fn-0', 'Enter a 6-digit PIN.');
          busy(el.querySelector('[type=submit]'), 800, function () { NH.setFlag('signedIn', true); Site.toast('New PIN saved. You are signed in.'); Site.go('account'); });
        });
      }
    };
  });

  /* ================= Checkout ================= */
  Site.page('checkout', function (r, st) {
    var S = Site.S(), lines = Site.bagLines(), signed = Site.signedIn();
    if (!lines.length && st !== 'loading') {
      // A demo bag so the screen can always be seen
      var demo = Site.byNewest.filter(function (p) { return p.avail > 1; })[0] || Site.byNewest[0];
      Site.addToBag(demo.slug, 1, true); Site.addToBag(Site.byNewest[3].slug, 1, true); lines = Site.bagLines();
    }
    var step = !signed ? 1 : (r.q.step === 'pay' ? 3 : 2);
    var addrId = r.q.a || (S.addresses[0] && S.addresses[0].id);
    var steps = '<div class="steps" aria-label="Checkout steps">' + [['Sign in', 1], ['Address', 2], ['Pay', 3]].map(function (s, i) { return (i ? '<span class="bar"></span>' : '') + '<span class="' + (step === s[1] ? 'on' : step > s[1] ? 'done' : '') + '"><i>' + (step > s[1] ? '✓' : s[1]) + '</i>' + s[0] + '</span>'; }).join('') + '</div>';
    var left;
    if (step === 1) {
      var cs = r.q.s || 'mobile';
      left = '<div class="card checkout-auth" style="display:grid;gap:1.1rem">' + Site.authStep(cs).replace('<h1>', '<h2 style="font-size:1.8rem">').replace('</h1>', '</h2>').replace('<h2 style="font-size:1.8rem">Welcome</h2>', '<h2 style="font-size:1.8rem">Sign in to check out</h2>') + '</div>';
    } else if (step === 2) {
      left = '<div style="display:grid;gap:1.2rem"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><h2 style="font-size:1.7rem">Deliver to</h2><button type="button" class="btn btn-sm" data-newaddr>' + icon('plus', 'ico-sm') + 'New address</button></div>' +
        (st === 'empty' ? Site.empty('pin', 'No saved addresses', 'Add the address to deliver to.', '<button type="button" class="btn btn-primary" data-newaddr>Add address</button>') :
        '<div class="addr-list" role="radiogroup" aria-label="Address">' + S.addresses.map(function (a) { return '<label class="addr"><input type="radio" name="addr" value="' + a.id + '"' + (a.id === addrId ? ' checked' : '') + '><span><b>' + esc(a.name) + ' <span class="badge">' + esc(a.tag) + '</span></b><p>' + addrText(a) + '</p><p class="muted" style="font-size:.86rem">' + esc(a.phone) + '</p></span></label>'; }).join('') + '</div>') +
        '<div class="alert">' + icon('truck') + '<div><b>Free delivery by DTDC</b>Usually 4 to 7 days. You get the tracking number by SMS when it ships.</div></div>' +
        '<button type="button" class="btn btn-primary btn-lg" data-topay>Continue to payment ' + icon('arrow', 'ico-sm') + '</button></div>';
    } else {
      var a = S.addresses.filter(function (x) { return x.id === addrId; })[0] || S.addresses[0];
      left = '<div style="display:grid;gap:1.2rem">' + (st === 'warning' ? '<div class="alert alert-warn">' + icon('alert') + '<div><b>Price changed</b>Sample: the price of one saree changed since you added it. The total below is the new one.</div></div>' : '') +
        '<div class="card"><div style="display:flex;justify-content:space-between;gap:1rem"><div><span class="label">Delivering to</span><p style="margin-top:.3rem"><b>' + esc(a.name) + '</b><br>' + addrText(a) + '</p></div><a class="link" href="#/checkout">Change</a></div></div>' +
        '<div class="card"><h3 style="margin-bottom:.8rem">Payment</h3><p class="muted" style="margin-bottom:1rem">You pay on Razorpay’s secure page: UPI, cards, net banking or wallets. We hold your sarees for 15 minutes while you pay.</p><button type="button" class="btn btn-primary btn-lg btn-block" data-pay>' + icon('lock', 'ico-sm') + 'Pay ' + rs(Site.bagTotal()) + '</button><p class="note" style="justify-content:center;margin-top:.8rem">' + icon('shield', 'ico-sm') + 'Payments by Razorpay. We never see your card details.</p></div></div>';
    }
    var aside = '<aside class="card"><h3 style="margin-bottom:.6rem">Your order</h3>' + lines.map(function (l) { return '<div class="line" style="grid-template-columns:64px 1fr auto"><img src="' + l.p.img + '" alt="" style="width:64px"><div class="t"><b style="font-size:1rem">' + esc(l.p.name) + '</b><small>' + esc(l.p.sku) + (l.qty > 1 ? ' · ' + l.qty + ' pieces' : '') + '</small></div><b class="price">' + rs(l.qty * l.price) + '</b></div>'; }).join('') +
      '<div style="padding-top:.8rem"><div class="sumrow"><span>Subtotal</span><span class="price">' + rs(Site.bagTotal()) + '</span></div><div class="sumrow"><span>Delivery</span><span style="color:var(--ok);font-weight:700">Free</span></div><div class="sumrow total"><span>Total</span><span class="price">' + rs(Site.bagTotal()) + '</span></div><p class="note" style="margin-top:.4rem">Prices include taxes. The GST invoice is in My orders after delivery.</p></div></aside>';
    return {
      title: 'Checkout', handles: st === 'empty' || st === 'warning' || st === 'popup',
      html: '<div class="wrap"><div class="page-head">' + Site.crumbs([['Bag', 'bag'], ['Checkout']]) + '<h1>Checkout</h1></div>' + steps + '<div class="two-col"><div>' + left + '</div>' + aside + '</div><div style="height:clamp(48px,6vw,90px)"></div></div>',
      mount: function (el) {
        if (step === 1) Site.bindAuthStep(el.querySelector('.checkout-auth'), r.q.s || 'mobile', function () { Site.go('checkout'); }, function (x) { Site.go('checkout?s=' + x); });
        el.querySelectorAll('[data-newaddr]').forEach(function (b) { b.addEventListener('click', addressForm); });
        var tp = el.querySelector('[data-topay]'); tp && tp.addEventListener('click', function () { var c = el.querySelector('input[name=addr]:checked'); Site.go('checkout?step=pay&a=' + (c ? c.value : '')); });
        var pay = el.querySelector('[data-pay]'); pay && pay.addEventListener('click', function () { busy(pay, 600, razorpay); });
        if (st === 'popup' && pay) razorpay(); else if (st === 'popup') addressForm();
      }
    };
  });
  function addressForm(existing) {
    var a = existing && existing.id ? existing : { name: 'Priya Sharma', phone: '98765 43210', line1: '', line2: '', city: '', state: 'Telangana', pin: '', tag: 'Home' };
    Site.modal('<form data-af style="display:grid;gap:1rem"><h3>' + (existing && existing.id ? 'Edit address' : 'New address') + '</h3><div class="grid-2"><div class="field"><label for="af-n">Full name</label><input class="input" id="af-n" value="' + esc(a.name) + '"></div><div class="field"><label for="af-ph">Mobile</label><input class="input" id="af-ph" value="' + esc(a.phone) + '"></div></div>' +
      '<div class="field"><label for="af-1">House, building, street</label><input class="input" id="af-1" value="' + esc(a.line1) + '" placeholder="Flat 302, Sri Sai Residency"></div><div class="grid-2"><div class="field"><label for="af-2">Area</label><input class="input" id="af-2" value="' + esc(a.line2) + '"></div><div class="field"><label for="af-lm">Landmark <span class="muted">(optional)</span></label><input class="input" id="af-lm" value="' + esc(a.landmark || '') + '" placeholder="Near the temple"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="af-pin">Pincode</label><input class="input" id="af-pin" inputmode="numeric" maxlength="6" value="' + esc(a.pin) + '"></div><div class="field"><label for="af-c">City</label><input class="input" id="af-c" value="' + esc(a.city) + '"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="af-s">State</label><select class="select" id="af-s">' + STATES.map(function (s) { return '<option' + (s === a.state ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><span class="label">Save as</span><div style="display:flex;gap:.4rem">' + ['Home', 'Office', 'Other'].map(function (t) { return '<label class="chip"><input type="radio" name="af-t" value="' + t + '"' + (a.tag === t ? ' checked' : '') + ' style="accent-color:var(--accent)">' + t + '</label>'; }).join('') + '</div></div></div>' +
      '<div style="display:flex;gap:.6rem;justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn btn-primary">Save address</button></div></form>', false, function (el, close) {
      var apin = el.querySelector('#af-pin'); apin.addEventListener('input', function () { apin.value = apin.value.replace(/\D/g, '').slice(0, 6); var pc = apin.value.length === 6 && Site.pincode && Site.pincode(apin.value); if (pc) { el.querySelector('#af-c').value = pc.city; el.querySelector('#af-s').value = pc.state; } });
      el.querySelector('[data-af]').addEventListener('submit', function (e) {
        e.preventDefault(); clearErr(el);
        if (!el.querySelector('#af-1').value.trim()) return err(el, '#af-1', 'Enter the house and street.');
        if (!/^\d{6}$/.test(el.querySelector('#af-pin').value)) return err(el, '#af-pin', 'Enter a 6-digit pincode.');
        if (!el.querySelector('#af-c').value.trim()) return err(el, '#af-c', 'Enter the city.');
        var S = Site.S(), t = el.querySelector('input[name=af-t]:checked');
        var rec = { id: a.id || 'a' + Date.now().toString(36), name: el.querySelector('#af-n').value, phone: el.querySelector('#af-ph').value, line1: el.querySelector('#af-1').value, line2: el.querySelector('#af-2').value, landmark: el.querySelector('#af-lm').value, city: el.querySelector('#af-c').value, state: el.querySelector('#af-s').value, pin: el.querySelector('#af-pin').value, tag: t ? t.value : 'Home' };
        if (a.id) S.addresses = S.addresses.map(function (x) { return x.id === a.id ? rec : x; }); else S.addresses.unshift(rec);
        Site.save(); close(); Site.toast('Address saved'); Site.render();
      });
    });
  }
  Site.addressForm = addressForm;
  function razorpay() {
    var total = Site.bagTotal();
    Site.modal('<div class="paymodal"><div class="side"><div><span class="mock-tag">Stand-in for Razorpay</span><p style="margin-top:1rem;opacity:.8;font-size:.86rem">Nandam Handlooms</p><p class="amt">' + rs(total) + '</p></div><p style="font-size:.78rem;opacity:.7">Secured by Razorpay</p></div><div class="main"><b>Choose how to pay</b>' +
      [['upi', 'UPI', 'Google Pay, PhonePe, Paytm'], ['card', 'Card', 'Visa, Mastercard, RuPay'], ['bank', 'Net banking', 'All major banks']].map(function (o) { return '<button type="button" class="opt" data-ok>' + icon(o[0], 'ico-lg') + '<span><b>' + o[1] + '</b><br><small style="color:#5B6275">' + o[2] + '</small></span></button>'; }).join('') +
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem"><button type="button" class="btn btn-sm" data-fail style="--b-bg:#fff;--b-fg:#B3261E;--b-bd:#F0C7C3">Try a failed payment</button><button type="button" class="btn btn-sm" data-pend style="--b-bg:#fff;--b-fg:#1B1F2B;--b-bd:#DDE1EA">Try "still confirming"</button><button type="button" class="btn btn-sm" data-close style="--b-bg:#fff;--b-fg:#1B1F2B;--b-bd:#DDE1EA">Close</button></div></div></div>', true, function (el, close) {
      function finish(state) { close(); placeOrder(state); }
      el.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { b.style.opacity = '.6'; setTimeout(function () { finish('paid'); }, 900); }); });
      el.querySelector('[data-fail]').addEventListener('click', function () { finish('failed'); });
      el.querySelector('[data-pend]').addEventListener('click', function () { finish('pending'); });
    });
  }
  function placeOrder(state) {
    var S = Site.S(), no = 'NH5' + String(Date.now()).slice(-7);
    if (state !== 'failed') {
      S.orders.unshift({ no: no, date: new Date().toISOString().slice(0, 10), status: state === 'paid' ? 'paid' : 'pending', items: S.bag.map(function (l) { return { slug: l.slug, qty: l.qty }; }), addr: (S.addresses[0] || {}).id, awb: null, pay: 'UPI' });
      S.bag = []; Site.save(); Site.paintCount();
    }
    Site.go('confirmed?state=' + state + '&no=' + no);
  }

  /* ================= Order confirmation ================= */
  Site.page('confirmed', function (r, st) {
    var state = r.q.state || 'paid', S = Site.S();
    var o = S.orders.filter(function (x) { return x.no === r.q.no; })[0] || S.orders[0];
    var head = {
      paid: ['<svg class="success-mark" viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="48"/><path d="M32 54l14 14 27-30"/></svg>', 'Thank you, your order is placed', 'Order ' + (o ? o.no : '') + ' is paid. We will pack it at the store and send the DTDC tracking number by SMS.'],
      pending: ['<div class="empty" style="padding:0"><div class="ico-wrap" style="color:var(--warn)">' + icon('clock') + '</div></div>', 'Confirming your payment', 'Razorpay has not confirmed yet. This usually takes under a minute; this page checks again by itself. Please don’t pay twice.'],
      failed: ['<div class="empty" style="padding:0"><div class="ico-wrap" style="color:var(--bad)">' + icon('alertc') + '</div></div>', 'Payment didn’t go through', 'Nothing was taken from your account. Your sarees are kept for 15 minutes: try again, or choose another way to pay.']
    }[state] || [];
    var next = state === 'paid' ? (Site.pushCard ? Site.pushCard() : '') + '<div class="card" style="text-align:left;display:grid;gap:.8rem;width:min(560px,100%)"><b>What happens next</b>' + [['box', 'Packed at our store in Old Mangalagiri, usually the next day'], ['truck', 'Shipped by DTDC: tracking number by SMS'], ['home', 'Delivered free in 4 to 7 days'], ['doc', 'GST invoice in My orders']].map(function (x) { return '<div style="display:flex;gap:.7rem;align-items:center">' + icon(x[0], 'ico-sm') + '<span>' + x[1] + '</span></div>'; }).join('') + '</div>' : '';
    var acts = state === 'paid' ? '<a class="btn btn-primary btn-lg" href="#/order/' + (o ? o.no : '') + '">Track this order</a><a class="btn btn-lg" href="#/shop?sort=new">Continue shopping</a>' : state === 'pending' ? '<button type="button" class="btn btn-primary btn-lg" data-recheck>' + icon('refresh', 'ico-sm') + 'Check again</button><a class="btn btn-lg" href="#/orders">My orders</a>' : '<a class="btn btn-primary btn-lg" href="#/checkout?step=pay">Try again</a><a class="btn btn-lg" href="#/bag">Back to bag</a>';
    return {
      title: head[1], handles: true,
      html: '<div class="wrap narrow"><div class="empty" style="gap:1.2rem;padding-block:clamp(48px,8vw,100px)">' + head[0] + '<span class="eyebrow">' + (state === 'paid' ? 'Order ' + (o ? o.no : '') : state === 'pending' ? 'Payment pending' : 'Payment failed') + '</span><h1 style="font-size:clamp(2rem,4vw,3rem)">' + head[1] + '</h1><p class="lead">' + head[2] + '</p>' + next + '<div style="display:flex;gap:.7rem;flex-wrap:wrap;justify-content:center">' + acts + '</div><p class="note">' + icon('whatsapp', 'ico-sm') + 'Questions? WhatsApp ' + esc(D.store.phone) + '</p></div></div>',
      mount: function (el) {
        if (state === 'paid' && NH.opts.motion !== 'off') confetti();
        Site.bindPushCard && Site.bindPushCard(el);
        var rc = el.querySelector('[data-recheck]'); rc && rc.addEventListener('click', function () { busy(rc, 1200, function () { var S = Site.S(); if (S.orders[0]) S.orders[0].status = 'paid'; Site.save(); Site.go('confirmed?state=paid&no=' + (o ? o.no : '')); }); });
      }
    };
  });
  function confetti() {
    var box = document.createElement('div'); box.className = 'confetti'; var cols = ['var(--accent)', 'var(--gold)', '#E9C987', '#1E7A4A', '#C2185B'];
    for (var i = 0; i < 70; i++) { var c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length]; c.style.animationDelay = Math.random() * .8 + 's'; c.style.animationDuration = 2 + Math.random() * 1.6 + 's'; box.appendChild(c); }
    document.body.appendChild(box); setTimeout(function () { box.remove(); }, 4200);
  }

  /* ================= My account ================= */
  var STATUS = { pending: ['Payment pending', 'warn'], paid: ['Paid', 'info'], processing: ['Packing', 'info'], shipped: ['Shipped', 'gold'], delivered: ['Delivered', 'ok'], cancelled: ['Cancelled', 'bad'] };
  function orderTotal(o) { return o.items.reduce(function (n, i) { var p = Site.prod(i.slug); return n + (p ? Site.priceOf(p) * i.qty : 0); }, 0); }
  function needSignIn(name) {
    return { title: 'Sign in', html: '<div class="wrap narrow">' + Site.empty('lock', 'Sign in to see ' + name, 'Your orders, addresses and invoices are in your account.', '<div style="display:flex;gap:.6rem;flex-wrap:wrap;justify-content:center"><a class="btn btn-primary btn-lg" href="#/signin?next=' + (name === 'your orders' ? 'orders' : 'account') + '">Sign in</a><a class="btn btn-lg" href="#/register">Create account</a></div>') + '</div>' };
  }
  function acctNav(cur) {
    return '<nav aria-label="My account">' + [['account', 'user', 'Overview'], ['orders', 'box', 'My orders'], ['account?tab=profile', 'edit', 'Profile'], ['account?tab=addresses', 'pin', 'Addresses'], ['account?tab=security', 'lock', 'PIN and security'], ['wishlist', 'heart', 'Wishlist']].map(function (x) { return '<a href="#/' + x[0] + '" aria-current="' + (cur === x[0] ? 'page' : 'false') + '">' + icon(x[1], 'ico-sm') + x[2] + '</a>'; }).join('') + '<a href="#/home" data-signout>' + icon('logout', 'ico-sm') + 'Sign out</a></nav>';
  }
  function orderRow(o) {
    var s = STATUS[o.status] || [o.status, ''];
    return '<a class="ord reveal" href="#/order/' + o.no + '"><span class="pics">' + o.items.slice(0, 3).map(function (i) { var p = Site.prod(i.slug); return p ? '<img src="' + p.img + '" alt="">' : ''; }).join('') + '</span><span class="t"><b>Order ' + esc(o.no) + '</b><span class="muted" style="font-size:.88rem">' + fmtDate(o.date) + ' · ' + Site.plural(o.items.reduce(function (n, i) { return n + i.qty; }, 0), 'piece') + ' · ' + rs(orderTotal(o)) + '</span></span><span style="display:flex;gap:.6rem;align-items:center"><span class="badge badge-' + s[1] + '">' + s[0] + '</span>' + icon('right', 'ico-sm') + '</span></a>';
  }
  function shell(cur, inner, title) { return '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['My account', cur === 'account' ? null : 'account'], cur === 'account' ? null : [title]].filter(Boolean)) + '<h1>' + title + '</h1></div><div class="acct">' + acctNav(cur) + '<div>' + inner + '</div></div><div style="height:clamp(48px,6vw,90px)"></div></div>'; }
  function bindSignout(el) { var s = el.querySelector('[data-signout]'); s && s.addEventListener('click', function (e) { e.preventDefault(); NH.setFlag('signedIn', false); Site.toast('Signed out'); Site.go('home'); }); }

  Site.page('account', function (r, st) {
    if (!Site.signedIn()) return needSignIn('your account');
    var S = Site.S(), tab = r.q.tab || 'overview', u = S.user, inner, cur = tab === 'overview' ? 'account' : 'account?tab=' + tab;
    if (tab === 'profile') {
      inner = '<form class="card" data-prof style="display:grid;gap:1rem;max-width:640px"><div class="grid-2"><div class="field"><label for="pf-f">First name</label><input class="input" id="pf-f" value="' + esc(u.first) + '"></div><div class="field"><label for="pf-l">Last name</label><input class="input" id="pf-l" value="' + esc(u.last) + '"></div></div><div class="field"><label for="pf-p">Mobile</label><input class="input" id="pf-p" value="+91 ' + esc(u.phone) + '" disabled><p class="field-hint">To change your mobile, contact the store.</p></div><div class="grid-2"><div class="field"><label for="pf-s">State</label><select class="select" id="pf-s">' + STATES.map(function (s) { return '<option' + (s === u.state ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label for="pf-pin">Pincode</label><input class="input" id="pf-pin" value="' + esc(u.pin) + '"></div></div><div><button class="btn btn-primary" type="submit">Save changes</button></div></form>';
    } else if (tab === 'addresses') {
      inner = '<div style="display:grid;gap:1rem"><div><button type="button" class="btn" data-newaddr>' + icon('plus', 'ico-sm') + 'Add a new address</button></div>' + (S.addresses.length && st !== 'empty' ? S.addresses.map(function (a) { return '<div class="card" style="display:flex;gap:1rem;justify-content:space-between;flex-wrap:wrap"><div><b>' + esc(a.name) + '</b> <span class="badge">' + esc(a.tag) + '</span><p class="muted" style="margin-top:.3rem">' + addrText(a) + '<br>' + esc(a.phone) + '</p></div><div style="display:flex;gap:.4rem;align-items:flex-start"><button type="button" class="btn btn-sm" data-edit="' + a.id + '">' + icon('edit', 'ico-sm') + 'Edit</button><button type="button" class="btn btn-sm" data-del="' + a.id + '">' + icon('trash', 'ico-sm') + 'Delete</button></div></div>'; }).join('') : Site.empty('pin', 'No saved addresses', 'Add one to check out faster.')) + '</div>';
    } else if (tab === 'security') {
      inner = '<div class="card" style="display:grid;gap:1rem;max-width:640px"><h3>Change your PIN</h3><p class="muted">You will need your current PIN, or an SMS code if you forgot it.</p><div><a class="btn btn-primary" href="#/forgot">Change PIN</a></div><hr style="border:0;border-top:1px solid var(--line);width:100%"><h3>Signed-in devices</h3><p class="muted">Sign-in stays on for 30 days on this browser.</p><div class="table-wrap"><table class="table stack"><thead><tr><th>Device</th><th>Last used</th><th></th></tr></thead><tbody><tr><td data-label="Device">Chrome on Mac (this one)</td><td data-label="Last used">Now</td><td></td></tr><tr><td data-label="Device">Safari on iPhone</td><td data-label="Last used">12 Oct 2026</td><td><button type="button" class="btn btn-sm">Sign out</button></td></tr></tbody></table></div>' + Site.sample('Sample devices') + '</div>';
    } else {
      var last = S.orders[0];
      inner = (st === 'loading' ? '<div class="skel" style="height:120px"></div>' : '<div style="display:grid;gap:1.4rem"><div class="card-flat"><span class="eyebrow">Welcome back</span><h2 style="margin-top:.4rem">Namaste, ' + esc(u.first) + '</h2><p class="muted" style="margin-top:.4rem">+91 ' + esc(u.phone) + ' · ' + esc(u.state) + ' ' + Site.sample() + '</p></div>' +
        (last ? '<div><div class="sec-head" style="margin-bottom:.8rem"><div><h3>Latest order</h3></div><a class="link" href="#/orders">All orders</a></div>' + orderRow(last) + '</div>' : '') +
        '<div class="grid-2"><a class="card" href="#/account?tab=addresses" style="display:grid;gap:.4rem">' + icon('pin') + '<b>' + Site.plural(S.addresses.length, 'saved address', 'saved addresses') + '</b><span class="muted">Add, edit or delete</span></a><a class="card" href="#/wishlist" style="display:grid;gap:.4rem">' + icon('heart') + '<b>' + Site.plural(S.wish.length, 'saree') + ' saved</b><span class="muted">Your wishlist (planned)</span></a></div></div>');
    }
    var titles = { overview: 'My account', profile: 'Profile', addresses: 'Addresses', security: 'PIN and security' };
    return {
      title: titles[tab], handles: st === 'empty' || st === 'loading',
      html: shell(cur, inner, titles[tab]),
      mount: function (el) {
        bindSignout(el);
        var pf = el.querySelector('[data-prof]'); pf && pf.addEventListener('submit', function (e) { e.preventDefault(); var b = pf.querySelector('[type=submit]'); busy(b, 700, function () { S.user.first = el.querySelector('#pf-f').value; S.user.last = el.querySelector('#pf-l').value; S.user.state = el.querySelector('#pf-s').value; S.user.pin = el.querySelector('#pf-pin').value; Site.save(); Site.toast('Profile saved'); }); });
        el.querySelectorAll('[data-newaddr]').forEach(function (b) { b.addEventListener('click', function () { addressForm(); }); });
        el.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { addressForm(S.addresses.filter(function (a) { return a.id === b.dataset.edit; })[0]); }); });
        el.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { Site.confirm({ icon: 'trash', tone: 'bad', title: 'Delete this address?', text: 'Orders already placed keep their address.', actions: [{ label: 'Cancel' }, { label: 'Delete', kind: 'btn-primary', fn: function () { S.addresses = S.addresses.filter(function (a) { return a.id !== b.dataset.del; }); Site.save(); Site.render(); Site.toast('Address deleted'); } }] }); }); });
      }
    };
  });
  Site.page('orders', function (r, st) {
    if (!Site.signedIn()) return needSignIn('your orders');
    var S = Site.S(), list = st === 'empty' ? [] : S.orders;
    var inner = st === 'loading' ? '<div class="skel" style="height:90px;margin-bottom:12px"></div><div class="skel" style="height:90px"></div>' : st === 'error' ? Site.empty('wifioff', 'Couldn’t load your orders', 'Check your internet connection and try again.', '<button type="button" class="btn btn-primary" onclick="NHSite.setState(\'normal\')">Try again</button>') :
      list.length ? '<div style="display:grid;gap:.8rem">' + list.map(orderRow).join('') + '</div><p class="note" style="margin-top:1rem">' + icon('info', 'ico-sm') + 'Sample orders with real sarees.</p>' : Site.empty('box', 'No orders yet', 'When you buy a saree, it shows here with its tracking.', '<a class="btn btn-primary" href="#/shop?sort=new">Shop new in</a>');
    return { title: 'My orders', handles: st === 'empty' || st === 'loading' || st === 'error', html: shell('orders', inner, 'My orders'), mount: bindSignout };
  });
  Site.page('order', function (r, st) {
    if (!Site.signedIn()) return needSignIn('your orders');
    var S = Site.S(), o = S.orders.filter(function (x) { return x.no === r.arg; })[0];
    if (!o) return { title: 'Order', html: shell('orders', Site.empty('box', 'Order not found', 'Check the order number in your SMS.', '<a class="btn" href="#/orders">My orders</a>'), 'Order') };
    var a = S.addresses.filter(function (x) { return x.id === o.addr; })[0] || S.addresses[0];
    var steps = [['paid', 'Order placed and paid', fmtDate(o.date)], ['processing', 'Packed at the store', 'Old Mangalagiri'], ['shipped', 'Shipped by DTDC', o.awb ? 'Tracking ' + o.awb : 'Tracking number by SMS'], ['delivered', 'Delivered', o.status === 'delivered' ? 'Signed for at the door' : 'Usually 4 to 7 days after shipping']];
    var order = ['pending', 'paid', 'processing', 'shipped', 'delivered'], at = order.indexOf(o.status);
    var tl = '<div class="timeline">' + steps.map(function (s) { var k = order.indexOf(s[0]); var cls = k < at || (k === at && o.status === 'delivered') ? 'done' : k === at ? 'now' : ''; return '<div class="tl ' + cls + '"><span class="d">' + icon(cls === 'done' ? 'check' : s[0] === 'shipped' ? 'truck' : s[0] === 'delivered' ? 'home' : 'box', 'ico-sm') + '</span><div><b>' + s[1] + '</b><span>' + esc(s[2]) + '</span></div></div>'; }).join('') + '</div>';
    var s = STATUS[o.status] || [o.status, ''];
    var inner = '<div style="display:grid;gap:1.4rem"><div class="card" style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center"><div><span class="label">Placed ' + fmtDate(o.date) + ' · paid by ' + esc(o.pay) + '</span><h2 style="font-size:1.6rem;margin-top:.3rem">Order ' + esc(o.no) + '</h2></div><span class="badge badge-' + s[1] + '" style="font-size:.8rem">' + s[0] + '</span></div>' +
      '<div class="grid-2" style="align-items:start"><div class="card"><h3 style="margin-bottom:1rem">Tracking</h3>' + tl + (o.awb ? '<div class="alert">' + icon('truck') + '<div><b>DTDC tracking ' + esc(o.awb) + '</b>' + Site.sample('Sample number') + '</div></div><a class="btn btn-block" style="margin-top:.8rem" href="https://www.dtdc.in/tracking.asp" target="_blank" rel="noopener">Track on DTDC ' + icon('external', 'ico-sm') + '</a>' : '<p class="note">' + icon('info', 'ico-sm') + 'The DTDC tracking number shows here once it ships.</p>') + '</div>' +
      '<div style="display:grid;gap:1rem"><div class="card"><h3 style="margin-bottom:.6rem">Sarees</h3>' + o.items.map(function (i) { var p = Site.prod(i.slug); return p ? '<div class="line" style="grid-template-columns:64px 1fr auto"><a href="#/p/' + p.slug + '"><img src="' + p.img + '" alt="" style="width:64px"></a><div class="t"><b style="font-size:1rem">' + esc(p.name) + '</b><small>' + esc(p.sku) + (i.qty > 1 ? ' · ' + i.qty + ' pieces' : '') + '</small></div><b class="price">' + rs(Site.priceOf(p) * i.qty) + '</b></div>' : ''; }).join('') +
      '<div class="sumrow total"><span>Total paid</span><span class="price">' + rs(orderTotal(o)) + '</span></div></div>' +
      '<div class="card"><h3 style="margin-bottom:.4rem">Delivering to</h3><p class="muted">' + (a ? '<b style="color:var(--ink)">' + esc(a.name) + '</b><br>' + addrText(a) : '') + '</p></div>' +
      '<div class="card" style="display:grid;gap:.6rem"><h3>Invoice and help</h3>' + (o.status === 'delivered' || o.status === 'shipped' ? '<button type="button" class="btn" data-inv>' + icon('download', 'ico-sm') + 'Download GST invoice (PDF)</button>' : '<p class="muted" style="font-size:.9rem">The invoice is ready once the order ships.</p>') + '<a class="btn" href="https://wa.me/917382968566" target="_blank" rel="noopener">' + icon('whatsapp', 'ico-sm') + 'Help on WhatsApp</a></div></div></div></div>';
    return { title: 'Order ' + o.no, html: shell('orders', inner, 'Order details'), mount: function (el) { bindSignout(el); var iv = el.querySelector('[data-inv]'); iv && iv.addEventListener('click', function () { busy(iv, 900, function () { Site.toast('Sample: the GST invoice PDF would download here.'); }); }); } };
  });
})();
