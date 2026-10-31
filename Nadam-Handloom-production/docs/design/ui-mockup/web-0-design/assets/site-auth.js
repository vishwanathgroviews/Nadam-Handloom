/* Website mock-up, module W1: customer sign-in and account (plan: docs/modules/web-01-sign-in.md).
   Sign in = mobile + SMS code (no PIN); a new customer completes a short profile (name, email,
   pincode → city and state); 30-day sign-in. My account: profile and picture, change mobile,
   addresses, notifications (Firebase web push), signed-in devices, delete account (7 days to
   cancel). Loaded after site-account.js, so these pages replace the older PIN screens.
   SAMPLE behaviour: code 123456; 98765 43210 is an existing customer (Priya); 90000 00001 has
   asked to delete her account; any other 10-digit mobile is a new customer. */
(function () {
  'use strict';
  var NH = window.NH, Site = window.Site, D = Site.D, icon = NH.icon, esc = Site.esc;
  var CODE = '123456', KNOWN = '9876543210', DELETING = '9000000001';
  var CODE_TTL = 600, RESEND = 60, TRIES = 3;
  // Sample pincodes (real ones). The real site loads India's full list (about 19,000).
  var PINS = {
    '500034': ['Banjara Hills', 'Hyderabad', 'Telangana'], '500081': ['Madhapur', 'Hyderabad', 'Telangana'], '500001': ['Hyderabad GPO', 'Hyderabad', 'Telangana'],
    '522503': ['Mangalagiri', 'Mangalagiri', 'Andhra Pradesh'], '522001': ['Guntur', 'Guntur', 'Andhra Pradesh'], '520001': ['Vijayawada', 'Vijayawada', 'Andhra Pradesh'],
    '530001': ['Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh'], '517501': ['Tirupati', 'Tirupati', 'Andhra Pradesh'], '524001': ['Nellore', 'Nellore', 'Andhra Pradesh'],
    '560001': ['Bengaluru GPO', 'Bengaluru', 'Karnataka'], '600001': ['Chennai GPO', 'Chennai', 'Tamil Nadu'], '400001': ['Mumbai GPO', 'Mumbai', 'Maharashtra'],
    '411001': ['Pune City', 'Pune', 'Maharashtra'], '110001': ['Connaught Place', 'New Delhi', 'Delhi'], '700001': ['Kolkata GPO', 'Kolkata', 'West Bengal'],
    '380001': ['Ahmedabad GPO', 'Ahmedabad', 'Gujarat'], '682001': ['Kochi', 'Kochi', 'Kerala'], '751001': ['Bhubaneswar', 'Bhubaneswar', 'Odisha']
  };
  var STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Odisha', 'Delhi', 'Gujarat', 'West Bengal', 'Other'];
  Site.pincode = function (pin) { var p = PINS[pin]; return p ? { area: p[0], city: p[1], state: p[2] } : null; };

  // The sign-in in progress (this page only; the real site keeps the step key on the server).
  var flow = { mobile: '', sentAt: 0, tries: TRIES, next: 'account' };
  function S() { return Site.S(); }
  function user() { var u = S().user; if (!u.name) { u.name = (u.first || 'Priya') + ' ' + (u.last || 'Sharma'); u.email = u.email || 'priya.sharma@example.com'; u.city = u.city || 'Hyderabad'; u.dob = u.dob || ''; u.anniversary = u.anniversary || ''; u.language = u.language || 'English'; u.optIn = u.optIn !== false; u.notify = u.notify || { orderPush: true, orderEmail: true, newPush: true, newEmail: false, offerPush: false, offerEmail: true }; u.devices = u.devices || [['Chrome on Mac', 'This browser · now', true], ['Safari on iPhone', 'Last used 12 Oct 2026'], ['Chrome on Android', 'Last used 2 Oct 2026']]; Site.save(); } return u; }
  function fmtMobile(m) { return m.slice(0, 5) + ' ' + m.slice(5); }
  function busy(btn, ms, fn) { btn.classList.add('is-loading'); setTimeout(function () { btn.classList.remove('is-loading'); fn(); }, ms || 700); }
  function fieldErr(el, sel, text) { var f = el.querySelector(sel); if (!f) return; var box = f.closest('.field'); box.classList.add('has-error'); var old = box.querySelector('.field-error'); if (old) old.remove(); box.insertAdjacentHTML('beforeend', '<p class="field-error" role="alert">' + icon('alertc', 'ico-sm') + esc(text) + '</p>'); var inp = box.querySelector('input'); inp && inp.focus(); }
  function clearErr(el) { el.querySelectorAll('.has-error').forEach(function (f) { f.classList.remove('has-error'); }); el.querySelectorAll('.field-error').forEach(function (e) { e.remove(); }); }
  function art(img, quote, sub, form, step) {
    return '<div class="auth"><div class="art"><img src="' + img + '" alt=""><div class="q"><span class="eyebrow" style="color:#E9C987">Nandam Handlooms</span><b>' + quote + '</b><span style="opacity:.85">' + sub + '</span></div></div><div class="form"><div>' +
      (step ? '<div class="auth-steps" aria-label="Step ' + step[0] + ' of ' + step[1] + '">' + Array.apply(null, Array(step[1])).map(function (_, i) { return '<i class="' + (i < step[0] ? 'on' : '') + '"></i>'; }).join('') + '</div>' : '') + form + '</div></div></div>';
  }
  var IMG = function (k) { return D.site[k] || D.site['hero-craft-story']; };
  function mobileField(id, val) { return '<div class="field"><label for="' + id + '">Mobile number</label><div class="input-group"><span class="pre">+91</span><input class="input" id="' + id + '" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="11" placeholder="10-digit mobile number" value="' + esc(val || '') + '"></div></div>'; }
  function codeField(id) { return '<div class="field"><span class="label" id="' + id + '-l">6-digit code</span><div class="pin-row otp-row" role="group" aria-labelledby="' + id + '-l">' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<input class="input" id="' + id + '-' + i + '" inputmode="numeric" maxlength="1" aria-label="Digit ' + (i + 1) + '"' + (i === 0 ? ' autocomplete="one-time-code"' : ' autocomplete="off"') + '>'; }).join('') + '</div></div>'; }
  function bindCode(el, onFull) {
    el.querySelectorAll('.otp-row').forEach(function (row) {
      var ins = row.querySelectorAll('input');
      function full() { var v = ''; ins.forEach(function (i) { v += i.value; }); if (v.length === 6) onFull && onFull(v); }
      ins.forEach(function (inp, i) {
        inp.addEventListener('input', function () { var d = inp.value.replace(/\D/g, ''); if (d.length > 1) { d.slice(0, 6).split('').forEach(function (c, k) { if (ins[k]) ins[k].value = c; }); (ins[Math.min(5, d.length)] || ins[5]).focus(); full(); return; } inp.value = d.slice(-1); if (inp.value && ins[i + 1]) ins[i + 1].focus(); full(); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) ins[i - 1].focus(); });
        inp.addEventListener('paste', function (e) { var t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return; e.preventDefault(); t.split('').forEach(function (d, k) { if (ins[k]) ins[k].value = d; }); (ins[t.length] || ins[5]).focus(); full(); });
      });
    });
  }
  function codeVal(el, id) { var v = ''; el.querySelectorAll('input[id^="' + id + '-"]').forEach(function (i) { v += i.value; }); return v; }
  function clean(m) { return String(m || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''); }
  function signedIn(msg) { NH.setFlag('signedIn', true); user(); Site.toast(msg); }
  function deletionBanner() { var u = user(); if (!u.deleteAt) return ''; return '<div class="alert alert-warn" style="margin-bottom:1.2rem">' + icon('alert') + '<div><b>Your account will be deleted on ' + new Date(u.deleteAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) + '</b>Your profile and addresses go then; orders and invoices stay for tax. <button type="button" class="btn btn-sm" data-keep style="margin-top:.6rem">Keep my account</button></div></div>'; }
  function bindKeep(el) { var k = el.querySelector('[data-keep]'); k && k.addEventListener('click', function () { user().deleteAt = null; Site.save(); Site.toast('Your account is kept. Nothing was deleted.'); Site.render(); }); }

  /* The three steps, shared by the sign-in page and checkout. */
  Site.authStep = function (step, opts) {
    opts = opts || {};
    if (step === 'code') {
      var left = Math.max(0, RESEND - Math.floor((Date.now() - flow.sentAt) / 1000));
      return '<span class="eyebrow">Step 2 of ' + (opts.known === false ? 3 : 2) + '</span><h1>Enter the code</h1><p class="muted">We sent a 6-digit code by SMS to <b style="color:var(--ink)">+91 ' + esc(fmtMobile(flow.mobile || '98765 43210'.replace(' ', ''))) + '</b>. <a class="link" href="#/signin" data-change>Change</a></p>' +
        '<form data-code style="display:grid;gap:1.1rem" novalidate>' + codeField('c') + (opts.error ? '<div class="alert alert-bad" role="alert">' + icon('alertc') + '<div><b>' + opts.error[0] + '</b>' + opts.error[1] + '</div></div>' : '') +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">Verify and continue</button><p class="muted" style="text-align:center;font-size:.9rem" data-resend>' + (left ? 'Resend the code in <b class="tnum" data-sec>' + left + '</b>s' : '<button type="button" class="btn btn-sm" data-again>' + icon('refresh', 'ico-sm') + 'Resend the code</button>') + '</p></form>' +
        '<p class="note" style="justify-content:center">' + icon('info', 'ico-sm') + 'Sample code: 123456. On Android it fills in by itself.</p>';
    }
    if (step === 'profile') {
      return '<span class="eyebrow">Step 3 of 3 · New here</span><h1>Complete your profile</h1><p class="muted">Once only. We use these to deliver your orders and to send offers you choose.</p>' +
        '<form data-prof style="display:grid;gap:1rem" novalidate><div class="field"><label for="p-name">Full name</label><input class="input" id="p-name" autocomplete="name" placeholder="As on your delivery"></div>' +
        '<div class="field"><label for="p-email">Email</label><input class="input" id="p-email" type="email" autocomplete="email" placeholder="you@example.com"><p class="field-hint">Order confirmations and invoices come here.</p></div>' +
        '<div class="grid-2"><div class="field"><label for="p-pin">Pincode</label><input class="input" id="p-pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="6 digits"><p class="field-hint" data-pinhint>City and state fill in from it.</p></div>' +
        '<div class="field"><label for="p-city">City</label><input class="input" id="p-city" autocomplete="address-level2"></div></div><div class="field"><label for="p-state">State</label><select class="select" id="p-state"><option value="">Choose…</option>' + STATES.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div>' +
        '<label class="check"><input type="checkbox" id="p-opt"><span>Send me new arrivals and festive offers by email and notifications. You can change this any time.</span></label>' +
        '<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0" data-trap>' +
        '<button class="btn btn-primary btn-lg btn-block" type="submit">Create my account</button><p class="note">' + icon('shield', 'ico-sm') + 'We ask only what we need. You can see, change or delete your details in My account.</p></form>';
    }
    return '<span class="eyebrow">Sign in or create an account</span><h1>Welcome</h1><p class="muted">Enter your mobile number. We’ll text you a code: no password to remember.</p>' +
      '<form data-mob style="display:grid;gap:1.1rem" novalidate>' + mobileField('m', opts.mobile) + (opts.error ? '<div class="alert alert-warn" role="alert">' + icon('alert') + '<div><b>' + opts.error[0] + '</b>' + opts.error[1] + '</div></div>' : '') +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0" data-trap>' +
      '<button class="btn btn-primary btn-lg btn-block" type="submit">Send code</button><p class="note" style="justify-content:center;text-align:center">By continuing you agree to our terms and privacy policy.</p></form>' +
      '<div class="card-flat" style="display:grid;gap:.4rem;font-size:.88rem"><b>' + icon('info', 'ico-sm') + ' Try the mock-up</b><span class="muted">98765 43210: existing customer (Priya) · 90000 00001: account being deleted · any other number: new customer. Code 123456.</span></div>';
  };
  // Wires a step inside `el`; done(next) is called once signed in.
  Site.bindAuthStep = function (el, step, done, goStep) {
    var mob = el.querySelector('[data-mob]');
    if (mob) mob.addEventListener('submit', function (e) {
      e.preventDefault(); clearErr(el);
      if (el.querySelector('[data-trap]').value) return;
      var m = clean(el.querySelector('#m').value);
      if (!/^[6-9]\d{9}$/.test(m)) return fieldErr(el, '#m', 'Enter a 10-digit Indian mobile number.');
      busy(mob.querySelector('[type=submit]'), 800, function () { flow.mobile = m; flow.sentAt = Date.now(); flow.tries = TRIES; goStep('code'); Site.toast('Code sent to +91 ' + fmtMobile(m) + ' (sample: 123456)'); });
    });
    var code = el.querySelector('[data-code]');
    if (code) {
      function check(v, btn) {
        clearErr(el);
        if (v.length !== 6) return fieldErr(el, '#c-0', 'Enter all 6 digits.');
        if ((Date.now() - flow.sentAt) / 1000 > CODE_TTL) return fieldErr(el, '#c-0', 'This code has expired. Get a new one.');
        busy(btn, 650, function () {
          if (v !== CODE) {
            flow.tries--;
            el.querySelectorAll('.otp-row input').forEach(function (i) { i.value = ''; });
            el.querySelector('.otp-row').classList.remove('shake'); void el.querySelector('.otp-row').offsetWidth; el.querySelector('.otp-row').classList.add('shake');
            if (flow.tries <= 0) return fieldErr(el, '#c-0', 'Too many wrong tries. Get a new code.');
            return fieldErr(el, '#c-0', 'That code isn’t right. ' + flow.tries + (flow.tries === 1 ? ' try' : ' tries') + ' left.');
          }
          if (flow.mobile === DELETING) { var u = user(); u.deleteAt = Date.now() + 5 * 864e5; Site.save(); signedIn('Signed in'); return done('account', true); }
          if (flow.mobile === KNOWN || flow.known) { signedIn('Welcome back, ' + user().name.split(' ')[0]); return done(); }
          goStep('profile');
        });
      }
      bindCode(el, function (v) { check(v, code.querySelector('[type=submit]')); });
      code.addEventListener('submit', function (e) { e.preventDefault(); check(codeVal(el, 'c'), code.querySelector('[type=submit]')); });
      var box = el.querySelector('[data-resend]');
      (function tick() { Site.after(function () { var s = el.querySelector('[data-sec]'); if (!s) return; var left = Math.max(0, RESEND - Math.floor((Date.now() - flow.sentAt) / 1000)); if (left <= 0) { box.innerHTML = '<button type="button" class="btn btn-sm" data-again>' + icon('refresh', 'ico-sm') + 'Resend the code</button>'; bindAgain(); return; } s.textContent = left; tick(); }, 1000); })();
      function bindAgain() { var a = el.querySelector('[data-again]'); a && a.addEventListener('click', function () { flow.sentAt = Date.now(); flow.tries = TRIES; Site.toast('New code sent (sample: 123456)'); goStep('code'); }); }
      bindAgain();
      var f = el.querySelector('#c-0'); f && setTimeout(function () { f.focus({ preventScroll: true }); }, 80);
    }
    var prof = el.querySelector('[data-prof]');
    if (prof) {
      var pin = el.querySelector('#p-pin'), hint = el.querySelector('[data-pinhint]');
      pin.addEventListener('input', function () {
        pin.value = pin.value.replace(/\D/g, '').slice(0, 6); if (pin.value.length < 6) { hint.textContent = 'City and state fill in from it.'; hint.style.color = ''; return; }
        var p = Site.pincode(pin.value);
        if (p) { el.querySelector('#p-city').value = p.city; el.querySelector('#p-state').value = p.state; hint.innerHTML = icon('check', 'ico-sm') + ' ' + esc(p.area + ', ' + p.city); hint.style.color = 'var(--ok)'; }
        else { hint.textContent = 'We couldn’t find this pincode. Check it, or type the city and state.'; hint.style.color = 'var(--warn)'; }
      });
      prof.addEventListener('submit', function (e) {
        e.preventDefault(); clearErr(el);
        var name = el.querySelector('#p-name').value.trim(), email = el.querySelector('#p-email').value.trim(), p = pin.value, city = el.querySelector('#p-city').value.trim(), st = el.querySelector('#p-state').value;
        if (name.length < 2) return fieldErr(el, '#p-name', 'Enter your full name.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fieldErr(el, '#p-email', 'Enter a valid email address, like you@example.com.');
        if (email.toLowerCase() === 'priya.sharma@example.com') return fieldErr(el, '#p-email', 'This email is on another account. Use a different one, or sign in with that mobile.');
        if (!/^\d{6}$/.test(p)) return fieldErr(el, '#p-pin', 'Enter your 6-digit pincode.');
        if (!city) return fieldErr(el, '#p-city', 'Enter your city.');
        if (!st) return fieldErr(el, '#p-state', 'Choose your state.');
        busy(prof.querySelector('[type=submit]'), 900, function () {
          var u = user(); u.name = name; u.email = email; u.phone = fmtMobile(flow.mobile || '9123456780'); u.pin = p; u.city = city; u.state = st; u.optIn = el.querySelector('#p-opt').checked; u.avatar = null; u.joined = new Date().toISOString().slice(0, 10); u.deleteAt = null;
          Site.save(); signedIn('Account created. Welcome, ' + name.split(' ')[0] + '!'); done();
        });
      });
    }
    var ch = el.querySelector('[data-change]'); ch && ch.addEventListener('click', function (e) { e.preventDefault(); goStep('mobile'); });
  };

  /* ================= Sign in page ================= */
  Site.page('signin', function (r, st) {
    if (r.q.next) flow.next = r.q.next;
    var step = r.q.step || 'mobile';
    if (st === 'loading') return { html: '<div class="wrap" style="padding-block:140px"><div class="skel" style="height:420px;max-width:440px;margin:auto"></div></div>', handles: true };
    if (r.q.demo === 'new' && !flow.mobile) { flow.mobile = '9123456780'; flow.sentAt = Date.now(); }
    if (step === 'code' && !flow.mobile) { flow.mobile = KNOWN; flow.sentAt = Date.now(); }
    var opts = {};
    if (step === 'code' && st === 'error') opts.error = ['That code isn’t right', '2 tries left. After 3 wrong tries you’ll need a new code.'];
    if (step === 'mobile' && st === 'warning') opts.error = ['Too many codes for this number', 'For your safety, try again in 42 minutes. Or contact the store.'];
    if (step === 'code') opts.known = flow.mobile === KNOWN ? true : false;
    var pics = { mobile: ['hero-craft-story', 'Woven in Mangalagiri, delivered to you', 'Sign in to check out faster and follow your orders.'], code: ['hero-pattu-zari-border', 'Almost there', 'One code and you’re in. You stay signed in for 30 days.'], profile: ['hero-kalamkari-border', 'Welcome to Nandam', 'A few details, once, and you’re ready to shop.'] }[step] || [];
    var stepNo = step === 'mobile' ? [1, 3] : step === 'code' ? [2, opts.known ? 2 : 3] : [3, 3];
    return {
      title: step === 'profile' ? 'Complete your profile' : 'Sign in', handles: st === 'error' || st === 'warning' || st === 'loading' || st === 'popup',
      html: art(IMG(pics[0]), pics[1], pics[2], Site.authStep(step, opts), stepNo),
      mount: function (el) {
        Site.bindAuthStep(el, step, function (next, deleting) { Site.go(deleting ? 'account' : (flow.next || 'account')); flow.next = 'account'; }, function (s) { Site.go('signin?step=' + s); });
        if (st === 'popup') Site.confirm({ icon: 'clock', tone: 'warn', title: 'Code sent a moment ago', text: 'You can ask for another code in 60 seconds. Codes can take up to a minute to arrive.', actions: [{ label: 'OK', kind: 'btn-primary' }] });
      }
    };
  });
  ['register', 'otp', 'pin', 'forgot'].forEach(function (n) { Site.page(n, function () { setTimeout(function () { history.replaceState(null, '', '#/signin'); Site.render(); }, 0); return { html: '', handles: true }; }); });

  /* ================= My account ================= */
  var TABS = [['overview', 'user', 'Overview'], ['profile', 'edit', 'Profile'], ['addresses', 'pin', 'Addresses'], ['notifications', 'spark', 'Notifications'], ['devices', 'laptop', 'Signed-in devices'], ['delete', 'trash', 'Delete account']];
  function nav(tab) {
    return '<nav aria-label="My account">' + TABS.map(function (t) { return '<a href="#/account' + (t[0] === 'overview' ? '' : '?tab=' + t[0]) + '" aria-current="' + (t[0] === tab ? 'page' : 'false') + '">' + icon(t[1], 'ico-sm') + t[2] + '</a>'; }).join('') +
      '<a href="#/orders">' + icon('box', 'ico-sm') + 'My orders</a><a href="#/wishlist">' + icon('heart', 'ico-sm') + 'Wishlist</a><a href="#/home" data-signout>' + icon('logout', 'ico-sm') + 'Sign out</a></nav>';
  }
  function avatar(u, size) { var s = size || 64; return '<span class="avatar" style="width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * .38) + 'px">' + (u.avatar ? '<img src="' + u.avatar + '" alt="">' : esc(u.name.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase())) + '</span>'; }
  function completeness(u) { var f = [u.name, u.email, u.phone, u.pin, u.city, u.state, u.avatar, u.dob, u.anniversary, u.language]; return Math.round(f.filter(Boolean).length / f.length * 100); }
  function toggle(id, on, label) { return '<label class="tgl"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span aria-hidden="true"></span><span class="sr-only">' + label + '</span></label>'; }
  function shell(tab, inner, title) {
    return '<div class="wrap"><div class="page-head">' + Site.crumbs([['Home', 'home'], ['My account', tab === 'overview' ? null : 'account'], tab === 'overview' ? null : [title]].filter(Boolean)) + '<h1>' + title + '</h1></div>' + deletionBanner() + '<div class="acct">' + nav(tab) + '<div>' + inner + '</div></div><div style="height:clamp(48px,6vw,90px)"></div></div>';
  }
  function pushStatus() { var p = 'Notification' in window ? Site.S().pushState || 'default' : 'unsupported'; return p; }
  Site.askPush = function (why, then) {
    // Stand-in for the browser's own permission prompt (the real one is drawn by Chrome or Safari).
    Site.modal('<div style="display:grid;gap:1rem"><span class="mock-tag" style="justify-self:start">Stand-in for the browser’s own prompt</span><div style="display:flex;gap:.8rem;align-items:flex-start"><img src="' + (D.site['brand-logo'] || '') + '" alt="" style="width:44px;height:44px;border-radius:50%"><div><b>nandamhandlooms.com wants to</b><p class="muted" style="margin-top:.2rem">' + icon('spark', 'ico-sm') + ' Show notifications</p></div></div><p class="muted" style="font-size:.88rem">' + esc(why) + '</p><div style="display:flex;gap:.6rem;justify-content:flex-end"><button type="button" class="btn" data-block>Block</button><button type="button" class="btn btn-primary" data-allow>Allow</button></div></div>', false, function (el, close) {
      el.querySelector('[data-allow]').addEventListener('click', function () { close(); Site.S().pushState = 'granted'; Site.save(); Site.toast('Notifications on for this browser'); then && then(true); });
      el.querySelector('[data-block]').addEventListener('click', function () { close(); Site.S().pushState = 'denied'; Site.save(); Site.toast('Notifications blocked. You can allow them later in the browser’s site settings.'); then && then(false); });
    });
  };

  Site.page('account', function (r, st) {
    if (!Site.signedIn()) return { title: 'Sign in', html: '<div class="wrap narrow">' + Site.empty('lock', 'Sign in to see your account', 'Your profile, addresses, orders and notifications are in your account.', '<a class="btn btn-primary btn-lg" href="#/signin?next=account">Sign in or create an account</a>') + '</div>' };
    var u = user(), tab = r.q.tab || 'overview', inner = '', S0 = S();
    if (st === 'loading') return { title: 'My account', handles: true, html: shell(tab, '<div class="skel" style="height:140px;margin-bottom:14px"></div><div class="skel" style="height:220px"></div>', 'My account') };
    if (tab === 'profile') {
      inner = '<form class="card" data-pf style="display:grid;gap:1.1rem;max-width:720px" novalidate><div style="display:flex;gap:1.1rem;align-items:center;flex-wrap:wrap">' + avatar(u, 84) + '<div style="display:grid;gap:.4rem"><b>Profile picture</b><div style="display:flex;gap:.5rem;flex-wrap:wrap"><label class="btn btn-sm" for="pf-pic">' + icon('plus', 'ico-sm') + (u.avatar ? 'Change' : 'Add a picture') + '</label><input id="pf-pic" type="file" accept="image/*" class="sr-only">' + (u.avatar ? '<button type="button" class="btn btn-sm btn-ghost" data-rmpic>Remove</button>' : '') + '</div><span class="field-hint">Made small and saved without location. Optional.</span></div></div>' +
        '<div class="grid-2"><div class="field"><label for="pf-n">Full name</label><input class="input" id="pf-n" value="' + esc(u.name) + '" autocomplete="name"></div><div class="field"><label for="pf-e">Email</label><input class="input" id="pf-e" type="email" value="' + esc(u.email) + '" autocomplete="email"></div></div>' +
        '<div class="field"><label for="pf-m">Mobile number</label><div class="input-group"><span class="pre">+91</span><input class="input" id="pf-m" value="' + esc(u.phone) + '" disabled><button type="button" class="btn btn-ghost" data-chmob>Change</button></div><p class="field-hint">Changing it needs a code sent to the new number.</p></div>' +
        '<div class="grid-2"><div class="field"><label for="pf-pin">Pincode</label><input class="input" id="pf-pin" inputmode="numeric" maxlength="6" value="' + esc(u.pin || '') + '"></div><div class="field"><label for="pf-c">City</label><input class="input" id="pf-c" value="' + esc(u.city || '') + '"></div></div>' +
        '<div class="grid-2"><div class="field"><label for="pf-s">State</label><select class="select" id="pf-s">' + STATES.map(function (s) { return '<option' + (s === u.state ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div><div class="field"><label for="pf-l">Preferred language</label><select class="select" id="pf-l">' + ['English', 'Telugu', 'Hindi'].map(function (s) { return '<option' + (s === u.language ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="grid-2"><div class="field"><label for="pf-dob">Date of birth <span class="muted">(optional)</span></label><input class="input" id="pf-dob" type="date" value="' + esc(u.dob || '') + '"><p class="field-hint">For a birthday surprise.</p></div><div class="field"><label for="pf-ann">Anniversary <span class="muted">(optional)</span></label><input class="input" id="pf-ann" type="date" value="' + esc(u.anniversary || '') + '"></div></div>' +
        '<div><button class="btn btn-primary" type="submit">Save changes</button></div></form>';
    } else if (tab === 'addresses') {
      inner = '<div style="display:grid;gap:1rem"><div><button type="button" class="btn" data-newaddr>' + icon('plus', 'ico-sm') + 'Add a new address</button></div>' + (S0.addresses.length && st !== 'empty' ? S0.addresses.map(function (a, i) { return '<div class="card" style="display:flex;gap:1rem;justify-content:space-between;flex-wrap:wrap"><div><b>' + esc(a.name) + '</b> <span class="badge">' + esc(a.tag) + '</span>' + (i === 0 ? ' <span class="badge badge-ok">Default</span>' : '') + '<p class="muted" style="margin-top:.3rem">' + esc(a.line1) + ', ' + esc(a.line2) + (a.landmark ? ' (near ' + esc(a.landmark) + ')' : '') + ', ' + esc(a.city) + ', ' + esc(a.state) + ' ' + esc(a.pin) + '<br>' + esc(a.phone) + '</p></div><div style="display:flex;gap:.4rem;align-items:flex-start;flex-wrap:wrap">' + (i ? '<button type="button" class="btn btn-sm" data-def="' + a.id + '">Make default</button>' : '') + '<button type="button" class="btn btn-sm" data-edit="' + a.id + '">' + icon('edit', 'ico-sm') + 'Edit</button><button type="button" class="btn btn-sm" data-del="' + a.id + '">' + icon('trash', 'ico-sm') + 'Delete</button></div></div>'; }).join('') : Site.empty('pin', 'No saved addresses', 'Add one to check out faster.')) + '</div>';
    } else if (tab === 'notifications') {
      var p = pushStatus(), n = u.notify;
      inner = '<div style="display:grid;gap:1.2rem;max-width:760px"><div class="card push-card" data-push="' + p + '">' + (p === 'granted' ? icon('check') + '<div><b>Notifications are on for this browser</b><p class="muted">We use Firebase to send them. Turn them off in your browser’s site settings.</p></div>' : p === 'denied' ? icon('alert') + '<div><b>Notifications are blocked on this browser</b><p class="muted">Allow them in your browser’s site settings (the lock icon next to the address), then come back.</p></div>' : icon('spark') + '<div><b>Get updates on this device</b><p class="muted">Order shipped, delivered, new arrivals: straight to this phone or laptop. On iPhone, first add the site to your Home Screen.</p><button type="button" class="btn btn-primary btn-sm" data-pushon style="margin-top:.7rem">Turn on notifications</button></div>') + '</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>What</th><th>Notification</th><th>Email</th><th>SMS</th></tr></thead><tbody>' +
        '<tr><td><b>Order updates</b><br><span class="muted" style="font-size:.84rem">Paid, shipped (with tracking), delivered</span></td><td>' + toggle('n-op', n.orderPush, 'Order updates by notification') + '</td><td>' + toggle('n-oe', n.orderEmail, 'Order updates by email') + '</td><td><span class="badge badge-ok">Always</span></td></tr>' +
        '<tr><td><b>New arrivals</b><br><span class="muted" style="font-size:.84rem">When new collections arrive</span></td><td>' + toggle('n-np', n.newPush, 'New arrivals by notification') + '</td><td>' + toggle('n-ne', n.newEmail, 'New arrivals by email') + '</td><td>—</td></tr>' +
        '<tr><td><b>Offers and festive sales</b><br><span class="muted" style="font-size:.84rem">Only if you want them</span></td><td>' + toggle('n-fp', n.offerPush, 'Offers by notification') + '</td><td>' + toggle('n-fe', n.offerEmail, 'Offers by email') + '</td><td>—</td></tr>' +
        '</tbody></table></div><p class="note">' + icon('info', 'ico-sm') + 'Order updates also go by SMS, so you never miss a delivery.</p></div>';
    } else if (tab === 'devices') {
      inner = '<div style="display:grid;gap:1rem;max-width:760px"><p class="muted">You stay signed in for 30 days on each device. Sign out of any you don’t recognise.</p><div class="table-wrap"><table class="table stack"><thead><tr><th>Device</th><th>Last used</th><th></th></tr></thead><tbody>' +
        u.devices.map(function (d, i) { return '<tr><td data-label="Device"><b>' + esc(d[0]) + '</b></td><td data-label="Last used">' + esc(d[1]) + '</td><td>' + (d[2] ? '<span class="badge badge-ok">This one</span>' : '<button type="button" class="btn btn-sm" data-out="' + i + '">Sign out</button>') + '</td></tr>'; }).join('') +
        '</tbody></table></div><div><button type="button" class="btn" data-outall>' + icon('logout', 'ico-sm') + 'Sign out of all devices</button></div>' + Site.sample('Sample devices') + '</div>';
    } else if (tab === 'delete') {
      inner = '<div class="card" style="display:grid;gap:1rem;max-width:680px"><h3>Delete my account</h3><ul class="muted" style="margin:0;padding-left:1.1rem;display:grid;gap:.4rem"><li>Your profile, picture, addresses and saved items are removed after <b>7 days</b>.</li><li>Changed your mind? Sign in within those 7 days and choose “Keep my account”.</li><li>Orders and GST invoices stay with the shop for tax records, without your contact details.</li><li>You can create a new account with the same mobile later.</li></ul>' +
        (u.deleteAt ? '<div class="alert alert-warn">' + icon('clock') + '<div><b>Requested</b>Deletion on ' + new Date(u.deleteAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) + '.</div></div>' : '<label class="check"><input type="checkbox" id="del-ok"><span>I understand. Delete my account in 7 days.</span></label><div><button type="button" class="btn" data-delreq style="--b-fg:var(--bad);--b-bd:var(--bad)">' + icon('trash', 'ico-sm') + 'Request deletion</button></div>') + '</div>';
    } else {
      var last = S0.orders[0], pc = completeness(u);
      inner = '<div style="display:grid;gap:1.4rem"><div class="card-flat" style="display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap">' + avatar(u, 72) + '<div style="flex:1;min-width:220px"><span class="eyebrow">Welcome back</span><h2 style="margin-top:.3rem">Namaste, ' + esc(u.name.split(' ')[0]) + '</h2><p class="muted" style="margin-top:.3rem">+91 ' + esc(u.phone) + ' · ' + esc(u.email) + ' · ' + esc(u.city || '') + ', ' + esc(u.state || '') + '</p></div></div>' +
        '<div class="card" style="display:grid;gap:.7rem"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap"><b>Your profile is ' + pc + '% complete</b><a class="link" href="#/account?tab=profile">Complete it</a></div><div class="progress"><i style="width:' + pc + '%"></i></div><span class="muted" style="font-size:.88rem">Add your birthday and anniversary for festive surprises' + (u.avatar ? '' : ', and a profile picture') + '.</span></div>' +
        (last ? '<div><div class="sec-head" style="margin-bottom:.8rem"><div><h3>Latest order</h3></div><a class="link" href="#/orders">All orders</a></div><a class="ord" href="#/order/' + last.no + '"><span class="pics">' + last.items.slice(0, 3).map(function (i) { var p = Site.prod(i.slug); return p ? '<img src="' + p.img + '" alt="">' : ''; }).join('') + '</span><span class="t"><b>Order ' + esc(last.no) + '</b><span class="muted" style="font-size:.88rem">' + esc(last.status) + '</span></span>' + icon('right', 'ico-sm') + '</a></div>' : '') +
        '<div class="grid-2"><a class="card" href="#/account?tab=addresses" style="display:grid;gap:.4rem">' + icon('pin') + '<b>' + S0.addresses.length + ' saved addresses</b><span class="muted">Add, edit, default</span></a><a class="card" href="#/account?tab=notifications" style="display:grid;gap:.4rem">' + icon('spark') + '<b>Notifications</b><span class="muted">' + (pushStatus() === 'granted' ? 'On for this browser' : 'Off on this browser') + '</span></a></div></div>';
    }
    var title = { overview: 'My account', profile: 'Profile', addresses: 'Addresses', notifications: 'Notifications', devices: 'Signed-in devices', delete: 'Delete account' }[tab] || 'My account';
    return {
      title: title, handles: st === 'empty' || st === 'loading' || st === 'popup',
      html: shell(tab, inner, title),
      mount: function (el) {
        bindKeep(el);
        var so = el.querySelector('[data-signout]'); so && so.addEventListener('click', function (e) { e.preventDefault(); NH.setFlag('signedIn', false); Site.toast('Signed out'); Site.go('home'); });
        var pf = el.querySelector('[data-pf]');
        if (pf) {
          el.querySelector('#pf-pic').addEventListener('change', function (e) { var f = e.target.files[0]; if (!f) return; if (!/^image\//.test(f.type)) return Site.toast('Choose a photo (JPEG or PNG).'); var rd = new FileReader(); rd.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), s = 256, k = Math.max(s / im.width, s / im.height); c.width = s; c.height = s; var g = c.getContext('2d'); g.drawImage(im, (s - im.width * k) / 2, (s - im.height * k) / 2, im.width * k, im.height * k); u.avatar = c.toDataURL('image/jpeg', .82); Site.save(); Site.render(); Site.toast('Picture saved (made 256 × 256)'); }; im.src = rd.result; }; rd.readAsDataURL(f); });
          var rm = el.querySelector('[data-rmpic]'); rm && rm.addEventListener('click', function () { u.avatar = null; Site.save(); Site.render(); Site.toast('Picture removed'); });
          var pin = el.querySelector('#pf-pin'); pin.addEventListener('input', function () { pin.value = pin.value.replace(/\D/g, '').slice(0, 6); var p = pin.value.length === 6 && Site.pincode(pin.value); if (p) { el.querySelector('#pf-c').value = p.city; el.querySelector('#pf-s').value = p.state; } });
          el.querySelector('[data-chmob]').addEventListener('click', changeMobile);
          pf.addEventListener('submit', function (e) {
            e.preventDefault(); clearErr(el);
            var nm = el.querySelector('#pf-n').value.trim(), em = el.querySelector('#pf-e').value.trim();
            if (nm.length < 2) return fieldErr(el, '#pf-n', 'Enter your full name.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return fieldErr(el, '#pf-e', 'Enter a valid email address.');
            busy(pf.querySelector('[type=submit]'), 700, function () { u.name = nm; u.email = em; u.pin = pin.value; u.city = el.querySelector('#pf-c').value; u.state = el.querySelector('#pf-s').value; u.language = el.querySelector('#pf-l').value; u.dob = el.querySelector('#pf-dob').value; u.anniversary = el.querySelector('#pf-ann').value; Site.save(); Site.toast('Profile saved'); });
          });
        }
        el.querySelectorAll('[data-newaddr]').forEach(function (b) { b.addEventListener('click', function () { Site.addressForm(); }); });
        el.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { Site.addressForm(S0.addresses.filter(function (a) { return a.id === b.dataset.edit; })[0]); }); });
        el.querySelectorAll('[data-def]').forEach(function (b) { b.addEventListener('click', function () { var a = S0.addresses.filter(function (x) { return x.id === b.dataset.def; })[0]; S0.addresses = [a].concat(S0.addresses.filter(function (x) { return x !== a; })); Site.save(); Site.render(); Site.toast('Default address changed'); }); });
        el.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { Site.confirm({ icon: 'trash', tone: 'bad', title: 'Delete this address?', text: 'Orders already placed keep their address.', actions: [{ label: 'Cancel' }, { label: 'Delete', kind: 'btn-primary', fn: function () { S0.addresses = S0.addresses.filter(function (a) { return a.id !== b.dataset.del; }); Site.save(); Site.render(); Site.toast('Address deleted'); } }] }); }); });
        var po = el.querySelector('[data-pushon]'); po && po.addEventListener('click', function () { Site.askPush('Order updates and new arrivals, sent by Nandam Handlooms. You can turn them off any time.', function () { Site.render(); }); });
        el.querySelectorAll('.tgl input').forEach(function (t) { t.addEventListener('change', function () { var map = { 'n-op': 'orderPush', 'n-oe': 'orderEmail', 'n-np': 'newPush', 'n-ne': 'newEmail', 'n-fp': 'offerPush', 'n-fe': 'offerEmail' }; u.notify[map[t.id]] = t.checked; Site.save(); Site.toast('Saved'); if (t.checked && /Push$/.test(map[t.id]) && pushStatus() !== 'granted') Site.askPush('To get these as notifications, allow them for this site.', function () { Site.render(); }); }); });
        el.querySelectorAll('[data-out]').forEach(function (b) { b.addEventListener('click', function () { u.devices.splice(+b.dataset.out, 1); Site.save(); Site.render(); Site.toast('Signed out of that device'); }); });
        var oa = el.querySelector('[data-outall]'); oa && oa.addEventListener('click', function () { Site.confirm({ icon: 'logout', title: 'Sign out of all devices?', text: 'Every phone and laptop, including this one, will need a new code to sign in.', actions: [{ label: 'Cancel' }, { label: 'Sign out everywhere', kind: 'btn-primary', fn: function () { NH.setFlag('signedIn', false); Site.toast('Signed out of all devices'); Site.go('signin'); } }] }); });
        var dr = el.querySelector('[data-delreq]'); dr && dr.addEventListener('click', function () { if (!el.querySelector('#del-ok').checked) return Site.toast('Tick the box to confirm first.'); Site.confirm({ icon: 'trash', tone: 'bad', title: 'Delete your account in 7 days?', text: 'You can still sign in and keep it until then.', actions: [{ label: 'Cancel' }, { label: 'Request deletion', kind: 'btn-primary', fn: function () { u.deleteAt = Date.now() + 7 * 864e5; Site.save(); Site.render(); Site.toast('Deletion requested. You have 7 days to change your mind.'); } }] }); });
        if (st === 'popup') changeMobile();
      }
    };
  });

  function changeMobile() {
    var stage = 'num', nm = '';
    function body() {
      return stage === 'num' ? '<form data-cm style="display:grid;gap:1rem"><h3>Change mobile number</h3><p class="muted">We’ll send a code to the new number. Your orders stay with your account.</p>' + mobileField('cm-m') + '<div style="display:flex;gap:.6rem;justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" type="submit">Send code</button></div></form>'
        : '<form data-cm style="display:grid;gap:1rem"><h3>Enter the code</h3><p class="muted">Sent to +91 ' + esc(fmtMobile(nm)) + '. Sample code 123456.</p>' + codeField('cm') + '<div style="display:flex;gap:.6rem;justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary" type="submit">Verify</button></div></form>';
    }
    Site.modal('<div data-cmbox>' + body() + '</div>', false, function (el, close) {
      function wire() {
        var f = el.querySelector('[data-cm]'); bindCode(el);
        f.addEventListener('submit', function (e) {
          e.preventDefault(); clearErr(el);
          if (stage === 'num') { var m = clean(el.querySelector('#cm-m').value); if (!/^[6-9]\d{9}$/.test(m)) return fieldErr(el, '#cm-m', 'Enter a 10-digit Indian mobile number.'); if (m === clean(user().phone)) return fieldErr(el, '#cm-m', 'That’s already your number.'); busy(f.querySelector('[type=submit]'), 700, function () { nm = m; stage = 'code'; el.querySelector('[data-cmbox]').innerHTML = body(); wire(); }); return; }
          if (codeVal(el, 'cm') !== CODE) return fieldErr(el, '#cm-0', 'That code isn’t right.');
          busy(f.querySelector('[type=submit]'), 700, function () { user().phone = fmtMobile(nm); Site.save(); close(); Site.render(); Site.toast('Mobile number changed'); });
        });
      }
      wire();
    });
  }

  /* After an order: offer order updates on this device (the right moment to ask). */
  Site.pushCard = function () {
    if (pushStatus() === 'granted') return '<div class="card push-card" style="text-align:left;width:min(560px,100%)">' + icon('check') + '<div><b>Order updates are on for this device</b><p class="muted">We’ll tell you when it ships and when it’s delivered.</p></div></div>';
    return '<div class="card push-card" style="text-align:left;width:min(560px,100%)" data-pcard>' + icon('spark') + '<div><b>Get updates about this order here?</b><p class="muted">Shipped, out for delivery, delivered: on this phone or laptop. You also get SMS.</p><div style="display:flex;gap:.5rem;margin-top:.7rem;flex-wrap:wrap"><button type="button" class="btn btn-primary btn-sm" data-pyes>Turn on</button><button type="button" class="btn btn-sm btn-ghost" data-pno>Not now</button></div></div></div>';
  };
  Site.bindPushCard = function (el) {
    var y = el.querySelector('[data-pyes]'); y && y.addEventListener('click', function () { Site.askPush('Updates about your order from Nandam Handlooms. You can turn them off any time.', function (ok) { var c = el.querySelector('[data-pcard]'); if (c && ok) c.outerHTML = Site.pushCard(); }); });
    var n = el.querySelector('[data-pno]'); n && n.addEventListener('click', function () { var c = el.querySelector('[data-pcard]'); c && c.remove(); });
  };
})();
