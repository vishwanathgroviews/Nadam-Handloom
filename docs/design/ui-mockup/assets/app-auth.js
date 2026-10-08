/* Sign in, create account, OTP, MPIN set-up, forgot and reset MPIN, maintenance page, not found. */
(() => {
  'use strict';
  const N = window.NH;
  const { $, $$, esc, I, STATES, TRIVIAL, maskPhone, prettyPhone, SAMPLE_USER, SHOP } = N;
  const OTP_CODE = '123456', COOLDOWN = 30;

  const field = (id, label, input, err = '', hint = '') => `<div class="field"><label for="${id}">${label}</label>${input}${err ? `<span class="err" id="${id}-err">${esc(err)}</span>` : ''}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const text = (id, attrs = '', bad = false) => `<input class="input${bad ? ' bad' : ''}" id="${id}" name="${id}" ${attrs}>`;
  const alertBad = (b, p = '') => `<div class="alert bad" role="alert">${I.alert}<div><b>${esc(b)}</b>${p ? `<p>${esc(p)}</p>` : ''}</div></div>`;
  const alertOk = (b, p = '') => `<div class="alert ok" role="status">${I.checkCircle}<div><b>${esc(b)}</b>${p ? `<p>${esc(p)}</p>` : ''}</div></div>`;
  const errs = {};     // field errors shown after a submit, cleared on the next render
  const takeErrs = () => { const e = { ...errs }; for (const k in errs) delete errs[k]; return e; };

  const shell = (inner, banner) => `<div class="auth">
    <div class="auth-banner"><img src="img/site/loom.jpg" alt="" loading="lazy"><span class="label">${esc(banner.label)}</span><h2>${banner.h}</h2><p>${esc(banner.p)}</p></div>
    <div class="auth-panel"><div class="auth-form-wrap">${inner}</div></div></div>`;
  const brandRow = () => `<a class="auth-brand" href="#/"><img src="img/site/logo.png" alt="" width="40" height="40"><span class="label">Nandam Handlooms</span></a>`;
  const stateSelect = (id, value = '') => `<select class="input" id="${id}" name="${id}"><option value="">Select a state</option>${STATES.map((s) => `<option${s === value ? ' selected' : ''}>${s}</option>`).join('')}</select>`;
  const pinBoxes = (id, n = 6) => `<div class="pin" id="${id}" data-pin>${Array.from({ length: n }, (_, i) => `<input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit ${i + 1} of ${n}" id="${id}-${i}" autocomplete="one-time-code">`).join('')}</div>`;
  const pinValue = (id) => $$(`#${id} input`).map((i) => i.value).join('');
  const mpinOk = (v) => /^(\d{4}|\d{6})$/.test(v) && !TRIVIAL.has(v);
  const mpinErr = (v) => !/^(\d{4}|\d{6})$/.test(v) ? 'MPIN must be 4 or 6 digits' : TRIVIAL.has(v) ? 'This MPIN is too easy to guess, please choose another' : '';
  const redirectOf = (r) => (r && r !== 'account' ? '#/' + r : '#/account');

  /* ---------- sign in ---------- */
  N.pages.login = {
    title: 'Sign in',
    render(route, UI) {
      const e = takeErrs();
      const top = UI === 'error' ? alertBad('Mobile number or MPIN is incorrect', 'Check both and try again. After 5 wrong tries the account is locked for a while.') : UI === 'warning' ? `<div class="alert warn">${I.alert}<div><b>Your session expired</b><p>Please sign in again to continue to checkout.</p></div></div>` : UI === 'success' ? alertOk('Signed in', 'Taking you back to where you were…') : '';
      return shell(`${brandRow()}<div><h1>Welcome back</h1><p>Sign in with your mobile number and MPIN.</p></div>${top}
        <form class="form" id="login-form" novalidate>
          ${field('login-phone', 'Mobile number', `<div class="input-wrap">${text('login-phone', 'type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" autocomplete="tel-national"', e.phone)}${I.phone}</div>`, e.phone)}
          ${field('login-mpin', `MPIN <a class="link" href="#/forgot-mpin" style="text-transform:none;letter-spacing:.04em;font-size:12px">Forgot MPIN?</a>`, `<div class="input-wrap">${text('login-mpin', 'type="password" inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="current-password"', e.mpin)}${I.key}</div>`, e.mpin)}
          <button class="btn btn-fill btn-block" type="submit">Sign in ${I.arrow}</button>
          <div class="otp-note">${I.info}<div><b>Sample sign-in</b> for this mock: any 10-digit number and any MPIN that is 4 or 6 digits, for example 9876543210 and 2580. <button class="link" type="button" data-act="sample-login">Fill in the sample</button></div></div>
        </form>
        <p class="auth-foot">New here? <a href="#/register${route.a ? '/' + esc(route.a) : ''}">Create an account</a></p>`,
        { label: 'Welcome back', h: 'Your sarees, <em>your way</em>', p: 'Sign in to see your orders, track deliveries and check out faster with saved addresses.' });
    },
    after() { setTimeout(() => $('#login-phone')?.focus(), 150); },
    submit(form) {
      const phone = form['login-phone'].value.replace(/\D/g, ''), mpin = form['login-mpin'].value;
      if (!/^\d{10}$/.test(phone)) errs.phone = 'Enter a valid 10-digit mobile number';
      if (!mpin) errs.mpin = 'MPIN is required'; else if (!/^\d{4,6}$/.test(mpin)) errs.mpin = 'MPIN must be 4 or 6 digits';
      if (Object.keys(errs).length) return N.render(false);
      if (N.UI === 'error') return N.render(false);
      const btn = form.querySelector('[type=submit]'); btn.classList.add('busy'); btn.textContent = 'Signing in…';
      setTimeout(() => { signIn(phone); N.toast('Signed in'); N.go(redirectOf([N.route.a, N.route.b].filter(Boolean).join('/'))); }, 700);
    },
  };
  function signIn(phone) {
    const prof = N.data.profiles[phone];
    N.data.session = prof ? { ...prof } : { ...SAMPLE_USER, phone, sample: true };
    N.persist(); N.renderShell();
  }

  /* ---------- create account ---------- */
  N.pages.register = {
    title: 'Create account',
    render(route, UI) {
      const e = takeErrs();
      const top = UI === 'error' ? alertBad('This mobile number already has an account', 'Sign in instead, or use Forgot MPIN if you cannot remember it.') : '';
      return shell(`${brandRow()}<div><h1>Create account</h1><p>We will send a one-time code by SMS to verify your mobile number.</p></div>${top}
        <form class="form" id="register-form" novalidate>
          <div class="row2">${field('reg-first', 'First name', text('reg-first', 'type="text" placeholder="e.g. Priya" autocomplete="given-name"', e.first), e.first)}${field('reg-last', 'Last name', text('reg-last', 'type="text" placeholder="e.g. Sharma" autocomplete="family-name"', e.last), e.last)}</div>
          ${field('reg-phone', 'Mobile number', `<div class="input-wrap">${text('reg-phone', 'type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" autocomplete="tel-national"', e.phone)}${I.phone}</div>`, e.phone, 'This number receives order updates on WhatsApp or SMS.')}
          <div class="row2">${field('reg-state', 'State', stateSelect('reg-state'), e.state)}${field('reg-pin', 'Pincode', text('reg-pin', 'type="text" inputmode="numeric" maxlength="6" placeholder="e.g. 522503" autocomplete="postal-code"', e.pin), e.pin)}</div>
          <button class="btn btn-fill btn-block" type="submit">Continue ${I.arrow}</button>
          <p class="hint">By continuing you agree to the terms of sale and privacy policy. <span class="sample">Planned</span> Those pages are not written yet.</p>
        </form>
        <p class="auth-foot">Already have an account? <a href="#/login${route.a ? '/' + esc(route.a) : ''}">Sign in</a></p>`,
        { label: 'Join us', h: 'Begin your <em>handloom</em> journey', p: 'An account lets you track every order and keeps your delivery addresses ready for next time.' });
    },
    after() { setTimeout(() => $('#reg-first')?.focus(), 150); },
    submit(form) {
      const v = (k) => form[k].value.trim();
      if (!v('reg-first')) errs.first = 'First name is required';
      if (!v('reg-last')) errs.last = 'Last name is required';
      if (!/^\d{10}$/.test(v('reg-phone'))) errs.phone = 'Enter a valid 10-digit mobile number';
      if (!v('reg-state')) errs.state = 'State is required';
      if (!/^\d{6}$/.test(v('reg-pin'))) errs.pin = 'Pincode must be 6 digits';
      if (Object.keys(errs).length || N.UI === 'error') return N.render(false);
      Object.assign(N.pending, { phone: v('reg-phone'), redirect: [N.route.a, N.route.b].filter(Boolean).join('/'), purpose: 'signup', profile: { first: v('reg-first'), last: v('reg-last'), display: v('reg-first'), phone: v('reg-phone'), state: v('reg-state'), pincode: v('reg-pin'), since: new Date().toISOString().slice(0, 10) } });
      const btn = form.querySelector('[type=submit]'); btn.classList.add('busy'); btn.textContent = 'Sending code…';
      setTimeout(() => N.go('#/otp'), 700);
    },
  };

  /* ---------- one-time code ---------- */
  let cooldownTimer;
  N.pages.otp = {
    title: 'Verify mobile number',
    render(route, UI) {
      const e = takeErrs();
      if (!N.pending.phone && UI !== 'loading') return shell(`${brandRow()}<div><h1>Start again</h1><p>We do not have a mobile number to verify. This happens when the page is opened directly or refreshed.</p></div><div class="acts"><a class="btn btn-fill" href="#/register">Create account</a><a class="btn" href="#/login">Sign in</a></div>`, { label: 'Verify', h: 'One <em>quick</em> step', p: 'A code by SMS confirms the number is yours.' });
      const top = UI === 'error' ? alertBad('That code is not right', 'Check the SMS and try again. A code works for 5 minutes and 5 tries.') : UI === 'warning' ? `<div class="alert warn">${I.clock}<div><b>This code has expired</b><p>Request a new one below.</p></div></div>` : UI === 'success' ? alertOk('Number verified', 'Now choose your MPIN.') : '';
      return shell(`${brandRow()}<div><h1>Verify your number</h1><p>We sent a 6-digit code by SMS to ${prettyPhone(maskPhone(N.pending.phone))}.</p></div>${top}
        <form class="form" id="otp-form" novalidate>
          <div class="field"><span class="lbl" id="otp-lbl">One-time code</span>${pinBoxes('otp')}${e.code ? `<span class="err">${esc(e.code)}</span>` : ''}</div>
          <button class="btn btn-fill btn-block" type="submit">Verify and continue</button>
          <p class="resend">Did not get it? <button class="link" type="button" data-act="resend" id="resend-btn" disabled>Resend code in <span id="cooldown">${COOLDOWN}</span>s</button></p>
          <div class="otp-note">${I.info}<div><b>Sample code</b> for this mock: <b>${OTP_CODE}</b>. On the live site a real SMS is sent.</div></div>
        </form>
        <p class="auth-foot">Wrong number? <a href="#/register">Go back</a></p>`,
        { label: 'Verify', h: 'One <em>quick</em> step', p: 'A code by SMS confirms the number is yours. It never comes over WhatsApp.' });
    },
    after() { startCooldown(); wirePins(); setTimeout(() => $('#otp-0')?.focus(), 150); },
    submit() {
      const code = pinValue('otp');
      if (code.length !== 6) { errs.code = 'Enter the 6-digit code from the SMS'; return N.render(false); }
      if (code !== OTP_CODE || N.UI === 'error') { errs.code = 'That code is not right. Try again.'; return N.render(false); }
      if (N.pending.purpose === 'reset') return N.go('#/reset-mpin');
      N.go('#/mpin-setup');
    },
  };
  function startCooldown() {
    clearInterval(cooldownTimer); let left = COOLDOWN; const btn = $('#resend-btn'); if (!btn) return;
    cooldownTimer = setInterval(() => { left--; const c = $('#cooldown'); if (!c) return clearInterval(cooldownTimer); c.textContent = left; if (left <= 0) { clearInterval(cooldownTimer); btn.disabled = false; btn.textContent = 'Resend code'; } }, 1000);
  }
  N.resendCode = () => { N.toast(`Code sent again to ${maskPhone(N.pending.phone)}`); const btn = $('#resend-btn'); if (btn) { btn.disabled = true; btn.innerHTML = `Resend code in <span id="cooldown">${COOLDOWN}</span>s`; startCooldown(); } };
  function wirePins() {
    $$('[data-pin]').forEach((box) => {
      const inputs = $$('input', box);
      box.addEventListener('input', (e) => { const i = inputs.indexOf(e.target); e.target.value = e.target.value.replace(/\D/g, '').slice(-1); if (e.target.value && inputs[i + 1]) inputs[i + 1].focus(); });
      box.addEventListener('keydown', (e) => { const i = inputs.indexOf(e.target); if (e.key === 'Backspace' && !e.target.value && inputs[i - 1]) inputs[i - 1].focus(); });
      box.addEventListener('paste', (e) => { const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, ''); if (!t) return; e.preventDefault(); inputs.forEach((inp, k) => { inp.value = t[k] || ''; }); inputs[Math.min(t.length, inputs.length) - 1].focus(); });
    });
  }
  N.wirePins = wirePins;

  /* ---------- set MPIN (last step of sign-up) ---------- */
  N.pages['mpin-setup'] = {
    title: 'Set your MPIN',
    render(route, UI) {
      const e = takeErrs();
      if (!N.pending.phone) return shell(`${brandRow()}<div><h1>Start again</h1><p>The verification details are missing. Please create your account again.</p></div><a class="btn btn-fill" href="#/register">Back to create account</a>`, { label: 'Almost there', h: 'Choose your <em>MPIN</em>', p: '' });
      const top = UI === 'error' ? alertBad('Could not set your MPIN', 'The verification has timed out. Please verify your number again.') : '';
      return shell(`${brandRow()}<div><h1>Set your MPIN</h1><p>Choose a 4 or 6 digit MPIN. You will use it to sign in from now on. Easy ones like 1234 or 1111 are not accepted.</p></div>${top}
        <form class="form" id="mpin-form" novalidate>
          ${field('mpin-new', 'New MPIN', text('mpin-new', 'type="password" inputmode="numeric" maxlength="6" class="input input-mpin" placeholder="••••" autocomplete="new-password"', e.mpin), e.mpin)}
          ${field('mpin-confirm', 'Confirm MPIN', text('mpin-confirm', 'type="password" inputmode="numeric" maxlength="6" class="input input-mpin" placeholder="••••" autocomplete="new-password"', e.confirm), e.confirm)}
          <button class="btn btn-fill btn-block" type="submit">Set MPIN and continue</button>
        </form>`,
        { label: 'Almost there', h: 'Choose your <em>MPIN</em>', p: 'A short PIN instead of a password: quick to type on a phone and never sent by SMS.' });
    },
    after() { setTimeout(() => $('#mpin-new')?.focus(), 150); },
    submit(form) {
      const a = form['mpin-new'].value, b = form['mpin-confirm'].value;
      const m = mpinErr(a); if (m) errs.mpin = m; if (a !== b) errs.confirm = 'MPIN and confirmation do not match';
      if (Object.keys(errs).length || N.UI === 'error') return N.render(false);
      const btn = form.querySelector('[type=submit]'); btn.classList.add('busy'); btn.textContent = 'Setting up…';
      setTimeout(() => { const prof = N.pending.profile; if (prof) { N.data.profiles[prof.phone] = prof; } signIn(N.pending.phone); const to = redirectOf(N.pending.redirect); N.pending.phone = ''; N.pending.profile = null; N.toast('Welcome to Nandam Handlooms'); N.go(to); }, 700);
    },
  };

  /* ---------- forgot and reset MPIN ---------- */
  N.pages['forgot-mpin'] = {
    title: 'Forgot MPIN',
    render(route, UI) {
      const e = takeErrs();
      const top = UI === 'error' ? alertBad('We could not send a code', 'Please wait a minute before requesting another one.') : '';
      const pre = N.data.session?.phone || '';
      return shell(`${brandRow()}<div><h1>Forgot your MPIN?</h1><p>Enter your registered mobile number and we will send a code by SMS to reset it.</p></div>${top}
        <form class="form" id="forgot-form" novalidate>
          ${field('forgot-phone', 'Mobile number', `<div class="input-wrap">${text('forgot-phone', `type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" value="${esc(pre)}"`, e.phone)}${I.phone}</div>`, e.phone)}
          <button class="btn btn-fill btn-block" type="submit">Send reset code ${I.arrow}</button>
        </form>
        <p class="auth-foot">Remembered it? <a href="#/login">Sign in</a></p>`,
        { label: 'Reset', h: 'A new MPIN in <em>two steps</em>', p: 'Verify your number by SMS, then choose a new MPIN.' });
    },
    after() { setTimeout(() => $('#forgot-phone')?.focus(), 150); },
    submit(form) {
      const phone = form['forgot-phone'].value.replace(/\D/g, '');
      if (!/^\d{10}$/.test(phone)) { errs.phone = 'Enter a valid 10-digit mobile number'; return N.render(false); }
      if (N.UI === 'error') return N.render(false);
      Object.assign(N.pending, { phone, purpose: 'reset', redirect: '' });
      const btn = form.querySelector('[type=submit]'); btn.classList.add('busy'); btn.textContent = 'Sending…';
      setTimeout(() => N.go('#/otp'), 600);
    },
  };
  N.pages['reset-mpin'] = {
    title: 'Reset MPIN',
    render(route, UI) {
      const e = takeErrs();
      if (UI === 'success' || route.a === 'done') return shell(`${brandRow()}<div style="text-align:center;display:grid;gap:14px;justify-items:center"><svg class="ok-mark" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M30 52l13 13 27-30"/></svg><h1>MPIN reset</h1><p>Your MPIN has been updated. Sign in with the new one.</p><a class="btn btn-fill" href="#/login">Back to sign in</a></div>`, { label: 'Done', h: 'All <em>set</em>', p: '' });
      if (!N.pending.phone) return shell(`${brandRow()}<div><h1>Start again</h1><p>We do not have a mobile number for this reset. Please request a code first.</p></div><a class="btn btn-fill" href="#/forgot-mpin">Request a reset code</a>`, { label: 'Reset', h: 'A new MPIN in <em>two steps</em>', p: '' });
      const top = UI === 'error' ? alertBad('Could not reset your MPIN', 'The code has expired. Request a new one.') : '';
      return shell(`${brandRow()}<div><h1>Choose a new MPIN</h1><p>Your number ${prettyPhone(maskPhone(N.pending.phone))} is verified. Pick a 4 or 6 digit MPIN.</p></div>${top}
        <form class="form" id="reset-form" novalidate>
          ${field('reset-new', 'New MPIN', text('reset-new', 'type="password" inputmode="numeric" maxlength="6" class="input input-mpin" placeholder="••••" autocomplete="new-password"', e.mpin), e.mpin)}
          ${field('reset-confirm', 'Confirm new MPIN', text('reset-confirm', 'type="password" inputmode="numeric" maxlength="6" class="input input-mpin" placeholder="••••" autocomplete="new-password"', e.confirm), e.confirm)}
          <button class="btn btn-fill btn-block" type="submit">Reset MPIN</button>
        </form>`,
        { label: 'Reset', h: 'A new MPIN in <em>two steps</em>', p: 'Verify your number by SMS, then choose a new MPIN.' });
    },
    after() { setTimeout(() => $('#reset-new')?.focus(), 150); },
    submit(form) {
      const a = form['reset-new'].value, b = form['reset-confirm'].value;
      const m = mpinErr(a); if (m) errs.mpin = m; if (a !== b) errs.confirm = 'MPIN and confirmation do not match';
      if (Object.keys(errs).length || N.UI === 'error') return N.render(false);
      const btn = form.querySelector('[type=submit]'); btn.classList.add('busy'); btn.textContent = 'Updating…';
      setTimeout(() => { N.pending.phone = ''; N.go('#/reset-mpin/done'); }, 700);
    },
  };

  /* ---------- maintenance and not found ---------- */
  N.pages.maintenance = {
    title: 'We’ll be back soon',
    render(route, UI) {
      return `<div class="gate-page"><div class="card"><div class="ring-icon">${I.wrench}</div><span class="label gold">Nandam Handlooms</span><h1>We’ll be back soon</h1><p>${UI === 'warning' ? 'Dasara stock is being added to the shop. Please visit again this evening.' : 'We are making a few improvements to the shop. Please visit again in a little while.'}</p><p class="note">The owner switches this page on from the staff app under App settings, with their own message. ${UI === 'warning' ? '<span class="sample">Sample message</span>' : 'This is the default message.'}</p><button class="btn btn-fill" type="button" data-act="try-again" id="try-again">${UI === 'loading' ? 'Checking…' : 'Try again'}</button></div></div>`;
    },
  };
  N.pages['not-found'] = {
    title: 'Page not found',
    render() {
      return `<div class="gate-page"><div class="card"><div class="ring-icon">${I.search}</div><h1>We could not find that page</h1><p>The link may be old, or the saree may have been sold. The live site sends unknown links to the home page; this mock shows this page instead so a broken link is noticed.</p><div class="acts" style="justify-content:center"><a class="btn btn-fill" href="#/">Go to the home page</a><a class="btn" href="#/shop">Browse sarees</a></div></div></div>`;
    },
  };
})();
