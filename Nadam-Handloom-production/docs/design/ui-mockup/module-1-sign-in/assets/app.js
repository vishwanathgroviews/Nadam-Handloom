/* Module 1 (Sign in): the clickable app.
   A small pretend backend in this file applies the real rules from the plan
   (PIN tries and locks, SMS code expiry and limits, trusted devices, 7-day
   sign-in), so every edge case can be tried in the browser. */
(function () {
  'use strict';
  var NH = window.NH;
  var EMBED = /[?&]embed=1/.test(location.search);

  /* ================= Pretend backend (sample data) ================= */
  var DEMO_KEY = 'nh-m1-demo';
  var MIN = 60000;
  function freshDemo() {
    return {
      accounts: {
        '9000000001': { name: 'Lakshmi', role: 'Owner', status: 'active', pin: '246810' },
        '9000000002': { name: 'Ravi', role: 'Staff', status: 'active', pin: '1357' },
        '9000000003': { name: 'Suresh', role: 'Staff', status: 'pending', pin: null },
        '9000000004': { name: 'Kiran', role: 'Staff', status: 'removed', pin: '802468' }
      },
      tries: {},
      trusted: { '9000000001': true, '9000000002': true },
      bio: { '9000000001': true },
      devices: {
        '9000000001': [
          { id: 'cur', current: true },
          { id: 'd2', name: 'Counter iPad', kind: 'tablet', os: 'iPadOS 18', last: '2 hours ago' },
          { id: 'd3', name: 'iPhone 12 (home)', kind: 'phone', os: 'iOS 17', last: '5 days ago' }
        ]
      },
      session: null,
      remembered: { number: '9000000001', name: 'Lakshmi' },
      otp: null, otpLog: {}, step: null, draft: null
    };
  }
  var demo = load();
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DEMO_KEY)); if (d && d.accounts) return d; } catch (e) { } return freshDemo(); }
  function save() { try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(demo)); } catch (e) { } }
  window.addEventListener('storage', function (e) { if (e.key === DEMO_KEY) demo = load(); });

  var now = function () { return Date.now(); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function flags() { return NH.flags(); }
  function lockMins(count) { return [15, 30, 60][Math.min(Math.max(count, 1), 3) - 1]; }
  function triesOf(n) { return demo.tries[n] || (demo.tries[n] = { fails: 0, lockCount: 0, lockedUntil: 0 }); }
  function bioOn(n) { return !!(n && flags().face && demo.bio[n]); }
  function deviceModel() { var f = flags(), tab = root && root.dataset.size === 'tablet'; return f.platform === 'ios' ? (tab ? 'iPad Air' : 'iPhone 15') : (tab ? 'Galaxy Tab S9' : 'Pixel 8'); }
  function deviceOs() { var f = flags(), tab = root && root.dataset.size === 'tablet'; return f.platform === 'ios' ? (tab ? 'iPadOS 18' : 'iOS 18') : 'Android 14'; }
  function bioName() { return flags().platform === 'ios' ? 'Face ID' : 'fingerprint'; }
  function BioName() { return flags().platform === 'ios' ? 'Face ID' : 'Fingerprint'; }

  function call(fn, ms) {
    return wait(flags().server ? 2600 : (ms || 650)).then(function () {   // the real app waits up to 30 s
      if (flags().offline) { var e = new Error('offline'); e.code = 'offline'; throw e; }
      if (flags().server) { var s = new Error('server'); s.code = 'server'; throw s; }   // nothing ran: no try counted
      var r = fn(); save(); return r;
    });
  }
  function startSession(n) {
    demo.session = { number: n, at: now() };
    var acc = demo.accounts[n];
    demo.remembered = { number: n, name: acc.name };
    var list = demo.devices[n] || (demo.devices[n] = []);
    if (!list.some(function (d) { return d.current; })) list.unshift({ id: 'cur', current: true });
    demo.trusted[n] = true;
  }
  var api = {
    login: function (n, pin) {
      return call(function () {
        var t = triesOf(n);
        if (t.lockedUntil > now()) return { locked: true };
        if (t.lockedUntil) { t.lockedUntil = 0; t.fails = 0; }        // lock over: 5 fresh tries
        var acc = demo.accounts[n];
        if (!acc || acc.status !== 'active' || acc.pin !== pin) {      // same answer for unknown numbers
          t.fails++;
          if (t.fails >= 5) { t.lockCount++; t.fails = 0; t.lockedUntil = now() + lockMins(t.lockCount) * MIN; return { locked: true }; }
          return { error: 'wrong', left: 5 - t.fails, nextLock: lockMins(t.lockCount + 1) };
        }
        demo.tries[n] = { fails: 0, lockCount: 0, lockedUntil: 0 };
        demo.remembered = { number: n, name: acc.name };
        var upgrade = pin.length === 4;
        if (!demo.trusted[n] || flags().newPhone) { demo.step = { number: n, purpose: 'device', after: upgrade ? 'upgrade' : 'home' }; return { next: 'newdevice' }; }
        if (upgrade) { demo.step = { number: n, purpose: 'upgrade', until: now() + 10 * MIN }; return { next: 'setpin?for=upgrade' }; }
        startSession(n); return { next: 'home' };
      }, 800);
    },
    bioLogin: function (n) {
      return call(function () {
        var acc = demo.accounts[n];
        if (!acc || acc.status !== 'active') return { error: 'removed' };
        startSession(n); return { next: 'home' };
      }, 500);
    },
    requestCode: function (n, purpose, force) {
      return call(function () {
        var log = (demo.otpLog[n] || []).filter(function (t) { return now() - t < 60 * MIN; });
        if (!force && log.length >= 5) return { error: 'too_many' };
        if (!force && demo.otp && demo.otp.number === n && now() - demo.otp.sentAt < MIN) return { error: 'wait', wait: MIN - (now() - demo.otp.sentAt) };
        var acc = demo.accounts[n];
        var ok = acc && (purpose === 'setup' ? (acc.status === 'pending' || acc.status === 'active') : acc.status === 'active');
        var code = ok ? String(Math.floor(100000 + Math.random() * 900000)) : null;
        log.push(now()); demo.otpLog[n] = log;
        demo.otp = { number: n, code: code, purpose: purpose, sentAt: now(), expiresAt: now() + MIN, tries: 0 };
        return { sent: !!code, code: code };
      }, 700);
    },
    verifyCode: function (code) {
      return call(function () {
        var o = demo.otp;
        if (!o) return { error: 'expired' };
        if (now() > o.expiresAt || o.tries >= 3) return { error: 'expired' };
        if (!o.code || code !== o.code) { o.tries++; return o.tries >= 3 ? { error: 'used' } : { error: 'wrong', left: 3 - o.tries }; }
        demo.otp = null;
        var n = o.number, acc = demo.accounts[n];
        if (o.purpose === 'setup') {
          if (acc.status === 'active') { demo.step = { number: n, purpose: 'reset', until: now() + 10 * MIN }; return { next: 'already' }; }
          demo.step = { number: n, purpose: 'setup', until: now() + 10 * MIN }; return { next: 'setpin?for=setup' };
        }
        if (o.purpose === 'forgot') { demo.step = { number: n, purpose: 'reset', until: now() + 10 * MIN }; return { next: 'setpin?for=reset' }; }
        // new phone check
        demo.trusted[n] = true;
        var after = demo.step && demo.step.after;
        if (after === 'upgrade') { demo.step = { number: n, purpose: 'upgrade', until: now() + 10 * MIN }; return { next: 'setpin?for=upgrade', trusted: true }; }
        startSession(n); return { next: 'home', trusted: true };
      }, 700);
    },
    setPin: function (pin) {
      return call(function () {
        var s = demo.step;
        if (!s || (s.until && now() > s.until)) return { error: 'step_expired' };
        var n = s.number, acc = demo.accounts[n];
        acc.pin = pin; demo.step = null;
        if (s.purpose === 'setup') { acc.status = 'active'; startSession(n); return { next: flags().face ? 'biosetup' : 'done' }; }
        if (s.purpose === 'reset') {
          demo.tries[n] = { fails: 0, lockCount: 0, lockedUntil: 0 };
          var list = demo.devices[n] || [], before = list.filter(function (d) { return !d.current; }).length;
          demo.devices[n] = list.filter(function (d) { return d.current; });
          startSession(n); demo.lastReset = { others: before }; return { next: 'resetdone' };
        }
        startSession(n); return { next: 'home', toast: 'PIN updated to 6 digits' };
      }, 800);
    },
    checkPin: function (pin) {
      return call(function () {
        var n = demo.session.number, t = triesOf(n), acc = demo.accounts[n];
        if (acc.pin === pin) { t.fails = 0; return { ok: true }; }
        t.fails++;
        if (t.fails >= 5) { t.lockCount++; t.fails = 0; t.lockedUntil = now() + lockMins(t.lockCount) * MIN; demo.session = null; return { locked: true }; }
        return { error: 'wrong', left: 5 - t.fails };
      }, 600);
    },
    changePin: function (pin, others) {
      return call(function () {
        var n = demo.session.number; demo.accounts[n].pin = pin;
        var removed = 0;
        if (others) { var list = demo.devices[n] || []; removed = list.filter(function (d) { return !d.current; }).length; demo.devices[n] = list.filter(function (d) { return d.current; }); }
        return { ok: true, removed: removed };
      }, 800);
    },
    signOutDevice: function (id) { return call(function () { var n = demo.session.number; demo.devices[n] = (demo.devices[n] || []).filter(function (d) { return d.id !== id; }); return { ok: true }; }, 600); },
    signOutOthers: function () { return call(function () { var n = demo.session.number, l = demo.devices[n] || [], c = l.filter(function (d) { return !d.current; }).length; demo.devices[n] = l.filter(function (d) { return d.current; }); return { ok: true, removed: c }; }, 700); },
    logout: function () { return wait(500).then(function () { demo.session = null; save(); }); }
  };

  /* ================= Helpers ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = String(n || ''); return n.length > 5 ? n.slice(0, 5) + ' ' + n.slice(5) : n; }
  function masked(n) { return '+91 ' + n.slice(0, 5) + ' •••' + n.slice(8); }
  function initials(name) { return String(name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function mmss(ms) { ms = Math.max(0, ms); var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function mobileError(d) { if (!d) return 'Enter your 10-digit mobile number.'; if (d.length !== 10) return 'Enter a 10-digit mobile number.'; if (!/^[6-9]/.test(d)) return 'Mobile numbers start with 6, 7, 8 or 9.'; return null; }
  function icon(n, c) { return NH.icon(n, c); }
  function alertBox(type, title, text, ic) {
    var map = { info: 'info', success: 'check', warning: 'alert', error: 'alertc' };
    return '<div class="alert alert-' + type + '" role="' + (type === 'error' ? 'alert' : 'status') + '">' + icon(ic || map[type]) + '<div>' + (title ? '<strong>' + title + '</strong>' : '') + (text ? '<p>' + text + '</p>' : '') + '</div></div>';
  }
  function topBar(title, back) { return '<div class="scr-top">' + (back ? '<button class="icon-btn" type="button" data-go="' + back + '" aria-label="Back">' + icon('back') + '</button>' : '<span style="width:12px"></span>') + '<h1>' + (title || '') + '</h1></div>'; }
  function stepsBar(n, total) { var b = ''; for (var i = 1; i <= total; i++) b += '<span class="' + (i <= n ? 'on' : '') + '"></span>'; return '<div class="steps" aria-label="Step ' + n + ' of ' + total + '"><div class="bars">' + b + '</div><small>Step ' + n + ' of ' + total + '</small></div>'; }
  function mobileField(id, value, err, hint) {
    return '<div class="field' + (err ? ' has-error' : '') + '"><label for="' + id + '">Mobile number</label>' +
      '<div class="input-group"><span class="prefix">+91</span><input class="input" id="' + id + '" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="11" placeholder="98765 43210" value="' + esc(fmt(value)) + '"' + (err ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '') + '></div>' +
      (err ? '<p class="field-error" id="' + id + '-err">' + icon('alertc', 'icon-sm') + esc(err) + '</p>' : (hint ? '<p class="field-hint">' + hint + '</p>' : '')) + '</div>';
  }
  function bindMobile(el, id, store, key, onValid) {
    var inp = el.querySelector('#' + id); if (!inp) return;
    inp.addEventListener('input', function () {
      var d = inp.value.replace(/\D/g, '').slice(0, 10); store[key] = d;
      var f = fmt(d); if (inp.value !== f) inp.value = f;
      onValid && onValid(!mobileError(d));
    });
  }
  function netAlert(e) {
    if (e && e.code === 'server') return alertBox('error', 'The server is taking too long', 'Nothing was lost and nothing was counted. Try again in a moment.', 'clock');
    return alertBox('warning', 'You\'re offline', 'This step needs internet. Your work on this phone is safe.', 'wifioff');
  }
  function netToast(e) { return e && e.code === 'server' ? 'The server didn\'t respond. Try again.' : 'You\'re offline. Try again when connected.'; }
  function successMark() { return '<div class="success-mark" aria-hidden="true"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="50"/><path d="M36 58l13 13 27-29"/></svg></div>'; }
  function pinRules(pin, number, current) {
    var full = pin.length === 6, r = [{ label: 'Exactly 6 digits', ok: full ? true : null }];
    r.push({ label: 'Not all the same digit (like 111111)', ok: full ? !/^(\d)\1{5}$/.test(pin) : null });
    r.push({ label: 'Not a straight run (like 123456 or 654321)', ok: full ? !('0123456789'.indexOf(pin) >= 0 || '9876543210'.indexOf(pin) >= 0) : null });
    r.push({ label: 'Not the last 6 digits of your mobile number', ok: full ? pin !== String(number).slice(-6) : null });
    if (current) r.push({ label: 'Different from your current PIN', ok: full ? pin !== current : null });
    return r;
  }
  function rulesList(rules) {
    return '<ul class="rules" aria-label="PIN rules">' + rules.map(function (r) {
      var cls = r.ok === true ? 'ok' : r.ok === false ? 'bad' : '', ic = r.ok === true ? 'check' : r.ok === false ? 'x' : 'more';
      return '<li class="' + cls + '">' + icon(ic) + r.label + '</li>';
    }).join('') + '</ul>';
  }

  /* ================= PIN and code inputs ================= */
  var activePad = null;
  function pinField(key, o) {
    var v = o.value || '', mode = NH.opts.pin, h = '<div class="pin-wrap' + (o.error ? ' is-error' : '') + '" data-pin="' + key + '">';
    if (o.label) h += '<div class="pin-label" id="' + key + '-lbl">' + o.label + '</div>';
    if (mode === 'a') {
      h += '<div class="boxes">';
      for (var i = 0; i < 6; i++) h += '<div class="box' + (i < v.length ? ' filled' : '') + (i === v.length ? ' cur' : '') + '">' + (i < v.length ? (o.show ? v[i] : '•') : '') + '</div>';
      h += '<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="6" aria-labelledby="' + key + '-lbl" value="' + esc(v) + '"' + (o.autofocus ? ' data-autofocus' : '') + '></div>';
    } else {
      h += '<div class="pin-dots' + (o.show ? ' show' : '') + '" role="img" aria-label="' + v.length + ' of 6 digits entered">';
      for (var j = 0; j < 6; j++) h += '<span class="' + (j < v.length ? 'on' : '') + '">' + (o.show && j < v.length ? v[j] : '') + '</span>';
      h += '</div>';
    }
    h += '<div class="pin-tools"><button type="button" class="icon-btn" data-eye aria-pressed="' + !!o.show + '">' + icon(o.show ? 'eyeoff' : 'eye', 'icon-sm') + (o.show ? 'Hide' : 'Show') + '</button>' + (o.tools || '') + '</div>';
    if (mode === 'b') {
      h += '<div class="keypad" role="group" aria-label="Number pad">';
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (d) { h += '<button type="button" data-k="' + d + '">' + d + '</button>'; });
      h += o.bio ? '<button type="button" class="k-ghost" data-k="bio" aria-label="Use ' + bioName() + '">' + icon(flags().platform === 'ios' ? 'faceid' : 'finger', 'icon-lg') + '</button>' : '<span class="k-empty"></span>';
      h += '<button type="button" data-k="0">0</button><button type="button" class="k-ghost" data-k="del" aria-label="Delete">' + icon('backspace', 'icon-lg') + '</button></div>';
    }
    return h + '</div>';
  }
  /* store[key] holds the digits; o: { max, onChange, onComplete, onBio, showKey } */
  function bindPin(el, key, store, o) {
    var wrap = el.querySelector('[data-pin="' + key + '"]'); if (!wrap) return;
    var max = o.max || 6;
    function refresh() {
      var v = store[key] || '', show = !!store[o.showKey];
      wrap.classList.remove('is-error');
      wrap.querySelectorAll('.box').forEach(function (b, i) { b.className = 'box' + (i < v.length ? ' filled' : '') + (i === v.length ? ' cur' : ''); b.textContent = i < v.length ? (show ? v[i] : '•') : ''; });
      var dots = wrap.querySelector('.pin-dots');
      if (dots) { dots.setAttribute('aria-label', v.length + ' of 6 digits entered'); dots.querySelectorAll('span').forEach(function (s, i) { s.className = i < v.length ? 'on' : ''; s.textContent = show && i < v.length ? v[i] : ''; }); }
      o.onChange && o.onChange(v);
      if (v.length === max) o.onComplete && o.onComplete(v);
    }
    function set(v) { store[key] = v.replace(/\D/g, '').slice(0, max); refresh(); }
    var inp = wrap.querySelector('.boxes input');
    if (inp) {
      inp.addEventListener('input', function () { var d = inp.value.replace(/\D/g, '').slice(0, max); inp.value = d; set(d); });
      if (inp.hasAttribute('data-autofocus') && !EMBED) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { } }, 350);
    }
    wrap.querySelectorAll('[data-k]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.k, v = store[key] || '';
        if (k === 'del') set(v.slice(0, -1)); else if (k === 'bio') o.onBio && o.onBio(); else if (v.length < max) set(v + k);
      });
    });
    var eye = wrap.querySelector('[data-eye]');
    eye && eye.addEventListener('click', function () {
      store[o.showKey] = !store[o.showKey];
      eye.setAttribute('aria-pressed', String(!!store[o.showKey]));
      eye.innerHTML = icon(store[o.showKey] ? 'eyeoff' : 'eye', 'icon-sm') + (store[o.showKey] ? 'Hide' : 'Show');
      var dots = wrap.querySelector('.pin-dots'); dots && dots.classList.toggle('show', !!store[o.showKey]);
      refresh();
    });
    if (NH.opts.pin === 'b') activePad = function (e) {
      if (/^\d$/.test(e.key)) { var v = store[key] || ''; if (v.length < max) set(v + e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { set((store[key] || '').slice(0, -1)); e.preventDefault(); }
    };
    return { set: set, error: function () { wrap.classList.remove('is-error'); void wrap.offsetWidth; wrap.classList.add('is-error'); } };
  }
  function otpField(v, error) {
    var h = '<div class="otp' + (error ? ' is-error' : '') + '"><div class="boxes">';
    for (var i = 0; i < 6; i++) h += '<div class="box' + (i < v.length ? ' filled' : '') + (i === v.length ? ' cur' : '') + '">' + (v[i] || '') + '</div>';
    return h + '<input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" aria-label="6-digit code" value="' + esc(v) + '"></div></div>';
  }
  function bindOtp(el, store, onComplete) {
    var wrap = el.querySelector('.otp'), inp = wrap && wrap.querySelector('input'); if (!inp) return {};
    function refresh() {
      var v = store.code || '';
      wrap.classList.remove('is-error');
      wrap.querySelectorAll('.box').forEach(function (b, i) { b.className = 'box' + (i < v.length ? ' filled' : '') + (i === v.length ? ' cur' : ''); b.textContent = v[i] || ''; });
      if (v.length === 6) onComplete(v);
    }
    inp.addEventListener('input', function () { var d = inp.value.replace(/\D/g, '').slice(0, 6); inp.value = d; store.code = d; refresh(); });
    if (!EMBED) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { } }, 350);
    return { fill: function (c) { inp.value = c; store.code = c; refresh(); } };
  }

  /* ================= Overlays ================= */
  var overlays, root, viewport, closers = [];
  function addOverlay(html) { var d = document.createElement('div'); d.innerHTML = html; var el = d.firstElementChild; overlays.appendChild(el); return el; }
  function toast(msg, ok) {
    var old = overlays.querySelector('.app-toast'); if (old) old.remove();
    var t = addOverlay('<div class="app-toast' + (ok ? ' ok' : '') + '" role="status">' + icon(ok ? 'check' : 'info') + esc(msg) + '</div>');
    setTimeout(function () { t.remove(); }, 2800);
  }
  function dialog(o) {
    var acts = (o.actions || []).map(function (a, i) { return '<button type="button" class="btn btn-block ' + (a.kind || '') + '" data-i="' + i + '">' + a.label + '</button>'; }).join('');
    var el = addOverlay('<div class="dlg-backdrop"><div class="dlg is-' + (o.tone || 'info') + '" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">' +
      '<div class="dlg-ico">' + icon(o.icon || 'info') + '</div><h2 id="dlg-t">' + o.title + '</h2><p id="dlg-d">' + o.text + '</p><div class="dlg-actions">' + acts + '</div></div></div>');
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== close; }); }
    closers.push(close);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) { var a = o.actions[+b.dataset.i]; if (a.keep) { a.fn && a.fn(b, close); } else { close(); a.fn && a.fn(); } return; }
      if (e.target === el && !o.sticky) close();
    });
    var first = el.querySelector('[data-i]'); first && first.focus();
    return close;
  }
  function smsBanner(code, n) {
    var old = overlays.querySelector('.sms-banner'); if (old) old.remove();
    var b = addOverlay('<button type="button" class="sms-banner" aria-label="New SMS with your code. Tap to fill.">' +
      '<span class="app-ico">' + icon('message') + '</span><span style="flex:1;min-width:0"><small><b>Messages · NANDAM</b><span>now</span></small>' +
      '<p><b>' + code + '</b> is your verification code for Nandam Handlooms. Do not share it with anyone.</p></span></button>');
    b.addEventListener('click', function () { b.remove(); if (smsFill) smsFill(code); });
    setTimeout(function () { b.remove(); }, 7000);
    if (flags().platform === 'android') setTimeout(function () { if (smsFill) { smsFill(code); toast('Code read from SMS automatically', true); } }, 1400);
  }
  var smsFill = null;
  /* Face ID / fingerprint simulation. done(true) on success; fallback() after 3 fails or cancel. */
  function bioPrompt(done, fallback) {
    var fails = 0, ios = flags().platform === 'ios', el;
    if (ios) {
      el = addOverlay('<div class="bio-layer"><div class="bio-card scanning" role="status">' + icon('faceid') + '<span>Face ID</span></div>' +
        '<div class="sim-row"><button type="button" class="mock-chip" data-sim="ok">Simulate: recognised</button><button type="button" class="mock-chip" data-sim="fail">Simulate: not recognised</button><button type="button" class="mock-chip" data-sim="cancel">Cancel</button></div></div>');
    } else {
      el = addOverlay('<div class="dlg-backdrop" style="align-items:flex-end;padding:0"><div class="bio-android" role="dialog" aria-label="Fingerprint"><b style="font-size:1.1rem">Sign in to Nandam Handlooms</b><div class="fp">' + icon('finger') + '</div>' +
        '<p class="bio-msg" style="color:var(--text-2);font-size:.9rem">Touch the fingerprint sensor</p><div class="sim-row" style="margin:.75rem 0"><button type="button" class="mock-chip" data-sim="ok">Simulate: match</button><button type="button" class="mock-chip" data-sim="fail">Simulate: no match</button></div>' +
        '<button type="button" class="btn btn-ghost" data-sim="cancel">Use PIN</button></div></div>');
    }
    function close() { el.remove(); closers = closers.filter(function (c) { return c !== cancel; }); }
    function cancel() { close(); fallback && fallback(false); }
    closers.push(cancel);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sim]'); if (!b) return;
      var card = el.querySelector('.bio-card, .bio-android');
      if (b.dataset.sim === 'cancel') return cancel();
      if (b.dataset.sim === 'ok') {
        card.classList.remove('scanning', 'fail'); card.classList.add('ok');
        if (ios) card.innerHTML = icon('check') + '<span>Recognised</span>'; else el.querySelector('.bio-msg').textContent = 'Fingerprint recognised';
        setTimeout(function () { close(); done(); }, 650);
        return;
      }
      fails++; card.classList.remove('fail'); void card.offsetWidth; card.classList.add('fail');
      if (ios) card.querySelector('span').textContent = fails >= 3 ? 'Face ID failed' : 'Not recognised · try again';
      else el.querySelector('.bio-msg').textContent = fails >= 3 ? 'Too many tries' : 'Not recognised. Try again.';
      if (fails >= 3) setTimeout(function () { close(); fallback && fallback(true); }, 700);
    });
  }

  /* ================= Router ================= */
  var current = { name: '', params: {} }, state = 'normal', ui = {}, timers = [], ctx = {};
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = h.split('?'), p = {};
    (q[1] || '').split('&').forEach(function (kv) { if (!kv) return; var a = kv.split('='); p[decodeURIComponent(a[0])] = decodeURIComponent(a[1] || ''); });
    return { name: q[0] || 'splash', params: p };
  }
  function go(route) { if (('#/' + route) === location.hash) { render(); } else location.hash = '#/' + route; }
  function every(fn, ms) { var id = setInterval(fn, ms); timers.push(id); return id; }
  function after(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function afterNav(fn, ms) { return setTimeout(fn, ms); }   // survives the next render (used right after go())
  var SIGNED = { home: 1, account: 1, changepin: 1, devices: 1, orders: 1, scan: 1, products: 1, biosetup: 1, done: 1, resetdone: 1 };
  function onRoute() {
    var r = parse();
    if (r.name !== current.name || JSON.stringify(r.params) !== JSON.stringify(current.params)) { if (ctx.keepUi !== r.name) ui[r.name] = undefined; ctx.keepUi = null; state = 'normal'; }
    current = r;
    if (r.params.offline === '1' && !flags().offline) NH.setFlag('offline', true, true);
    if (r.params.server === '1' && !flags().server) NH.setFlag('server', true, true);
    if (SIGNED[r.name] && !demo.session) {               // direct link from the catalogue: sign in the sample owner
      startSession('9000000001'); save();
      afterNav(function () { toast('Preview: signed in as the sample owner'); }, 400);
    }
    render();
    document.dispatchEvent(new CustomEvent('nh:route', { detail: r }));
  }

  /* ================= Screens ================= */
  var S = {};

  S.splash = function () {
    return {
      dark: true,
      html: '<section class="scr weave center-col" style="justify-content:center;gap:.9rem">' +
        '<img class="login-logo" src="assets/logo.png" alt="Nandam Handlooms" style="width:120px;height:120px;animation:pop .6s var(--ease)">' +
        '<div class="login-name" style="font-size:1.6rem;animation:rise .6s .15s both">Nandam Handlooms</div><div class="login-sub" style="animation:rise .6s .25s both">Admin</div>' +
        '<div style="width:120px;margin-top:1.5rem" aria-hidden="true"><div class="progress" style="background:rgba(255,255,255,.18)"><span class="splash-bar" style="width:0;background:#fff;transition:width 1.1s var(--ease)"></span></div></div>' +
        '<p class="splash-msg" style="font-size:.85rem;opacity:.8;margin:0" role="status">' + (state === 'error' || flags().server ? 'Server not reachable. Opening with your saved sign-in…' : 'Checking your sign-in…') + '</p>' +
        '<div class="weave-border" style="position:absolute;left:0;right:0;bottom:0"></div></section>',
      mount: function (el) {
        after(function () { var b = el.querySelector('.splash-bar'); if (b) b.style.width = '100%'; }, 50);
        if (state === 'loading') return;
        after(function () { go(demo.session ? 'home' : 'signin?auto=1'); }, state === 'error' || flags().server ? 2200 : 1300);
      }
    };
  };

  S.signin = function (p) {
    var u = ui.signin || (ui.signin = { number: (demo.remembered && demo.remembered.number) || '', pin: '', err: null, left: 0, manual: false, show: false });
    var rem = demo.remembered && !u.manual && u.number === demo.remembered.number ? demo.remembered : null;
    var f = flags(), n = u.number;
    if (n && f.faceChanged && demo.bio[n]) { demo.bio[n] = false; save(); u.faceWarn = true; }
    var canBio = rem && bioOn(n) && !f.faceChanged;
    if (state === 'error') { u.err = 'wrong'; u.left = 4; }
    if (state === 'warning') { u.err = 'wrong'; u.left = 1; u.nextLock = 15; }
    var msgs = '';
    if (f.offline) msgs += alertBox('warning', 'You\'re offline', 'Signing in needs internet. Your work on this phone is safe.', 'wifioff');
    if (u.faceWarn) msgs += alertBox('warning', 'Face ID was turned off', 'This phone\'s face settings changed. Sign in with your PIN, then turn it on again in My account.');
    if (u.err === 'wrong') msgs += u.left === 1 ? alertBox('warning', '1 try left', 'That mobile number and PIN don\'t match. After one more wrong try, sign-in is locked for ' + (u.nextLock || 15) + ' minutes.')
      : alertBox('error', 'That mobile number and PIN don\'t match', u.left + ' tries left.');
    if (u.err === 'server') msgs += alertBox('error', 'The server is taking too long', 'Nothing was lost, and this try wasn\'t counted against your PIN. Try again in a moment.', 'clock');
    var who = rem ? '<div class="who"><span class="avatar">' + initials(rem.name) + '</span><div><b>' + esc(rem.name) + '</b><span>+91 ' + fmt(rem.number) + '</span></div><button type="button" class="link-btn" data-notyou>Not you?</button></div>'
      : mobileField('si-mobile', u.number, u.mobileErr);
    var form = '<div class="login-form">' + (rem ? '<h2>Welcome back</h2><p class="scr-lead" style="margin-bottom:.9rem">Enter your PIN' + (canBio ? ' or use ' + bioName() : '') + '.</p>' : '<h2>Sign in</h2><p class="scr-lead" style="margin-bottom:.9rem">Use your mobile number and PIN.</p>') +
      msgs + (msgs ? '<div style="height:.75rem"></div>' : '') + who +
      pinField('pin', { label: 'PIN', value: u.pin, show: u.show, bio: canBio, error: !!u.err && u.err !== 'server', tools: '<button type="button" class="link-btn" data-go="forgot">Forgot PIN?</button>' }) +
      '<div style="height:.75rem"></div>' +
      '<button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-submit>Sign in</button>' +
      (canBio && NH.opts.pin === 'a' ? '<button type="button" class="btn btn-block" style="margin-top:.6rem" data-bio>' + icon(f.platform === 'ios' ? 'faceid' : 'finger') + 'Use ' + bioName() + '</button>' : '') +
      '<div class="login-links"><span style="color:var(--muted)">Still on an old 4-digit PIN? Enter it and tap Sign in.</span><button type="button" class="link-btn" data-go="activate">First time here? Set up your account</button></div></div>';
    var hero = '<div class="login-hero weave"><img class="login-logo" src="assets/logo.png" alt=""><div><div class="login-name">Nandam Handlooms</div><div class="login-sub">Admin</div></div><div class="tagline">Weaving tradition into fashion · Mangalagiri</div><div class="weave-border"></div></div>';
    var L = NH.opts.login, tablet = root.dataset.size === 'tablet';
    return {
      auth: true, dark: !tablet && L !== 'c',
      html: tablet ? '<section class="scr"><div class="scr-body">' + form + '</div></section>'
        : '<section class="scr login l' + L + '" style="padding-top:0">' + hero + form + '</section>',
      mount: function (el) {
        var btn = el.querySelector('[data-submit]');
        function ready() { return !mobileError(u.number) && (u.pin || '').length >= 4; }
        function upd() { btn.disabled = !ready() && state !== 'loading'; }
        bindMobile(el, 'si-mobile', u, 'number', upd);
        var pad = bindPin(el, 'pin', u, { max: 6, showKey: 'show', onChange: upd, onComplete: function () { if (ready()) submit(); }, onBio: bio });
        upd();
        var ny = el.querySelector('[data-notyou]'); ny && ny.addEventListener('click', function () { u.manual = true; u.number = ''; u.pin = ''; u.err = null; render(); });
        var bb = el.querySelector('[data-bio]'); bb && bb.addEventListener('click', bio);
        btn.addEventListener('click', submit);
        if (state === 'success') after(function () { toast('Signed in. Opening Home…', true); }, 200);
        if (state === 'popup') dialog({ icon: 'key', title: 'Forgot your PIN?', text: 'We\'ll send an SMS code to your mobile number so you can choose a new PIN. Your other devices will be signed out for safety.', actions: [{ label: 'Reset my PIN', kind: 'btn-primary', fn: function () { go('forgot'); } }, { label: 'Cancel', kind: '' }] });
        if (p.auto === '1' && canBio && state === 'normal' && !u.autoDone) { u.autoDone = true; after(bio, 450); }
        function bio() {
          bioPrompt(function () {
            api.bioLogin(n).then(function (r) { if (r.next) { go(r.next); afterNav(signedInToasts, 300); } else { u.err = 'wrong'; u.left = 4; render(); } }, offline);
          }, function (failed) { if (failed) toast(BioName() + ' didn\'t work. Enter your PIN.'); });
        }
        function offline(e) { u.err = e && e.code === 'server' ? 'server' : null; render(); }
        function submit() {
          var me = mobileError(u.number);
          if (me) { u.mobileErr = me; return render(); }
          u.mobileErr = null; btn.classList.add('is-loading'); el.classList.add('is-busy');
          api.login(u.number, u.pin).then(function (r) {
            if (r.locked) { ctx.number = u.number; u.pin = ''; return go('locked?n=' + u.number); }
            if (r.error) { u.err = 'wrong'; u.left = r.left; u.nextLock = r.nextLock; u.pin = ''; render(); return; }
            u.pin = ''; u.err = null; go(r.next); if (r.next === 'home') afterNav(signedInToasts, 300);
          }, function (e) { u.pin = ''; u.err = e && e.code === 'server' ? 'server' : null; render(); });
        }
      }
    };
  };
  function signedInToasts() { if (demo.draft) toast('Welcome back. Your unsaved bill is safe', true); else toast('Signed in', true); }

  S.faceid = function (p) {
    if (!demo.remembered) demo.remembered = { number: '9000000001', name: 'Lakshmi' };
    demo.bio[demo.remembered.number] = true; save();
    var scr = S.signin(p), m = scr.mount;
    scr.mount = function (el) {
      m(el);
      if (state === 'error') return after(function () { toast(BioName() + ' didn\'t work. Enter your PIN.'); }, 200);
      after(function () {
        bioPrompt(function () { api.bioLogin(demo.remembered.number).then(function () { go('home'); afterNav(signedInToasts, 300); }, function (e) { toast(netToast(e)); }); },
          function (failed) { go('signin'); if (failed) afterNav(function () { toast(BioName() + ' didn\'t work. Enter your PIN.'); }, 300); });
      }, 300);
    };
    return scr;
  };

  S.locked = function (p) {
    var n = p.n || ctx.number || (demo.remembered && demo.remembered.number) || '9000000001';
    var t = triesOf(n);
    if (!(t.lockedUntil > now()) && !(ui.locked && ui.locked.over)) { t.lockCount = Math.max(1, t.lockCount); t.lockedUntil = now() + lockMins(t.lockCount) * MIN; save(); }
    if (state === 'warning') { t.lockCount = 2; t.lockedUntil = now() + 30 * MIN; save(); }
    var u = ui.locked || (ui.locked = {});
    var total = lockMins(t.lockCount) * MIN;
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', 'signin') + '<div class="scr-body center-col">' +
        '<div class="msg-icon is-danger">' + icon('lock') + '</div><h2 class="scr-title">Sign-in locked</h2>' +
        '<p class="scr-lead">Too many wrong PINs for <b>+91 ' + fmt(n) + '</b>.</p>' +
        '<div class="lock-live"><div class="timer" aria-live="polite">' + mmss(t.lockedUntil - now()) + '</div>' +
        '<div class="progress is-danger" style="width:220px;margin:0 auto 1rem"><span style="width:100%"></span></div></div>' +
        '<div class="facts"><div>' + icon('clock') + 'This is lock ' + t.lockCount + '. It lasts ' + lockMins(t.lockCount) + ' minutes.</div>' +
        '<div>' + icon('alert') + 'If it happens again, the next lock lasts ' + lockMins(t.lockCount + 1) + ' minutes.</div>' +
        '<div>' + icon('check') + 'When the timer ends, you get 5 fresh tries.</div></div>' +
        '<div class="sim-inline"><button type="button" class="mock-chip" data-skip>Skip timer (demo)</button></div></div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block" data-forgot>Reset PIN with an SMS code</button><button type="button" class="btn btn-block" data-go="signin">Back to sign in</button></div></section>',
      mount: function (el) {
        var timer = el.querySelector('.timer'), bar = el.querySelector('.progress span');
        function tick() {
          var left = t.lockedUntil - now();
          timer.textContent = mmss(left); bar.style.width = Math.max(0, left / total * 100) + '%';
          if (left <= 0) { el.querySelector('.lock-live').innerHTML = alertBox('success', 'You can try again now', 'You have 5 fresh tries.'); clearInterval(id); u.over = true; }
        }
        var id = every(tick, 1000); tick();
        el.querySelector('[data-skip]').addEventListener('click', function () { t.lockedUntil = now(); save(); tick(); });
        el.querySelector('[data-forgot]').addEventListener('click', function () { ctx.number = n; go('forgot'); });
      }
    };
  };

  S.newdevice = function () {
    if (!demo.step || demo.step.purpose !== 'device') { demo.step = { number: '9000000001', purpose: 'device', after: 'home' }; save(); }
    var n = demo.step.number, acc = demo.accounts[n];
    var err = state === 'error' ? alertBox('warning', 'You\'re offline', 'Sending the code needs internet.', 'wifioff') : '';
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', 'signin') + '<div class="scr-body center-col">' +
        '<div class="msg-icon">' + icon('shield') + '</div><h2 class="scr-title">New phone: quick check</h2>' +
        '<p class="scr-lead">Your PIN is right. This is the first time <b>' + esc(acc.name) + '</b> is signing in on this ' + (flags().platform === 'ios' ? (root.dataset.size === 'tablet' ? 'iPad' : 'iPhone') : 'phone') + ', so we\'ll send a code to <b>' + masked(n) + '</b>.</p>' + err +
        '<div class="facts"><div>' + icon('check') + 'Needed only once on each phone or tablet</div><div>' + icon('check') + 'Keeps your account safe even if someone learns your PIN</div><div>' + icon('check') + 'This phone then appears in My devices</div></div></div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-send>Send code</button><button type="button" class="btn btn-ghost btn-block" data-go="signin">Cancel</button></div></section>',
      mount: function (el) {
        var b = el.querySelector('[data-send]');
        b.addEventListener('click', function () {
          b.classList.add('is-loading');
          api.requestCode(n, 'device', true).then(function (r) { go('otp?for=device'); if (r.sent) afterNav(function () { smsBanner(r.code, n); }, 1200); },
            function (e) { b.classList.remove('is-loading'); el.querySelector('.scr-body').insertAdjacentHTML('beforeend', '<div style="height:1rem"></div>' + netAlert(e)); });
        });
      }
    };
  };

  S.activate = function () {
    var u = ui.activate || (ui.activate = { number: '' });
    if (state === 'error') { u.err = 'Mobile numbers start with 6, 7, 8 or 9.'; u.number = u.number || '5000000003'; }
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', 'signin') + '<div class="scr-body">' + stepsBar(1, 4) +
        '<h2 class="scr-title">Set up your account</h2><p class="scr-lead">Enter the mobile number the owner invited. We\'ll send a 6-digit code to it.</p>' +
        (u.alert || '') + mobileField('ac-mobile', u.number, u.err, 'Only numbers invited by the owner can be set up.') + '</div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-send>Send code</button><button type="button" class="btn btn-ghost btn-block" data-go="signin">Already set up? Sign in</button></div></section>',
      mount: function (el) { codeRequestForm(el, u, 'ac-mobile', 'setup'); }
    };
  };
  S.forgot = function () {
    var u = ui.forgot || (ui.forgot = { number: ctx.number || (demo.remembered && demo.remembered.number) || '' }); ctx.number = null;
    if (state === 'error') { u.err = 'Enter a 10-digit mobile number.'; u.number = '90000'; }
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', 'signin') + '<div class="scr-body">' + stepsBar(1, 3) +
        '<h2 class="scr-title">Forgot your PIN?</h2><p class="scr-lead">Enter your mobile number. We\'ll send a code so you can choose a new PIN.</p>' +
        (u.alert || '') + mobileField('fg-mobile', u.number, u.err) +
        alertBox('info', 'For your safety', 'Resetting your PIN signs out your other phones and tablets. This phone stays signed in.') + '</div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-send>Send code</button><button type="button" class="btn btn-ghost btn-block" data-go="signin">Back to sign in</button></div></section>',
      mount: function (el) { codeRequestForm(el, u, 'fg-mobile', 'forgot'); }
    };
  };
  function codeRequestForm(el, u, id, purpose) {
    bindMobile(el, id, u, 'number');
    var b = el.querySelector('[data-send]');
    b.addEventListener('click', function () {
      var me = mobileError(u.number); if (me) { u.err = me; u.alert = ''; return render(); }
      u.err = null; b.classList.add('is-loading');
      api.requestCode(u.number, purpose).then(function (r) {
        if (r.error === 'too_many') { u.alert = alertBox('error', 'Too many codes requested', 'For safety, try again after 1 hour.'); return render(); }
        if (r.error === 'wait') { u.alert = alertBox('warning', 'A code was sent a moment ago', 'Wait ' + mmss(r.wait) + ' before asking for another one, or use the code you already have.'); return render(); }
        go('otp?for=' + purpose);
        if (r.sent) afterNav(function () { smsBanner(r.code, u.number); }, 1500);
      }, function (e) { u.alert = netAlert(e); render(); });
    });
  }

  S.otp = function (p) {
    var purpose = p.for || 'setup';
    if (!demo.otp && ui.otp) {   // the code was just used: never send a new one on a redraw
      return message({ icon: 'check', tone: 'success', title: 'Code already used', text: 'This code has been used. Carry on, or start again for a new code.', buttons: '<button type="button" class="btn btn-primary btn-block" data-go="signin">Back to sign in</button>' });
    }
    if (!demo.otp) {   // opened directly: start a sample flow
      var sample = purpose === 'setup' ? '9000000003' : '9000000001';
      var code = String(Math.floor(100000 + Math.random() * 900000));
      demo.otp = { number: sample, code: code, purpose: purpose, sentAt: now(), expiresAt: now() + MIN, tries: 0 };
      if (purpose === 'device') demo.step = { number: sample, purpose: 'device', after: 'home' };
      save(); after(function () { smsBanner(code, sample); }, 900);
    }
    var o = demo.otp, n = o.number, u = ui.otp || (ui.otp = { code: '' });
    if (state === 'error') { u.err = 'wrong'; u.left = 2; }
    var titles = { setup: 'Enter the code', forgot: 'Enter the reset code', device: 'Verify this phone' };
    var steps = purpose === 'setup' ? stepsBar(2, 4) : purpose === 'forgot' ? stepsBar(2, 3) : '';
    var generic = purpose === 'setup' ? 'If this number has been invited, the code is on its way.' : purpose === 'forgot' ? 'If this number has an account, the code is on its way.' : '';
    var msg = '';
    if (u.err === 'wrong') msg = alertBox('error', 'That code isn\'t right', u.left + (u.left === 1 ? ' try' : ' tries') + ' left.');
    if (u.err === 'expired' || u.err === 'used') msg = alertBox('error', u.err === 'used' ? 'Too many wrong tries' : 'This code has expired', 'Tap Resend code to get a new one.');
    if (u.alert) msg = u.alert;
    var showSuggest = flags().platform === 'ios' && o.code && !u.code;
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', purpose === 'device' ? 'signin' : (purpose === 'setup' ? 'activate' : 'forgot')) + '<div class="scr-body">' + steps +
        '<h2 class="scr-title">' + titles[purpose] + '</h2><p class="scr-lead">We sent a 6-digit code to <b>+91 ' + fmt(n) + '</b>. ' + generic +
        (purpose !== 'device' ? ' <button type="button" class="link-btn" data-go="' + (purpose === 'setup' ? 'activate' : 'forgot') + '">Change number</button>' : '') + '</p>' +
        msg + (msg ? '<div style="height:.75rem"></div>' : '') + otpField(u.code, !!u.err) +
        '<div class="otp-meta"><span class="exp" aria-live="polite"></span><div class="progress"><span class="exp-bar" style="width:100%"></span></div></div>' +
        (showSuggest ? '<button type="button" class="suggest" data-suggest>' + icon('message') + '<span><small>From Messages</small><b>' + o.code + '</b></span><span style="margin-left:auto;font-size:.8rem;color:var(--muted)">Tap to fill</span></button>' : '') +
        '<p class="resend" style="margin:1.1rem 0 0;font-size:.9rem;color:var(--text-2)"></p><p class="help field-hint" style="margin-top:.5rem"></p>' +
        '<div class="sim-inline"><button type="button" class="mock-chip" data-expire>Expire code (demo)</button><button type="button" class="mock-chip" data-skipwait>Skip resend wait (demo)</button></div>' +
        (o.code ? '' : '<p class="nosms" style="display:none;margin-top:.75rem"><span class="mock-tag">Demo</span> <span style="font-size:.85rem;color:var(--muted)">No SMS arrives: this number isn\'t invited. The screen still looks the same, so outsiders learn nothing.</span></p>') +
        '</div><div class="scr-foot"><button type="button" class="btn btn-primary btn-block' + (state === 'loading' ? ' is-loading' : '') + '" data-verify>Verify</button></div></section>',
      mount: function (el) {
        var otp = bindOtp(el, u, function () { verify(); });
        smsFill = function (c) { otp.fill && otp.fill(c); };
        var vb = el.querySelector('[data-verify]');
        vb.addEventListener('click', verify);
        var sg = el.querySelector('[data-suggest]'); sg && sg.addEventListener('click', function () { otp.fill(o.code); });
        var exp = el.querySelector('.exp'), bar = el.querySelector('.exp-bar'), rs = el.querySelector('.resend'), help = el.querySelector('.help');
        function tick() {
          var o2 = demo.otp || o, left = o2.expiresAt - now(), rw = MIN - (now() - o2.sentAt);
          if (state === 'warning') left = Math.min(left, 15000);
          exp.textContent = left > 0 ? 'Code expires in ' + mmss(left) : 'Code expired';
          exp.style.color = left < 20000 ? 'var(--warning)' : '';
          bar.style.width = Math.max(0, left / MIN * 100) + '%';
          bar.parentNode.className = 'progress' + (left < 20000 ? ' is-warning' : '');
          if (rw > 0) rs.innerHTML = 'Didn\'t get it? Resend in <b class="mono">' + mmss(rw) + '</b>';
          else if (!rs.querySelector('button')) { rs.innerHTML = 'Didn\'t get it? <button type="button" class="link-btn" data-resend>Resend code</button>'; rs.querySelector('[data-resend]').addEventListener('click', resend); }
          if (rw <= 0 && purpose === 'setup') help.textContent = 'Still nothing? Check the number, or ask the owner to confirm it has been invited.';
        }
        every(tick, 1000); tick();
        after(function () { var ns = el.querySelector('.nosms'); if (ns) ns.style.display = 'block'; }, 2500);
        el.querySelector('[data-expire]').addEventListener('click', function () { if (demo.otp) { demo.otp.expiresAt = now(); save(); } tick(); });
        el.querySelector('[data-skipwait]').addEventListener('click', function () { if (demo.otp) { demo.otp.sentAt = now() - MIN; save(); } tick(); });
        if (state === 'success') after(function () { el.querySelectorAll('.box').forEach(function (b, i) { b.textContent = String(o.code || '482913')[i]; b.style.borderColor = 'var(--success)'; }); toast('Code verified', true); }, 150);
        function resend() {
          api.requestCode(n, purpose).then(function (r) {
            u.code = ''; u.err = null;
            if (r.error === 'too_many') { u.alert = alertBox('error', 'Too many codes requested', 'For safety, try again after 1 hour.'); return render(); }
            if (r.error === 'wait') return;
            u.alert = alertBox('info', 'New code sent', 'The earlier code no longer works.'); render();
            if (r.sent) after(function () { smsBanner(r.code, n); }, 1200);
          }, function (e) { u.alert = netAlert(e); render(); });
        }
        function verify() {
          if ((u.code || '').length !== 6) { u.err = null; u.alert = alertBox('warning', 'Enter all 6 digits', ''); return render(); }
          vb.classList.add('is-loading'); u.alert = '';
          api.verifyCode(u.code).then(function (r) {
            if (r.error) { u.err = r.error; u.left = r.left; u.code = ''; return render(); }
            if (r.trusted) NH.setFlag('newPhone', false, true);
            go(r.next);
            if (r.next === 'home') afterNav(function () { toast('This phone is now trusted', true); }, 300);
          }, function (e) { vb.classList.remove('is-loading'); u.alert = netAlert(e); render(); });
        }
      }
    };
  };

  S.setpin = function (p) {
    var purpose = p.for || 'setup';
    var want = purpose === 'setup' ? 'setup' : purpose === 'reset' ? 'reset' : 'upgrade';
    if (!demo.step || demo.step.purpose !== want) {
      demo.step = { number: want === 'setup' ? '9000000003' : want === 'reset' ? '9000000001' : '9000000002', purpose: want, until: now() + 10 * MIN }; save();
    }
    var n = demo.step.number, u = ui.setpin || (ui.setpin = { phase: 'create', pin: '', first: '' });
    if (state === 'error') { u.phase = 'create'; u.err = 'PINs don\'t match. Enter the new PIN again.'; }
    var titles = { setup: 'Create your PIN', reset: 'Choose a new PIN', upgrade: 'Set a 6-digit PIN' };
    var confirm = u.phase === 'confirm';
    var steps = want === 'setup' ? stepsBar(3, 4) : want === 'reset' ? stepsBar(3, 3) : '';
    var lead = confirm ? 'Enter the same 6 digits again to confirm.' : (want === 'upgrade' ? '' : 'You\'ll use this PIN to sign in on this phone and on any new phone.');
    var top = want === 'upgrade' && !confirm ? alertBox('info', 'PINs are now 6 digits', 'Your old 4-digit PIN worked this time. Set a 6-digit PIN to continue. It takes 10 seconds.') + '<div style="height:1rem"></div>' : '';
    var rules = confirm ? '' : rulesList(pinRules(u.pin, n));
    var expired = demo.step.until && now() > demo.step.until;
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', null).replace('<span style="width:12px"></span>', '<button class="icon-btn" type="button" data-back aria-label="Back">' + icon('back') + '</button>') + '<div class="scr-body">' + steps +
        '<h2 class="scr-title">' + (confirm ? 'Type it again' : titles[want]) + '</h2>' + (lead ? '<p class="scr-lead">' + lead + '</p>' : '') + top +
        (expired ? alertBox('error', 'This step timed out', 'For safety, finish within 10 minutes of the SMS code. Start again with a new code.') : '') +
        (u.err ? alertBox('error', u.err, '') + '<div style="height:.75rem"></div>' : '') + (u.net ? u.net + '<div style="height:.75rem"></div>' : '') +
        pinField('pin', { label: confirm ? 'Confirm PIN' : 'New PIN', value: u.pin, show: u.show, error: !!u.err, autofocus: true }) + rules +
        '</div><div class="scr-foot"><button type="button" class="btn btn-primary btn-block" data-next>' + (confirm ? 'Save PIN' : 'Continue') + '</button></div></section>',
      mount: function (el) {
        var nb = el.querySelector('[data-next]');
        function upd() {
          nb.disabled = (u.pin || '').length !== 6;
          if (!confirm) { var r = el.querySelector('.rules'); if (r) r.outerHTML = rulesList(pinRules(u.pin || '', n)); }
        }
        var pad = bindPin(el, 'pin', u, { max: 6, showKey: 'show', onChange: upd, onComplete: function () { if (NH.opts.pin === 'b') after(next, 180); } });
        upd();
        nb.addEventListener('click', next);
        el.querySelector('[data-back]').addEventListener('click', back);
        if (state === 'popup') back();
        function back() {
          if (confirm) { u.phase = 'create'; u.pin = ''; u.first = ''; return render(); }
          if (want === 'upgrade') return go('signin');
          dialog({ tone: 'warning', icon: 'alert', title: 'Leave without a PIN?', text: 'Your account won\'t be ready yet. To start again you\'ll need a new SMS code.', actions: [{ label: 'Stay and finish', kind: 'btn-primary' }, { label: 'Leave', kind: 'btn-danger', fn: function () { go('signin'); } }] });
        }
        function next() {
          var v = u.pin || ''; if (v.length !== 6) return;
          if (!confirm) {
            var bad = pinRules(v, n).filter(function (r) { return r.ok === false; });
            if (bad.length) { pad.error(); u.err = null; return; }
            u.first = v; u.pin = ''; u.err = null; u.phase = 'confirm'; return render();
          }
          if (v !== u.first) { u.phase = 'create'; u.pin = ''; u.first = ''; u.err = 'PINs don\'t match. Enter the new PIN again.'; return render(); }
          nb.classList.add('is-loading'); u.net = '';
          api.setPin(v).then(function (r) {
            if (r.error) { u.err = 'This step timed out. Start again with a new code.'; u.phase = 'create'; u.pin = ''; return render(); }
            go(r.next); if (r.toast) afterNav(function () { toast(r.toast, true); }, 300);
          }, function (e) { u.net = netAlert(e); render(); });
        }
      }
    };
  };

  S.already = function () {
    if (!demo.step) { demo.step = { number: '9000000001', purpose: 'reset', until: now() + 10 * MIN }; save(); }
    var n = demo.step.number;
    return {
      auth: true,
      html: '<section class="scr">' + topBar('', 'signin') + '<div class="scr-body center-col"><div class="msg-icon">' + icon('info') + '</div>' +
        '<h2 class="scr-title">This number is already set up</h2><p class="scr-lead"><b>+91 ' + fmt(n) + '</b> already has a PIN. Sign in, or choose a new PIN if you\'ve forgotten it. You\'ve just verified the SMS code, so no new code is needed.</p></div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block" data-signin>Sign in</button><button type="button" class="btn btn-block" data-go="setpin?for=reset">Choose a new PIN</button></div></section>',
      mount: function (el) { el.querySelector('[data-signin]').addEventListener('click', function () { demo.remembered = { number: n, name: demo.accounts[n].name }; save(); go('signin'); }); }
    };
  };

  S.biosetup = function () {
    var n = demo.session.number, ios = flags().platform === 'ios', name = bioName();
    return {
      auth: true,
      html: '<section class="scr"><div class="scr-top"></div><div class="scr-body center-col">' + stepsBar(4, 4).replace('class="steps"', 'class="steps" style="width:100%"') +
        '<div class="msg-icon">' + icon(ios ? 'faceid' : 'finger') + '</div><h2 class="scr-title">Sign in faster with ' + name + '</h2>' +
        '<p class="scr-lead">Next time, just look at the phone' + (ios ? '' : ' or touch the sensor') + ' instead of typing your PIN.</p>' +
        (state === 'error' ? alertBox('warning', name + ' isn\'t set up on this phone', 'Set it up in the phone\'s Settings, or skip this for now.') : '') +
        '<div class="facts"><div>' + icon('check') + 'Your ' + (ios ? 'face' : 'fingerprint') + ' stays on this phone. It is never sent to us.</div><div>' + icon('check') + 'Your PIN still works any time</div><div>' + icon('check') + 'Turn it off any time in My account</div></div></div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block" data-on' + (state === 'error' ? ' disabled' : '') + '>Turn on ' + name + '</button><button type="button" class="btn btn-ghost btn-block" data-go="done">Not now</button></div></section>',
      mount: function (el) {
        el.querySelector('[data-on]').addEventListener('click', function () {
          bioPrompt(function () { demo.bio[n] = true; NH.setFlag('faceChanged', false); save(); go('done'); },
            function (failed) { if (failed) { toast('Couldn\'t turn on ' + name + '. You can try later in My account.'); after(function () { go('done'); }, 900); } });
        });
      }
    };
  };

  S.done = function () {
    var n = demo.session.number, acc = demo.accounts[n];
    return {
      auth: true,
      html: '<section class="scr"><div class="scr-body center-col">' + successMark() + '<h2 class="scr-title">You\'re all set, ' + esc(acc.name) + '</h2>' +
        '<p class="scr-lead">Your account is ready.</p><div class="facts"><div>' + icon('check') + 'Signed in on this ' + deviceModel() + '</div>' +
        '<div>' + icon('check') + 'Stays signed in for 7 days, renewed every time you use the app</div>' +
        '<div>' + icon('check') + bioName().replace(/^f/, 'F') + ' ' + (bioOn(n) ? 'is on' : 'is off (turn it on in My account)') + '</div></div></div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block" data-go="home">Go to Home</button></div></section>'
    };
  };

  S.resetdone = function () {
    var others = (demo.lastReset && demo.lastReset.others) || 0;
    return {
      auth: true,
      html: '<section class="scr"><div class="scr-body center-col">' + successMark() + '<h2 class="scr-title">PIN changed</h2>' +
        '<p class="scr-lead">You\'re signed in on this phone with your new PIN.</p><div class="facts">' +
        '<div>' + icon('check') + (others ? others + ' other device' + (others > 1 ? 's were' : ' was') + ' signed out for safety' : 'No other devices were signed in') + '</div>' +
        '<div>' + icon('check') + 'Any sign-in lock was cleared</div><div>' + icon('check') + 'On other devices, sign in with the new PIN and an SMS code</div></div></div>' +
        '<div class="scr-foot"><button type="button" class="btn btn-primary btn-block" data-go="home">Go to Home</button></div></section>'
    };
  };

  /* ----- Signed-in shell ----- */
  var TABS = [['home', 'home', 'Home'], ['orders', 'orders', 'Orders'], ['scan', 'scan', 'Scan'], ['products', 'box', 'Products'], ['account', 'more', 'More']];
  function shell(tab, inner) {
    var f = flags();
    var tabs = TABS.map(function (t) {
      var cur = t[0] === tab ? ' aria-current="page"' : '';
      if (t[0] === 'scan') return '<button type="button" class="scan-tab" data-go="scan"' + cur + ' aria-label="Scan"><span class="scan-ico">' + icon('scan') + '</span></button>';
      return '<button type="button" data-go="' + t[0] + '"' + cur + '>' + icon(t[1]) + t[2] + '</button>';
    }).join('');
    var rail = '<nav class="rail" aria-label="Main menu"><img src="assets/logo.png" alt="Nandam Handlooms">' + TABS.map(function (t) { return '<button type="button" data-go="' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[1]) + t[2] + '</button>'; }).join('') + '</nav>';
    var bar = f.offline || (state === 'warning' && tab === 'home') ? '<div class="offline-bar" role="status">' + icon('wifioff') + 'Offline. You\'re still signed in; changes will send when you\'re back online.</div>'
      : f.server ? '<div class="offline-bar" role="status">' + icon('clock') + 'Can\'t reach the server right now. You\'re still signed in; changes will send when it\'s back.</div>' : '';
    return '<div class="shell">' + rail + '<div class="shell-main">' + bar +
      inner + '</div><nav class="tabbar" aria-label="Main menu">' + tabs + '</nav></div>';
  }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

  S.home = function () {
    var n = demo.session.number, acc = demo.accounts[n], loading = state === 'loading';
    var tiles = loading ? [1, 2, 3, 4].map(function () { return '<div class="skeleton" style="height:96px;border-radius:var(--r-lg)"></div>'; }).join('')
      : '<div class="ph-tile"><b>Today\'s sales</b><span class="badge badge-planned">Module 8</span></div><div class="ph-tile"><b>To ship</b><span class="badge badge-planned">Module 7</span></div>' +
      '<div class="ph-tile"><b>Scan to sell</b><span class="badge badge-planned">Module 5</span></div><div class="ph-tile"><b>Products</b><span class="badge badge-planned">Module 4</span></div>' +
      '<div class="ph-tile wide"><b>Recent activity</b><span class="badge badge-planned">Module 10</span></div>';
    var draft = demo.draft ? '<div class="draft-card"><span class="tile">' + icon('orders') + '</span><div style="flex:1"><b>Unsaved bill restored</b><span>3 items · ₹ 7,450 · sample data</span></div><button type="button" class="btn btn-sm btn-primary" data-draft>Continue</button></div>' : '';
    return {
      shell: 'home',
      html: '<section class="scr"><div class="scr-body">' +
        '<div class="home-head">' + (loading ? '<div class="skeleton" style="width:46px;height:46px;border-radius:50%"></div><div style="flex:1"><div class="skeleton" style="height:18px;width:60%;margin-bottom:6px"></div><div class="skeleton" style="height:12px;width:40%"></div></div>'
          : '<span class="avatar">' + initials(acc.name) + '</span><div style="flex:1;min-width:0"><h1>' + greeting() + ', ' + esc(acc.name) + '</h1><p>Nandam Handlooms · Mangalagiri</p></div><span class="badge ' + (acc.role === 'Owner' ? 'badge-owner' : 'badge-staff') + '">' + acc.role + '</span>') + '</div>' +
        draft + '<div style="height:1rem"></div>' +
        alertBox('info', 'Module 1 ends here', 'This is the signed-in shell. Home itself is designed in Module 8.') +
        '<div class="list-title">Coming in later modules</div><div class="placeholder-grid">' + tiles + '</div></div></section>',
      mount: function (el) {
        var d = el.querySelector('[data-draft]'); d && d.addEventListener('click', function () { demo.draft = null; save(); toast('Scan to Sell is designed in Module 5'); render(); });
        if (state === 'success') after(function () { toast('Signed in', true); }, 200);
      }
    };
  };
  function placeholder(tab, title, mod) {
    return function () {
      return { shell: tab, html: '<section class="scr"><div class="scr-top" style="padding:0 20px"><h1>' + title + '</h1></div><div class="scr-body"><div class="ph-tile" style="min-height:200px;align-items:center;justify-content:center;text-align:center;gap:.5rem">' + icon(tab === 'scan' ? 'scan' : tab === 'orders' ? 'orders' : 'box', 'icon-xl') + '<b>' + title + '</b><span>Designed in Module ' + mod + '</span></div></div></section>' };
    };
  }
  S.orders = placeholder('orders', 'Orders', 7);
  S.scan = placeholder('scan', 'Scan to sell', 5);
  S.products = placeholder('products', 'Products', 4);

  S.account = function () {
    var n = demo.session.number, acc = demo.accounts[n], f = flags(), devs = (demo.devices[n] || []).length;
    var profile;
    if (state === 'loading') profile = '<div class="list"><div class="skel-row"><div class="skeleton" style="width:64px;height:64px;border-radius:50%"></div><div style="flex:1"><div class="skeleton" style="height:18px;width:55%;margin-bottom:8px"></div><div class="skeleton" style="height:12px;width:35%"></div></div></div></div>';
    else if (state === 'error') profile = alertBox('error', 'Couldn\'t load your profile', 'Check your connection. You can still log out below.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>';
    else profile = '<div class="list"><div class="profile-card"><span class="avatar lg">' + initials(acc.name) + '</span><div><b>' + esc(acc.name) + '</b><span>+91 ' + fmt(n) + '</span><div style="margin-top:.35rem"><span class="badge ' + (acc.role === 'Owner' ? 'badge-owner' : 'badge-staff') + '">' + acc.role + '</span></div></div></div></div>';
    var since = new Date(demo.session.at);
    var bioRow = f.face ? '<label class="row" style="cursor:pointer"><span class="tile">' + icon(f.platform === 'ios' ? 'faceid' : 'finger') + '</span><span class="grow"><b>Sign in with ' + bioName() + '</b><span>On this ' + deviceModel() + '</span></span><span class="switch"><input type="checkbox" data-bio ' + (bioOn(n) ? 'checked' : '') + ' aria-label="Sign in with ' + bioName() + '"><span></span></span></label>'
      : '<div class="row"><span class="tile">' + icon('faceid') + '</span><span class="grow"><b>' + BioName() + '</b><span>Not set up on this phone</span></span></div>';
    return {
      shell: 'account',
      html: '<section class="scr"><div class="scr-top" style="padding:0 20px"><h1>My account</h1></div><div class="scr-body narrow">' + profile +
        '<div class="list-title">Sign-in and security</div><div class="list">' + bioRow +
        '<button type="button" class="row" data-go="changepin"><span class="tile">' + icon('key') + '</span><span class="grow"><b>Change PIN</b><span>No SMS needed while signed in</span></span>' + icon('right', 'chev') + '</button>' +
        '<button type="button" class="row" data-go="devices"><span class="tile">' + icon('phone') + '</span><span class="grow"><b>My devices</b><span>' + devs + ' signed in</span></span>' + icon('right', 'chev') + '</button></div>' +
        '<div class="list-title">This phone</div><div class="list"><div class="row"><span class="tile">' + icon('clock') + '</span><span class="grow"><b>Stays signed in</b><span>7 days, renewed each time you use the app</span></span></div>' +
        '<div class="row"><span class="tile">' + icon('shield') + '</span><span class="grow"><b>Signed in since</b><span>' + since.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' · trusted device</span></span></div></div>' +
        (acc.role === 'Owner' ? '<div class="list-title">Team</div><div class="list"><div class="row" style="opacity:.75"><span class="tile">' + icon('users') + '</span><span class="grow"><b>Team members and their devices</b><span>Invite, remove, sign out staff devices</span></span><span class="badge badge-planned">Module 2</span></div></div>' : '') +
        '<div style="height:1.25rem"></div><button type="button" class="btn btn-danger btn-block" data-logout>' + icon('logout') + 'Log out</button>' +
        '<p class="version">Nandam Handlooms Admin · v2.0.0 (mock-up)</p></div></section>',
      mount: function (el) {
        el.querySelector('[data-logout]').addEventListener('click', logoutDialog);
        var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
        var b = el.querySelector('[data-bio]');
        b && b.addEventListener('change', function () {
          if (!b.checked) { demo.bio[n] = false; save(); toast(BioName() + ' turned off on this phone'); return; }
          b.checked = false;
          bioPrompt(function () { demo.bio[n] = true; save(); NH.setFlag('faceChanged', false); toast(BioName() + ' turned on', true); render(); }, function () { });
        });
        if (state === 'popup') logoutDialog();
      }
    };
  };
  function logoutDialog() {
    dialog({
      tone: 'danger', icon: 'logout', title: 'Log out on this phone?',
      text: 'You\'ll need your PIN or ' + bioName() + ' to sign in again. Anything unsaved stays on this phone for your next sign-in.',
      actions: [{ label: 'Log out', kind: 'btn-danger-solid', keep: true, fn: function (b, close) { b.classList.add('is-loading'); api.logout().then(function () { close(); go('signin'); afterNav(function () { toast('Logged out'); }, 300); }); } }, { label: 'Cancel', kind: '' }]
    });
  }

  S.changepin = function () {
    var n = demo.session.number, acc = demo.accounts[n];
    var u = ui.changepin || (ui.changepin = { phase: 'current', pin: '', cur: '', first: '', others: false });
    if (state === 'error') { u.phase = 'current'; u.err = 'That\'s not your current PIN. 4 tries left.'; }
    var ph = u.phase, idx = { current: 1, 'new': 2, confirm: 3 }[ph];
    var titles = { current: 'Enter your current PIN', 'new': 'Choose a new PIN', confirm: 'Type the new PIN again' };
    return {
      shell: 'account',
      html: '<section class="scr">' + topBar('Change PIN', 'account') + '<div class="scr-body narrow">' + stepsBar(idx, 3) +
        '<h2 class="scr-title" style="font-size:var(--fs-22)">' + titles[ph] + '</h2>' +
        (u.err ? alertBox('error', u.err, '') + '<div style="height:.75rem"></div>' : '') + (u.net ? u.net + '<div style="height:.75rem"></div>' : '') +
        pinField('pin', { label: ph === 'current' ? 'Current PIN' : ph === 'new' ? 'New PIN' : 'Confirm new PIN', value: u.pin, show: u.show, error: !!u.err, autofocus: true, tools: ph === 'current' ? '<button type="button" class="link-btn" data-go="forgot">Forgot it?</button>' : '' }) +
        (ph === 'new' ? rulesList(pinRules(u.pin, n, u.cur)) : '') +
        (ph === 'confirm' ? '<div style="height:.5rem"></div><label class="check"><input type="checkbox" data-others ' + (u.others ? 'checked' : '') + '><span><b style="color:var(--text)">Also sign out my other devices</b><br>They\'ll need the new PIN and an SMS code to sign in again.</span></label>' : '') +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-primary btn-block" data-next>' + (ph === 'confirm' ? 'Save new PIN' : 'Continue') + '</button></div></section>',
      mount: function (el) {
        var nb = el.querySelector('[data-next]');
        function upd() { nb.disabled = (u.pin || '').length !== 6; if (ph === 'new') { var r = el.querySelector('.rules'); r.outerHTML = rulesList(pinRules(u.pin || '', n, u.cur)); } }
        var pad = bindPin(el, 'pin', u, { max: 6, showKey: 'show', onChange: upd, onComplete: function () { if (NH.opts.pin === 'b') after(next, 180); } });
        upd();
        var oc = el.querySelector('[data-others]'); oc && oc.addEventListener('change', function () { u.others = oc.checked; });
        nb.addEventListener('click', next);
        if (state === 'success') after(function () { toast('PIN changed', true); }, 200);
        function next() {
          var v = u.pin || ''; if (v.length !== 6) return;
          if (ph === 'current') {
            nb.classList.add('is-loading');
            return api.checkPin(v).then(function (r) {
              if (r.locked) { return go('locked?n=' + n); }
              if (r.error) { u.err = 'That\'s not your current PIN. ' + r.left + (r.left === 1 ? ' try' : ' tries') + ' left.'; u.pin = ''; return render(); }
              u.cur = v; u.pin = ''; u.err = null; u.net = ''; u.phase = 'new'; render();
            }, function (e) { u.pin = ''; u.net = netAlert(e); render(); });
          }
          if (ph === 'new') {
            if (pinRules(v, n, u.cur).some(function (r) { return r.ok === false; })) { pad.error(); return; }
            u.first = v; u.pin = ''; u.err = null; u.phase = 'confirm'; return render();
          }
          if (v !== u.first) { u.phase = 'new'; u.pin = ''; u.err = 'PINs don\'t match. Enter the new PIN again.'; return render(); }
          nb.classList.add('is-loading');
          api.changePin(v, u.others).then(function (r) {
            ui.changepin = undefined; go('account');
            afterNav(function () { toast('PIN changed' + (r.removed ? ' · ' + r.removed + ' other device' + (r.removed > 1 ? 's' : '') + ' signed out' : ''), true); }, 300);
          }, function (e) { u.net = netAlert(e); render(); });
        }
      }
    };
  };

  S.devices = function () {
    var n = demo.session.number, acc = demo.accounts[n], list = demo.devices[n] || [];
    if (state === 'empty') list = list.filter(function (d) { return d.current; });
    var others = list.filter(function (d) { return !d.current; });
    var body;
    if (state === 'loading') body = '<div class="list">' + [1, 2, 3].map(function () { return '<div class="skel-row"><div class="skeleton" style="width:40px;height:40px;border-radius:var(--r-md)"></div><div style="flex:1"><div class="skeleton" style="height:14px;width:50%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:30%"></div></div></div>'; }).join('') + '</div>';
    else if (state === 'error') body = alertBox('error', 'Couldn\'t load your devices', 'Check your connection and try again.') + '<button type="button" class="btn btn-sm" style="margin-top:.6rem" data-retry>' + icon('refresh', 'icon-sm') + 'Retry</button>';
    else body = '<div class="list">' + list.map(function (d) {
      var name = d.current ? esc(acc.name) + '\'s ' + deviceModel() : esc(d.name), kind = d.current ? (root.dataset.size === 'tablet' ? 'tablet' : 'phone') : d.kind;
      return '<div class="row"><span class="tile">' + icon(kind) + '</span><span class="grow"><b>' + name + '</b><span>' + (d.current ? deviceOs() + ' · Active now' : esc(d.os) + ' · Last active ' + esc(d.last)) + '</span></span>' +
        (d.current ? '<span class="badge badge-success">This device</span>' : '<button type="button" class="btn btn-sm btn-danger" data-out="' + d.id + '">Sign out</button>') + '</div>';
    }).join('') + '</div>' + (others.length ? '' : '<p class="field-hint" style="margin-top:.75rem;text-align:center">Only this device is signed in.</p>');
    return {
      shell: 'account',
      html: '<section class="scr">' + topBar('My devices', 'account') + '<div class="scr-body narrow"><p class="scr-lead" style="margin-top:.25rem">Phones and tablets signed in to your account. A device you sign out needs your PIN and an SMS code to sign in again.</p>' + body +
        (acc.role === 'Owner' ? '<p class="field-hint" style="margin-top:1rem"><span class="badge badge-planned">Module 2</span> Signing out a staff member\'s devices is part of Team.</p>' : '') +
        '</div><div class="scr-foot" style="padding-bottom:104px"><button type="button" class="btn btn-danger btn-block" data-all' + (others.length && state !== 'error' && state !== 'loading' ? '' : ' disabled') + '>Sign out all other devices</button></div></section>',
      mount: function (el) {
        el.querySelectorAll('[data-out]').forEach(function (b) {
          b.addEventListener('click', function () {
            var d = list.filter(function (x) { return x.id === b.dataset.out; })[0];
            dialog({ tone: 'danger', icon: 'logout', title: 'Sign out ' + esc(d.name) + '?', text: 'It will need your PIN and an SMS code to sign in again. Anything unsaved on it stays on that device.',
              actions: [{ label: 'Sign out', kind: 'btn-danger-solid', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.signOutDevice(d.id).then(function () { close(); render(); toast(d.name + ' signed out', true); }, function (e) { close(); toast(netToast(e)); }); } }, { label: 'Cancel' }] });
          });
        });
        var all = el.querySelector('[data-all]'); all.addEventListener('click', allDialog);
        var r = el.querySelector('[data-retry]'); r && r.addEventListener('click', function () { state = 'normal'; render(); });
        if (state === 'popup') allDialog();
        function allDialog() {
          var c = (demo.devices[n] || []).filter(function (d) { return !d.current; }).length;
          dialog({ tone: 'danger', icon: 'alert', title: 'Sign out all other devices?', text: (c || 'All') + ' other device' + (c === 1 ? '' : 's') + ' will be signed out and need your PIN and an SMS code to sign in again. This phone stays signed in.',
            actions: [{ label: 'Sign out ' + (c || 'all'), kind: 'btn-danger-solid', keep: true, fn: function (btn, close) { btn.classList.add('is-loading'); api.signOutOthers().then(function (res) { close(); state = 'normal'; render(); toast(res.removed + ' device' + (res.removed === 1 ? '' : 's') + ' signed out', true); }, function (e) { close(); toast(netToast(e)); }); } }, { label: 'Cancel' }] });
        }
      }
    };
  };

  /* ----- System messages ----- */
  function message(o) {
    return {
      auth: true,
      html: '<section class="scr"><div class="scr-body center-col"><div class="msg-icon ' + (o.tone ? 'is-' + o.tone : '') + '">' + icon(o.icon) + '</div>' +
        '<h2 class="scr-title">' + o.title + '</h2><p class="scr-lead">' + o.text + '</p>' + (o.extra || '') + '</div>' +
        '<div class="scr-foot">' + o.buttons + '</div></section>',
      mount: o.mount
    };
  }
  S.expired = function () {
    if (!demo.draft) { demo.draft = { items: 3 }; demo.session = null; save(); }
    return message({
      icon: 'clock', title: 'Please sign in again', text: 'For your safety, you\'re signed out after 7 days without using the app.',
      extra: '<div class="draft-card"><span class="tile">' + icon('orders') + '</span><div><b>Unsaved bill · 3 items · ₹ 7,450</b><span>Safe on this phone · sample data</span></div></div><p class="field-hint" style="margin-top:.75rem">It comes back as soon as you sign in.</p>',
      buttons: '<button type="button" class="btn btn-primary btn-block" data-go="signin">Sign in</button>'
    });
  };
  S.remote = function () {
    demo.session = null; save();
    return message({
      icon: 'phone', tone: 'warning', title: 'This phone was signed out', text: 'Your account was signed out on this phone from another device. If that wasn\'t you, reset your PIN now.',
      buttons: '<button type="button" class="btn btn-primary btn-block" data-go="signin">Sign in</button><button type="button" class="btn btn-block" data-go="forgot">Reset PIN</button>'
    });
  };
  S.removed = function () {
    demo.session = null; save();
    return message({
      icon: 'alert', tone: 'danger', title: 'Your access has been removed', text: 'The owner removed this account from the Nandam Handlooms team. If you think this is a mistake, please contact the owner.',
      extra: '<div class="facts"><div>' + icon('check') + 'Sign-in keys were removed from this phone</div></div>',
      buttons: '<button type="button" class="btn btn-primary btn-block" data-ok>OK</button>',
      mount: function (el) { el.querySelector('[data-ok]').addEventListener('click', function () { demo.remembered = null; save(); go('signin'); }); }
    });
  };
  S.safety = function () {
    var n = (demo.session && demo.session.number) || (demo.remembered && demo.remembered.number) || '9000000001';
    demo.session = null;
    if (demo.devices[n]) demo.devices[n] = demo.devices[n].filter(function (d) { return d.current; });   // every session on the account ended
    save();
    return message({
      icon: 'shield', tone: 'danger', title: 'Signed out for safety',
      text: 'Your sign-in was used from two places at once, which can mean someone copied it. To protect the shop, we signed you out on every device.',
      extra: '<div class="facts"><div>' + icon('check') + 'Sign in again with your PIN or ' + bioName() + '</div><div>' + icon('check') + 'If you didn\'t expect this, change your PIN after signing in</div><div>' + icon('check') + 'The owner can see this in the Activity log (Module 10)</div></div>',
      buttons: '<button type="button" class="btn btn-primary btn-block" data-go="signin">Sign in</button><button type="button" class="btn btn-block" data-go="forgot">Reset PIN</button>'
    });
  };
  S.offline = function () { return S.signin({}); };

  /* ================= Render ================= */
  function render() {
    timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = [];
    activePad = null; smsFill = null;
    closers = [];
    Array.prototype.slice.call(overlays.children).forEach(function (c) { if (!c.classList.contains('app-toast')) c.remove(); });
    var fn = S[current.name] || S.signin;
    if (SIGNED[current.name] && !demo.session) fn = S.signin;   // signed out a moment ago: never draw a signed-in screen
    var scr = fn(current.params || {});
    var html = scr.html;
    if (scr.shell) html = shell(scr.shell, html);
    else if (scr.auth && root.dataset.size === 'tablet') {
      html = '<div class="auth-split"><div class="auth-brand weave"><div><img class="login-logo" src="assets/logo.png" alt="Nandam Handlooms">' +
        '<h2>Nandam Handlooms Admin</h2><p>Weaving tradition into fashion · Mangalagiri</p></div>' +
        '<ul><li>' + icon('shield') + 'Only people the owner invites can sign in</li><li>' + icon('clock') + 'Stays signed in for 7 days, renewed on use</li><li>' + icon('lock') + 'Your work is never lost on a re-sign-in</li></ul><div class="weave-border"></div></div>' +
        '<div class="auth-main">' + html + '</div></div>';
    }
    viewport.innerHTML = html;
    root.classList.toggle('on-dark', !!scr.dark || false);
    root.classList.toggle('auth-tablet', !!(scr.auth && !scr.shell && root.dataset.size === 'tablet'));
    var el = viewport.querySelector('.scr') || viewport.firstElementChild;
    viewport.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.go); }); });
    scr.mount && scr.mount(el);
    var spec = window.NH_SCREEN(current.name === 'setpin' && current.params.for === 'upgrade' ? 'upgrade' : current.name);
    if (state !== 'normal' && spec && spec.states.indexOf(state) < 0) NH.toast('"' + state + '" isn\'t a state of this screen. Try: ' + (spec.states.join(', ') || 'none'));
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && closers.length) { closers[closers.length - 1](); e.stopPropagation(); return; }
    if (activePad && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target && /input|select|textarea/i.test(e.target.tagName))) activePad(e);
  });

  /* ================= Public API for the mock controls ================= */
  window.NHApp = {
    setState: function (s) { state = s; if (s === 'normal') ui[current.name] = undefined; render(); },
    go: go,
    action: function (name, arg) {
      if (name === 'fill') {
        var pins = { '9000000001': '246810', '9000000002': '1357' };
        var map = { signin: 'signin', activate: 'activate', forgot: 'forgot', offline: 'signin' }, key = map[current.name];
        if (!key) { ui.signin = { number: arg, pin: '', manual: true }; ctx.keepUi = 'signin'; go('signin'); }
        else { ui[key] = ui[key] || {}; ui[key].number = arg; ui[key].manual = true; ui[key].err = null; ui[key].mobileErr = null; render(); }
        toast('Filled +91 ' + fmt(arg) + (pins[arg] ? ' · PIN ' + pins[arg] : ''));
        return;
      }
      if (name === 'expire') { demo.draft = { items: 3 }; demo.session = null; save(); return go('expired'); }
      if (name === 'remote') return go('remote');
      if (name === 'removed') return go('removed');
      if (name === 'stolen') return go('safety');
      if (name === 'signout') { demo.session = null; save(); return go('signin'); }
      if (name === 'reset') { demo = freshDemo(); save(); ui = {}; ctx = {}; return go('splash'); }
    }
  };

  /* ================= Boot ================= */
  function boot() {
    root = document.getElementById('app-root'); viewport = document.getElementById('app'); overlays = document.getElementById('app-overlays');
    if (EMBED) { document.body.className = 'embed'; document.body.innerHTML = ''; document.body.appendChild(root); }
    function syncPlatform() {
      var f = flags(); root.dataset.platform = f.platform;
      var dev = document.getElementById('device'); if (dev) dev.classList.toggle('is-android', f.platform === 'android');
      var sb = root.querySelector('.statusbar .sb-time'); if (sb) sb.textContent = f.platform === 'ios' ? '9:41' : '9:41';
    }
    syncPlatform();
    var size = '';
    function measure() { var s = root.clientWidth >= 700 ? 'tablet' : 'phone'; if (s !== size) { size = s; root.dataset.size = s; if (current.name) render(); } }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root); else window.addEventListener('resize', measure);
    measure();
    document.addEventListener('nh:options', function () { if (current.name) render(); });
    document.addEventListener('nh:flags', function () { syncPlatform(); if (current.name) render(); });
    window.addEventListener('hashchange', onRoute);
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
