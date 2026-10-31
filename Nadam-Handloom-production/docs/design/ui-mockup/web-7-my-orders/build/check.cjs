/* Real-browser check of the W7 My orders mock-up (Playwright): every screen and state at laptop
   and phone widths, light and dark; the main paths (My account → My orders → one order; Show more;
   Copy, Track, Invoice, Buy again; Try again; signed out → sign in → back); every lettered option;
   page errors, sideways scrolling, names of buttons and pictures, one heading per page.

   python3 -m http.server 8765 --bind 127.0.0.1   (in docs/design/ui-mockup)
   NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-7-my-orders/build/check.cjs */
const { chromium, webkit } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.NH_BASE || 'http://127.0.0.1:8765/web-7-my-orders/';
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

const LIST_STATES = ['normal', 'empty', 'loading', 'error', 'notify'];
const ORDER_STATES = [['NH48213097', 'packing'], ['NH47106255', 'shipped'], ['NH46339810', 'delivered'], ['NH49011876', 'held'], ['NH48213097', 'bankslow'],
  ['NH45902114', 'refunded'], ['NH44871203', 'shopcancel'], ['NH38800121', 'oldsite'], ['NH46339810', 'buyagain'], ['NH00000000', 'notfound'], ['NH48213097', 'paid']];
const PAGES = ['#/account?state=normal', '#/bag?state=normal', '#/checkout?state=review'];

async function fresh(ctx, theme, extra) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(([t, e]) => {
    if (!sessionStorage.getItem('nh-init')) {
      localStorage.clear();
      localStorage.setItem('w7mock.opts.v1', JSON.stringify(Object.assign({ theme: t }, e || {})));
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
  if (ENGINE === 'chromium') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
  let page = await fresh(ctx, theme);

  for (const p of ['index.html', 'kit.html', 'preview.html']) {
    await page.goto(BASE + p); await settle(page);
    if (p === 'index.html') ok((await page.locator('#screens .scr').count()) === 19, `start page lists the 19 screens ${tag}`);
    await noSideways(page, `${p} ${tag}`); if (p !== 'preview.html') await names(page, `${p} ${tag}`);
    await shot(page, `${tag}-${p.replace('.html', '')}`);
  }
  for (const h of PAGES) { await page.goto(BASE + 'site.html' + h); await settle(page); await noSideways(page, `${h} ${tag}`); await names(page, `${h} ${tag}`); await shot(page, `${tag}-${h.replace(/[#/?=]/g, '_')}`); }
  for (const st of LIST_STATES) {
    await page.goto(`${BASE}site.html#/account/orders?state=${st}`); await settle(page);
    await noSideways(page, `orders ${st} ${tag}`); await names(page, `orders ${st} ${tag}`); await shot(page, `${tag}-orders-${st}`);
  }
  for (const [n, st] of ORDER_STATES) {
    await page.goto(`${BASE}site.html#/order/${n}?state=${st}`); await settle(page);
    await noSideways(page, `order ${st} ${tag}`); await names(page, `order ${st} ${tag}`); await shot(page, `${tag}-order-${st}`);
  }
  ok(page.errors.length === 0, `no page errors on the screens ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // What each order shows.
  page = await fresh(ctx, theme);
  const main = () => page.locator('main').innerText();
  await page.goto(`${BASE}site.html#/order/NH48213097?state=packing`); await settle(page);
  ok(/Order NH48213097/.test(await page.locator('main h1').innerText()), 'packing: the order number is the title');
  ok((await page.locator('.otrack li.done').count()) === 1 && (await page.locator('.otrack li[aria-current="step"]').count()) === 1, 'packing: Paid done, Packed is the current step');
  ok(await page.locator('.trk').count() === 0, 'packing: no tracking yet');
  ok(await page.locator('[data-act="o-inv"]').isVisible() && await page.locator('.oacts [data-act="o-buy"]').isVisible(), 'packing: invoice and buy again');
  ok(/Need to cancel or change something\?/.test(await main()), 'packing: cancel or change on WhatsApp (7.10 parked)');
  ok(await page.locator('main [data-act="o-cancel"]').count() === 0, 'no Cancel button (7.10 parked)');
  await page.goto(`${BASE}site.html#/order/NH47106255?state=shipped`); await settle(page);
  ok((await page.locator('.otrack li.done').count()) === 3, 'shipped: three steps done');
  ok(/D7348812905/.test(await page.locator('.trk .awb').innerText()), 'shipped: the tracking number');
  await page.locator('.trk [data-act="o-track"]').click();
  ok(await page.locator('.toast', { hasText: 'DTDC' }).first().isVisible(), 'Track on DTDC says what opens');
  await page.locator('.trk [data-act="o-copy"]').click();
  const copied = ENGINE === 'chromium' ? /Tracking number D7348812905 copied/ : /copied|Couldn.t copy/; // Chromium gets the clipboard permission
  ok(await page.locator('.toast', { hasText: copied }).first().waitFor({ timeout: 3000 }).then(() => true, () => false), 'Copy puts the number on the clipboard');
  if (ENGINE === 'chromium') ok((await page.evaluate(() => navigator.clipboard.readText())) === 'D7348812905', 'the clipboard has the number');
  await page.goto(`${BASE}site.html#/order/NH46339810?state=delivered`); await settle(page);
  ok((await page.locator('.otrack li.done').count()) === 4, 'delivered: every step done');
  ok(/Delivered/.test(await page.locator('.trk').innerText()), 'delivered: the date on the tracking card');
  await page.goto(`${BASE}site.html#/order/NH49011876?state=held`); await settle(page);
  ok(/held for you until/.test(await page.locator('.alert').first().innerText()), 'held: held until a time');
  ok(await page.locator('[data-act="o-inv"]').count() === 0 && await page.locator('[data-act="o-buy"]').count() === 0, 'held: no invoice, no buy again');
  ok(await page.locator('.otrack').count() === 0, 'held: no progress line');
  await page.goto(`${BASE}site.html#/order/NH44871203?state=shopcancel`); await settle(page);
  ok(/is being refunded/.test(await page.locator('.alert').first().innerText()) && !/Nothing was charged/.test(await main()), 'cancelled by the shop: refund on its way, never "Nothing was charged"');
  ok(/CANCELLED/.test(await main()), 'cancelled by the shop: invoice stamped CANCELLED');
  await page.goto(`${BASE}site.html#/order/NH45902114?state=refunded`); await settle(page);
  ok(/is being refunded/.test(await page.locator('.alert').first().innerText()), 'refunded: why and how much');
  await page.goto(`${BASE}site.html#/order/NH38800121?state=oldsite`); await settle(page);
  ok(/old website/.test(await main()), 'old website order: says so');
  await page.goto(`${BASE}site.html#/order/NH00000000?state=notfound`); await settle(page);
  ok(/couldn.t find this order/.test(await main()), 'not found');
  await page.goto(`${BASE}site.html#/order/NH12345678`); await settle(page);
  ok(/couldn.t find this order/.test(await main()), 'an unknown number: not found');
  ok(page.errors.length === 0, `no page errors on the orders ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // The path: My account → My orders → Show more → one order → Buy again; Try again; signed out.
  page = await fresh(ctx, theme);
  await page.goto(`${BASE}site.html#/account?state=normal`); await settle(page);
  ok(await page.locator('.acct nav a', { hasText: 'My orders' }).isVisible(), '7.1 A: a My orders tab');
  ok(/NH49011876/.test(await page.locator('.latest').innerText()), 'overview: the latest order');
  await page.locator('.acct nav a', { hasText: 'My orders' }).click(); await settle(page);
  ok(/#\/account\/orders/.test(page.url()), 'the tab opens My orders');
  ok((await page.locator('.ocard').count()) === 5, 'the first 5 orders, then Show more');
  ok(!/NH-?abandon/i.test(await main()), 'no abandoned checkout listed');
  await page.locator('[data-act="o-more"]').click(); await settle(page);
  ok((await page.locator('.ocard').count()) === 7, 'Show more: all 7 orders');
  ok(/That.s all 7 orders/.test(await main()), 'the end of the list says so');
  ok(await page.evaluate(() => !!document.activeElement.closest('.ocard')), 'Show more: the focus moves to the first new order');
  await page.locator('.ocard', { hasText: 'NH46339810' }).locator('a', { hasText: 'View order' }).click(); await settle(page);
  ok(/NH46339810/.test(await page.locator('main h1').innerText()), 'View order opens it');
  const bagBefore = (await page.locator('.hdr .bag-n').count()) ? Number(await page.locator('.hdr .bag-n').innerText()) : 0;
  await page.locator('.oacts [data-act="o-buy"]').click(); await settle(page);
  ok(await page.locator('.toast', { hasText: /2 sarees added.*1 sold since/ }).first().isVisible(), 'buy again: says what was added and what sold');
  ok(await page.locator('.drawer').isVisible(), 'buy again: the bag panel opens');
  const bagAfter = Number(await page.locator('.hdr .bag-n').innerText());
  ok(bagAfter > bagBefore, `buy again: the bag grew (${bagBefore} → ${bagAfter})`);
  await page.keyboard.press('Escape'); await settle(page);
  await page.goto(`${BASE}site.html#/account/orders?state=error`); await settle(page);
  ok(!/No orders yet/.test(await main()), 'couldn\'t load: never "No orders yet"');
  await page.locator('[data-act="o-retry"]').click();
  await page.waitForURL(/state=normal/, { timeout: 4000 }); await settle(page);
  ok((await page.locator('.ocard').count()) >= 1, 'Try again loads the list');
  await page.goto(`${BASE}site.html#/account/orders?state=notify`); await settle(page);
  await page.locator('.notif-demo').click(); await settle(page);
  ok(/NH47106255/.test(await page.locator('main h1').innerText()), 'the notification opens the shipped order');
  await page.locator('.acct-link').click(); await settle(page);
  await page.locator('.acct nav [data-act="signout"]').click(); await settle(page);
  await page.goto(`${BASE}site.html#/account/orders`); await settle(page);
  ok(/Sign in/.test(await page.locator('main h1').innerText()), 'signed out: My orders asks to sign in');
  await page.locator('[data-act="signin"]').click(); await settle(page);
  ok(/#\/account\/orders/.test(page.url()) && /My orders/.test(await page.locator('main h1').innerText()), 'signed in: back on My orders');
  ok(page.errors.length === 0, `no page errors in the paths ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // Every lettered option.
  page = await fresh(ctx, theme);
  const set = (k, v) => page.evaluate(([a, b]) => window.W5Opts.set(a, b), [k, v]);
  await page.goto(`${BASE}site.html#/account/orders?state=normal`); await settle(page);
  await set('olist', 'b'); await settle(page);
  ok((await page.locator('.orows .orow').count()) === 5, '7.2 B: compact rows'); await noSideways(page, `7.2 B ${tag}`); await shot(page, `${tag}-opt-list-b`);
  await set('olist', 'c'); await settle(page);
  ok((await page.locator('.omonth').count()) >= 2, '7.2 C: by month'); await shot(page, `${tag}-opt-list-c`);
  await set('olist', 'a');
  await set('owhich', 'b'); await settle(page);
  ok(await page.locator('.ocard.bill').isVisible(), '7.5 B: the shop bill shows'); await names(page, `7.5 B ${tag}`);
  await set('owhich', 'a'); await settle(page);
  ok(await page.locator('.ocard.bill').count() === 0, '7.5 A: no shop bills');
  await set('ounpaid', 'b'); await settle(page);
  ok(!/NH49011876/.test(await main()), '7.9 B: the unpaid checkout is not shown');
  await set('ounpaid', 'a'); await settle(page);
  ok(/NH49011876/.test(await main()), '7.9 A: shown while held');
  await set('oplace', 'b'); await settle(page);
  ok(await page.locator('.acct nav a', { hasText: 'My orders' }).count() === 0, '7.1 B: no tab in My account');
  await page.goto(`${BASE}site.html#/orders?state=normal`); await settle(page);
  ok(/My orders/.test(await page.locator('main h1').innerText()) && await page.locator('.acct').count() === 0, '7.1 B: its own page');
  await set('oplace', 'a');
  await page.goto(`${BASE}site.html#/order/NH47106255?state=shipped`); await settle(page);
  await set('odetail', 'b'); await settle(page);
  ok(await page.locator('.ord-2col').isVisible(), '7.3 B: two columns'); await noSideways(page, `7.3 B ${tag}`); await shot(page, `${tag}-opt-detail-b`);
  await set('odetail', 'a');
  await set('otrack', 'b'); await settle(page);
  ok(await page.locator('.trk-plain').isVisible() && await page.locator('.trk').count() === 0, '7.4 B: the number only');
  await set('otrack', 'a');
  await page.goto(`${BASE}site.html#/order/NH46339810?state=delivered`); await settle(page);
  await set('obuy', 'b'); await settle(page);
  ok((await page.locator('[data-act="o-addone"]').count()) === 2 && /Sold out now/.test(await main()), '7.7 B: each saree, sold ones say so');
  await page.locator('[data-act="o-addone"]').first().click(); await settle(page);
  ok(await page.locator('.drawer').isVisible() || await page.locator('.toast').count() > 0, '7.7 B: adding one saree works');
  await page.keyboard.press('Escape');
  await set('obuy', 'c'); await settle(page);
  ok(await page.locator('[data-act="o-buy"], [data-act="o-addone"]').count() === 0, '7.7 C: not offered');
  await set('obuy', 'a');
  await page.locator('.mo-fab').click();
  ok(await page.locator('.mo-panel').isVisible(), 'Design options panel opens');
  await page.locator('.mo-panel [data-mo-state="shipped"]').click(); await settle(page);
  ok(/NH47106255\?state=shipped/.test(page.url()), 'panel: a state opens its own sample order');
  const text = await page.evaluate(() => window.W5Opts.choicesText());
  ok(/7\.1 Where My orders is: A A tab in My account/.test(text) && /7\.9 An unpaid checkout: A Shown while held/.test(text), 'choices text lists the picks');
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
