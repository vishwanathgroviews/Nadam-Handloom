/* Real-browser check of the W6 checkout mock-up (Playwright): every screen and state at laptop
   and phone widths, light and dark; the main paths (sign in → address → review → pay → paid;
   failed, closed, bank slow; new and corrected addresses); every lettered option; page errors,
   sideways scrolling, names of buttons and pictures, one heading per page.

   python3 -m http.server 8765 --bind 127.0.0.1   (in docs/design/ui-mockup)
   NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-6-checkout/build/check.cjs */
const { chromium, webkit } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.NH_BASE || 'http://127.0.0.1:8765/web-6-checkout/';
const OUT = process.env.NH_SHOTS || path.join(__dirname, '..', 'out');
const ENGINE = process.env.NH_ENGINE || 'chromium';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const ROUNDS = (process.env.NH_ROUNDS || '1440-light,390-dark,390-light,1440-dark').split(',');
const SHOTS = process.env.NH_NO_SHOTS !== '1';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0; const fails = [];
function ok(cond, what) { if (cond) pass += 1; else { fails.push(what); console.log('  FAIL', what); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// WebKit can hang on closing a tab (Playwright, not the page): give it 5 seconds, then move on.
const shut = (x) => Promise.race([x.close().catch(() => {}), sleep(5000)]);

const CO_STATES = ['signedout', 'address', 'newaddr', 'fixaddr', 'review', 'paying', 'confirming', 'failed', 'closed', 'expired', 'changed', 'offline', 'inapp', 'empty'];
const ORDER_STATES = ['paid', 'bankslow', 'refunded'];
const PAGES = ['#/bag?state=normal', '#/shipping', '#/refunds', '#/contact', '#/sign-in?next=checkout'];

async function fresh(ctx, theme, extra) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(([t, e]) => {
    if (!sessionStorage.getItem('nh-init')) {
      localStorage.clear();
      localStorage.setItem('w6mock.opts.v1', JSON.stringify(Object.assign({ theme: t }, e || {})));
      sessionStorage.setItem('nh-init', '1');
    }
  }, [theme, extra || null]);
  return page;
}
async function noSideways(page, what) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  ok(r.sw <= r.w + 1, `${what}: no sideways scroll (${r.sw} > ${r.w})`);
}
async function names(page, what) {
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a[href]').forEach((el) => {
      if (el.closest('.mo-panel, .mo-fab')) return;
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
      const n = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (!n && el.getAttribute('aria-hidden') !== 'true' && el.getAttribute('tabindex') !== '-1') out.push(el.outerHTML.slice(0, 80));
    });
    document.querySelectorAll('img').forEach((im) => { if (!im.hasAttribute('alt')) out.push('img without alt ' + im.src.slice(-30)); });
    document.querySelectorAll('input:not([type=hidden]), select').forEach((el) => {
      if (el.closest('.mo-panel') || el.offsetParent === null) return;
      if (!(el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label'))) out.push('unlabelled ' + el.outerHTML.slice(0, 60));
    });
    return out;
  });
  ok(bad.length === 0, `${what}: every button/link named, pictures have alt, fields labelled (${bad.slice(0, 2).join(' | ')})`);
  const h1 = await page.locator('main h1').count();
  ok(h1 === 1, `${what}: one h1 (found ${h1})`);
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }); }
async function settle(page) { await page.waitForTimeout(600); }

async function round(browser, spec) {
  const [w, theme] = spec.split('-');
  const width = Number(w), phone = width < 600;
  console.log(`\n== ${ENGINE} ${width} ${theme}`);
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone && ENGINE === 'chromium' });
  const tag = `${ENGINE}-${width}-${theme}`;
  let page = await fresh(ctx, theme);

  for (const p of ['index.html', 'kit.html', 'preview.html']) {
    await page.goto(BASE + p); await settle(page);
    await noSideways(page, `${p} ${tag}`); if (p !== 'preview.html') await names(page, `${p} ${tag}`);
    await shot(page, `${tag}-${p.replace('.html', '')}`);
  }
  for (const h of PAGES) { await page.goto(BASE + 'site.html' + h); await settle(page); await noSideways(page, `${h} ${tag}`); await names(page, `${h} ${tag}`); await shot(page, `${tag}-${h.replace(/[#/?=]/g, '_')}`); }
  for (const st of CO_STATES) {
    await page.goto(`${BASE}site.html#/checkout?state=${st}`); await settle(page);
    await noSideways(page, `checkout ${st} ${tag}`);
    if (!['paying', 'confirming'].includes(st)) await names(page, `checkout ${st} ${tag}`);
    await shot(page, `${tag}-co-${st}`);
  }
  for (const st of ORDER_STATES) {
    await page.goto(`${BASE}site.html#/order/NH48213097?state=${st}`); await settle(page);
    await noSideways(page, `order ${st} ${tag}`); await names(page, `order ${st} ${tag}`); await shot(page, `${tag}-order-${st}`);
  }
  ok(page.errors.length === 0, `no page errors on the screens ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // The whole path: bag → Checkout → sign in → address → review → Pay → paid.
  page = await fresh(ctx, theme);
  await page.goto(BASE + 'site.html#/bag?state=normal'); await settle(page);
  const before = Number(await page.locator('.hdr .bag-n').innerText());
  await page.locator('.sum [data-act="checkout"]').click(); await settle(page);
  ok(await page.getByText('Sign in to check out').first().isVisible(), 'not signed in: asked to sign in');
  await page.locator('main a', { hasText: 'Sign in' }).first().click(); await settle(page);
  ok(/next=checkout/.test(page.url()), 'the sign-in page knows to come back');
  await page.locator('[data-act="signin"]').click(); await settle(page);
  ok(/#\/checkout/.test(page.url()), 'signed in: straight back to checkout');
  ok(await page.locator('.ad-card.is-on').count() >= 1, 'the default address is chosen');
  ok(await page.locator('[data-act="co-pay"]').first().isDisabled(), 'Pay waits until the address is chosen');
  await page.locator('[data-act="co-deliver"]').click(); await settle(page);
  ok(await page.locator('.co-step.is-done').count() === 1, 'address step done');
  ok(await page.locator('.co-lines li').count() >= 2, 'review lists the sarees');
  ok(/IGST 5%/.test(await page.locator('.co-sum .tax').innerText()), 'delivery to Telangana: IGST line');
  await shot(page, `${tag}-flow-review`);
  await page.locator('.co-sum [data-act="co-pay"]').click();
  await page.waitForSelector('.modal-box.rzp');
  ok(await page.locator('.rz-stand').isVisible(), 'Razorpay window opens (stand-in, labelled)');
  await page.locator('[data-act="rzp-tab"][data-v="card"]').click();
  ok(await page.locator('#rz-c').isVisible(), 'card tab');
  await shot(page, `${tag}-flow-rzp`);
  await page.locator('[data-act="rzp-success"]').click();
  ok(await page.locator('.modal-box.conf').isVisible(), 'confirming the payment');
  await page.waitForURL(/#\/order\/NH\d{8}\?state=paid/, { timeout: 5000 });
  await settle(page);
  ok(/Thank you, Priya/.test(await page.locator('main h1').innerText()), 'order confirmed page');
  ok(/NH\d{8}/.test(await page.locator('.ord-hero').innerText()), 'shows the order number');
  const after = (await page.locator('.hdr .bag-n').count()) ? Number(await page.locator('.hdr .bag-n').innerText()) : 0;
  ok(after < before, `paid sarees left the bag (${before} → ${after})`);
  await shot(page, `${tag}-flow-paid`);

  // Failed, then try again (the same order and hold); then closed, then change the bag.
  await page.goto(BASE + 'site.html#/checkout?state=review'); await settle(page);
  await page.locator('.co-sum [data-act="co-pay"]').click(); await page.waitForSelector('.modal-box.rzp');
  await page.locator('[data-act="rzp-fail"]').click();
  ok(await page.locator('.modal-box.rzp .alert-bad').isVisible(), 'failure shown inside the window');
  await page.locator('.rz-top [data-act="rzp-close"]').click(); await settle(page);
  ok(/Payment didn.t go through/.test(await page.locator('.co-notes').innerText()), 'failed: "Nothing was taken" on the page');
  const held1 = await page.locator('.co-sum .hold-line').innerText();
  await page.locator('.co-notes [data-act="co-pay"]').click(); await page.waitForSelector('.modal-box.rzp');
  await page.locator('.rz-mock [data-act="rzp-close"]').click(); await settle(page);
  ok(/Payment not completed/.test(await page.locator('.co-notes').innerText()), 'closed: "Payment not completed"');
  ok((await page.locator('.co-sum .hold-line').innerText()) === held1, 'paying again kept the same hold');
  await page.locator('[data-act="co-change-bag"]').click(); await settle(page);
  ok(/#\/bag/.test(page.url()), '"Change my bag" goes back to the bag');

  // Bank slow.
  await page.goto(BASE + 'site.html#/checkout?state=review'); await settle(page);
  await page.locator('.co-sum [data-act="co-pay"]').click(); await page.waitForSelector('.modal-box.rzp');
  await page.locator('[data-act="rzp-slow"]').click(); await settle(page);
  ok(/confirming with your bank/i.test(await page.locator('main h1').innerText()), 'bank slow: confirming page');

  // A new address (refused when empty), and an old one to correct.
  await page.goto(BASE + 'site.html#/checkout?state=address'); await settle(page);
  await page.locator('[data-act="co-add-new"]').click();
  await page.locator('[data-act="co-save-addr"]').click();
  ok(await page.locator('.toast.bad', { hasText: 'Enter the house' }).isVisible(), 'empty address refused');
  await page.fill('#af-1', 'Door 7-12, Temple Street'); await page.fill('#af-l', 'Opposite the bus stand');
  await page.locator('[data-act="co-save-addr"]').click(); await settle(page);
  ok(/Temple Street/.test(await page.locator('.co-step.is-done').innerText()), 'new address saved and chosen');
  await page.goto(BASE + 'site.html#/checkout?state=fixaddr'); await settle(page);
  ok(await page.getByText('Please check this address').isVisible(), 'old address: asked to check it');
  await page.locator('[data-act="co-save-addr"]').click();
  ok(await page.locator('.toast.bad', { hasText: 'Choose the state' }).isVisible(), 'old address: state required');
  await page.selectOption('#af-s', 'Andhra Pradesh');
  await page.locator('[data-act="co-save-addr"]').click(); await settle(page);
  ok(/CGST 2.5% \+ SGST 2.5%/.test(await page.locator('.co-sum .tax').innerText()), 'delivery in Andhra Pradesh: CGST + SGST');
  ok(page.errors.length === 0, `no page errors in the paths ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // Every lettered option.
  page = await fresh(ctx, theme);
  const set = (k, v) => page.evaluate(([a, b]) => window.W5Opts.set(a, b), [k, v]);
  await page.goto(BASE + 'site.html#/checkout?state=review'); await settle(page);
  await set('colayout', 'b'); await settle(page);
  ok(await page.locator('.co-prog').isVisible(), '6.1 B: progress bar');
  ok(await page.locator('.co-sum [data-act="co-pay"]').isDisabled(), '6.1 B: Pay after "Continue to payment"');
  await page.locator('[data-act="co-to-pay"]').click(); await settle(page);
  ok(await page.locator('.co-sum [data-act="co-pay"]').isEnabled(), '6.1 B: Pay ready on step 3');
  await shot(page, `${tag}-opt-layout-b`);
  await set('colayout', 'c'); await page.goto(BASE + 'site.html#/checkout?state=address'); await settle(page);
  ok(await page.locator('.co-sum [data-act="co-pay"]').isEnabled(), '6.1 C: everything on one page, Pay ready');
  await set('colayout', 'a');
  await set('signin', 'b'); await page.goto(BASE + 'site.html#/checkout?state=signedout'); await settle(page);
  ok(await page.locator('[data-act="co-signin-inline"]').isVisible(), '6.2 B: sign in inside checkout');
  await page.locator('[data-act="co-signin-inline"]').click(); await settle(page);
  ok(await page.locator('[data-act="co-deliver"]').isVisible(), '6.2 B: then the address');
  await set('signin', 'a');
  await page.goto(BASE + 'site.html#/checkout?state=address'); await settle(page);
  await set('addr', 'b'); await settle(page); ok(await page.locator('.ad-list.compact').isVisible(), '6.3 B: compact list');
  await set('addr', 'c'); await settle(page); ok(await page.locator('select[data-change="co-addr"]').isVisible(), '6.3 C: drop-down');
  await page.selectOption('select[data-change="co-addr"]', 'a2'); await settle(page);
  ok(/Vijayawada/.test(await page.locator('.ad-card.is-on').innerText()), '6.3 C: choosing works');
  await set('addr', 'a');
  await page.goto(BASE + 'site.html#/bag?state=normal'); await settle(page);
  await set('bagbtn', 'b'); await settle(page); ok(await page.locator('.sum .two-eq').isVisible(), '6.4 B: both buttons');
  await set('bagbtn', 'c'); await settle(page); ok((await page.locator('.sum .acts .btn').first().getAttribute('data-act')) === 'wa', '6.4 C: WhatsApp first');
  await set('bagbtn', 'a'); await settle(page); ok(await page.locator('.sum .wa-link').isVisible(), '6.4 A: WhatsApp as a small link');
  await page.goto(BASE + 'site.html#/checkout?state=closed'); await settle(page);
  await set('hold', 'b'); await settle(page); ok(/\d+:\d\d left/.test(await page.locator('.co-sum .hold-line').innerText()), '6.5 B: countdown');
  await set('hold', 'c'); await settle(page); ok(await page.locator('.co-sum .hold-line').count() === 0, '6.5 C: not shown');
  await set('hold', 'a');
  await set('confirm', 'b'); await page.goto(BASE + 'site.html#/order/NH48213097?state=paid'); await settle(page);
  ok(await page.locator('.ord-receipt').isVisible(), '6.6 B: compact receipt');
  await set('confirm', 'a');
  if (phone) {
    await page.goto(BASE + 'site.html#/checkout?state=review'); await settle(page);
    ok(await page.locator('.pay-bar').isVisible(), '6.7 A: pay bar on phones');
    await set('paybar', 'b'); await settle(page); ok(!(await page.locator('.pay-bar').isVisible()), '6.7 B: no pay bar');
    await set('paybar', 'a');
  }
  await page.goto(BASE + 'site.html#/checkout?state=review'); await settle(page);
  await page.locator('.mo-fab').click();
  ok(await page.locator('.mo-panel').isVisible(), 'Design options panel opens');
  await page.locator('.mo-panel [data-mo-state="failed"]').click(); await settle(page);
  ok(/state=failed/.test(page.url()), 'panel: screen state buttons work');
  const text = await page.evaluate(() => window.W5Opts.choicesText());
  ok(/6\.1 Checkout layout: A Two steps on one page/.test(text) && /6\.7 Pay on phones: A Bar at the bottom/.test(text), 'choices text lists the picks');
  await page.keyboard.press('Escape');
  ok(!(await page.locator('.mo-panel').isVisible()), 'Escape closes the panel');
  ok(page.errors.length === 0, `no page errors with options ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);
  await Promise.race([ctx.close().catch(() => {}), sleep(5000)]);
}

(async () => {
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  try { for (const r of ROUNDS) await round(browser, r); } finally { await Promise.race([browser.close(), sleep(5000)]); }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
