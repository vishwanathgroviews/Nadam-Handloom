/* Real-browser check of the W5 bag mock-up (Playwright). Every screen and state at laptop and
   phone widths, light and dark; the main flows; page errors; sideways scrolling; names of
   buttons and pictures. Screenshots go to NH_SHOTS (default: ./out, not committed).

   python3 -m http.server 8765 --bind 127.0.0.1   (in docs/design/ui-mockup)
   NODE_PATH=../../../../Nadam-frontend/customer-web/node_modules node build/check.cjs
   Safari's engine: NH_ENGINE=webkit WEBKIT_PATH=~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh … */
const { chromium, webkit } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.NH_BASE || 'http://127.0.0.1:8765/web-5-bag/';
const OUT = process.env.NH_SHOTS || path.join(__dirname, '..', 'out');
const ENGINE = process.env.NH_ENGINE || 'chromium';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const ROUNDS = (process.env.NH_ROUNDS || '1440-light,390-dark,390-light,1440-dark').split(',');
const SHOTS = process.env.NH_NO_SHOTS !== '1';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0; const fails = [];
function ok(cond, what) { if (cond) pass += 1; else { fails.push(what); console.log('  FAIL', what); } }

const STATES_BAG = ['normal', 'empty', 'loading', 'problems', 'offline', 'error', 'whatsapp', 'sent', 'clear', 'remove', 'oldbag', 'merged', 'signedout', 'nostore'];
const PRODUCTS = ['pure-pattu-350k-butta-saree-34', '150-50-plain-saree-7', '350k-butta-saree-3', 'real-tanjore-painted-dress-material-13'];
const STATES_PDP = ['default', 'added', 'inbag', 'adding', 'bagfull'];

async function fresh(ctx, theme, extra) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(([t, e]) => {
    if (!sessionStorage.getItem('nh-init')) {
      localStorage.clear();
      localStorage.setItem('w5mock.opts.v1', JSON.stringify(Object.assign({ theme: t }, e || {})));
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
    return out;
  });
  ok(bad.length === 0, `${what}: every button/link named, every picture has alt (${bad.slice(0, 2).join(' | ')})`);
  const h1 = await page.locator('h1').count();
  ok(h1 === 1, `${what}: one h1 (found ${h1})`);
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }); }
async function settle(page) { await page.waitForTimeout(650); }
// WebKit can hang on closing a tab (Playwright, not the page): give it 5 seconds, then move on.
async function shut(page) { await Promise.race([page.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]); }

async function round(browser, spec) {
  const [w, theme] = spec.split('-');
  const width = Number(w), phone = width < 600;
  console.log(`\n== ${ENGINE} ${width} ${theme}`);
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone && ENGINE === 'chromium', reducedMotion: 'no-preference' });
  const tag = `${ENGINE}-${width}-${theme}`;
  let page = await fresh(ctx, theme);

  // Start, kit, preview
  for (const p of ['index.html', 'kit.html', 'preview.html']) {
    await page.goto(BASE + p); await settle(page);
    await noSideways(page, `${p} ${tag}`); if (p !== 'preview.html') await names(page, `${p} ${tag}`);
    await shot(page, `${tag}-${p.replace('.html', '')}`);
  }
  ok(await page.evaluate(() => document.documentElement.getAttribute('data-mode')) === theme, `theme ${theme} applied`);

  // Every screen and state
  await page.goto(BASE + 'site.html#/shop'); await settle(page);
  await noSideways(page, `shop ${tag}`); await names(page, `shop ${tag}`); await shot(page, `${tag}-shop`);
  for (const slug of PRODUCTS) {
    for (const st of STATES_PDP) {
      await page.goto(`${BASE}site.html#/product/${slug}?state=${st}`); await settle(page);
      await noSideways(page, `product ${slug} ${st} ${tag}`);
      if (st === 'default') { await names(page, `product ${slug} ${tag}`); }
      if (st === 'default' || (slug === PRODUCTS[0] && st !== 'adding') || (slug === PRODUCTS[1] && st === 'added')) await shot(page, `${tag}-pdp-${slug.slice(0, 18)}-${st}`);
      if (slug === '350k-butta-saree-3') break;
    }
  }
  for (const st of STATES_BAG) {
    await page.goto(`${BASE}site.html#/bag?state=${st}`); await settle(page);
    await noSideways(page, `bag ${st} ${tag}`);
    if (['normal', 'empty', 'problems'].includes(st)) await names(page, `bag ${st} ${tag}`);
    await shot(page, `${tag}-bag-${st}`);
  }
  for (const p of ['#/sign-in', '#/checkout']) { await page.goto(BASE + 'site.html' + p); await settle(page); await noSideways(page, `${p} ${tag}`); await names(page, `${p} ${tag}`); await shot(page, `${tag}-${p.slice(2)}`); }
  ok(page.errors.length === 0, `no page errors on the screens ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // Flow 1: single piece: add, side panel, Escape, "In your bag"
  page = await fresh(ctx, theme);
  await page.goto(BASE + 'site.html#/bag?state=empty'); await settle(page);
  await page.goto(BASE + 'site.html#/product/pure-pattu-350k-butta-saree-34'); await settle(page);
  await page.locator('.buy [data-act="add"]').click();
  await page.waitForSelector('.drawer.right', { timeout: 3000 });
  ok(await page.locator('.drawer .added').isVisible(), 'side panel says "Added to your bag"');
  ok((await page.locator('.drawer .bline').count()) === 1, 'side panel shows the 1 saree');
  ok(/₹5,800/.test(await page.locator('.drawer-foot').innerText()), 'side panel total ₹5,800');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(await page.locator('.drawer').count() === 0, 'Escape closes the side panel');
  ok(/In your bag/i.test(await page.locator(".buy .buy-row").innerText()), 'button becomes "In your bag"');
  ok((await page.locator('.bag-n').innerText()) === '1', 'header shows 1');

  // Flow 2: a set: choose 3, add, then 2 more allowed
  await page.goto(BASE + 'site.html#/product/150-50-plain-saree-7'); await settle(page);
  await page.locator('.buy [data-act="qty-inc"]').click(); await page.locator('.buy [data-act="qty-inc"]').click();
  ok((await page.locator('.buy .qty output').innerText()) === '3', 'set: chose 3 pieces');
  await page.locator('.buy [data-act="add"]').click();
  await page.waitForSelector('.drawer.right');
  ok(/3 × ₹2,700/.test(await page.locator('.drawer').innerText()) || /3 pieces/.test(await page.locator('.drawer').innerText()), 'side panel shows 3 pieces of the set');
  await page.locator('.drawer .btn-icon[data-act="ov-x"]').click(); await page.waitForTimeout(200);
  ok(/3 in your bag · up to 2 more/.test(await page.locator('.buy').innerText()), 'set: "3 in your bag · up to 2 more"');
  ok((await page.locator('.bag-n').innerText()) === '4', 'header shows 4 pieces');
  await shot(page, `${tag}-flow-set-after-add`);

  // Flow 3: the bag: more pieces, remove + Undo
  await page.goto(BASE + 'site.html#/bag'); await settle(page);
  ok((await page.locator('.blines .bline').count()) === 2, 'bag page: 2 sarees');
  ok(/₹13,900/.test(await page.locator('.sum').innerText()), 'bag total ₹13,900 (5,800 + 3 × 2,700)');
  await page.locator('.bline[data-slug="150-50-plain-saree-7"] [data-act="qty-inc"]').click(); await page.waitForTimeout(600);
  ok(/₹16,600/.test(await page.locator('.sum').innerText()), 'one more piece: ₹16,600');
  await page.locator('.bline[data-slug="pure-pattu-350k-butta-saree-34"] [data-act="remove"]').click(); await page.waitForTimeout(500);
  ok((await page.locator('.blines .bline').count()) === 1, 'removed: 1 saree left');
  ok(await page.locator('.toast .act', { hasText: 'Undo' }).isVisible(), 'Undo offered');
  await page.locator('.toast .act', { hasText: 'Undo' }).click(); await page.waitForTimeout(600);
  ok((await page.locator('.blines .bline').count()) === 2, 'Undo puts it back');

  // Flow 4: WhatsApp message, sent, clear
  await page.locator('.sum [data-act="wa"]').click();
  await page.waitForSelector('.modal-box');
  const msg = await page.locator('.wa-preview').innerText();
  ok(/NH-MHPS-1107/.test(msg) && /NH-MHPS-1009/.test(msg) && /4 pieces × ₹2,700 = ₹10,800/.test(msg) && /Total: ₹16,600 \(5 pieces, free delivery\)/.test(msg), 'WhatsApp message has codes, pieces, total');
  await shot(page, `${tag}-flow-wa`);
  await page.locator('[data-act="wa-open"]').click(); await page.waitForTimeout(200);
  ok(await page.locator('.modal-box .note').isVisible(), 'mock-up says WhatsApp does not open here');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(/Sent on WhatsApp\?/.test(await page.locator('main').innerText()), '"Sent on WhatsApp?" shows after');
  await page.locator('[data-act="clear-ask"]').click(); await page.waitForSelector('.modal-box');
  await page.locator('.modal-box [data-act="clear"]').click(); await page.waitForTimeout(300);
  ok(/Your bag is empty/.test(await page.locator('main').innerText()), 'bag cleared');

  // Flow 5: sign in joins the bags, sign out clears this browser
  await page.goto(BASE + 'site.html#/product/pure-pattu-350k-butta-saree-34'); await settle(page);
  await page.locator('.buy [data-act="add"]').click(); await page.waitForSelector('.drawer.right'); await page.keyboard.press('Escape');
  await page.goto(BASE + 'site.html#/sign-in'); await settle(page);
  await page.locator('[data-act="signin"]').click(); await page.waitForTimeout(500);
  ok(/Welcome back, Priya/.test(await page.locator('main').innerText()), 'signed in: bags joined message');
  ok((await page.locator('.blines .bline').count()) === 3, 'joined bag: 1 + 2 from the account');
  ok(/Priya/.test(await page.locator('.hdr').innerText()) || await page.locator('.hdr .avatar').count() === 1, 'header shows the customer');
  await page.goto(BASE + 'site.html#/sign-in'); await settle(page);
  await page.locator('[data-act="signout"]').click(); await page.waitForTimeout(500);
  ok(/You signed out/.test(await page.locator('main').innerText()) && /Your bag is empty/.test(await page.locator('main').innerText()), 'signed out: bag removed from this browser');
  await page.goto(BASE + 'site.html#/sign-in'); await settle(page);
  await page.locator('[data-act="signin"]').click(); await page.waitForTimeout(500);
  ok((await page.locator('.blines .bline').count()) === 3, 'signing in again brings the saved bag back');

  // Flow 6: two tabs
  const other = await ctx.newPage();
  await other.goto(BASE + 'site.html#/shop'); await settle(other);
  const before = Number(await other.locator('.bag-n').innerText());
  await page.goto(BASE + 'site.html#/product/kanchi-border-triple-check-saree-14'); await settle(page);
  await page.locator('.buy [data-act="add"]').click(); await page.waitForSelector('.drawer.right');
  await other.waitForTimeout(400);
  ok(Number(await other.locator('.bag-n').innerText()) === before + 1, 'the other tab shows the new count at once');
  await shut(other);
  ok(page.errors.length === 0, `no page errors in the flows ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);

  // Options: each letter changes what it should
  page = await fresh(ctx, theme, { after: 'b' });
  await page.goto(BASE + 'site.html#/product/real-tanjore-painting-sarees-11?state=default'); await settle(page);
  await page.locator('.buy [data-act="add"]').click(); await page.waitForTimeout(700);
  ok(await page.locator('.toast', { hasText: 'Added to your bag' }).isVisible() && await page.locator('.drawer').count() === 0, '5.2 B: short message, no side panel');
  await page.evaluate(() => window.W5Opts.set('after', 'c'));
  await page.goto(BASE + 'site.html#/product/rainbow-checks-sarees-41?state=default'); await settle(page);
  await page.locator('.buy [data-act="add"]').click(); await page.waitForTimeout(800);
  ok(/#\/bag/.test(page.url()), '5.2 C: goes to the bag page');
  await page.evaluate(() => window.W5Opts.set('name', 'b'));
  await page.waitForTimeout(100);
  ok(/Your cart/.test(await page.locator('h1').innerText()), '5.1 B: "cart" everywhere');
  await page.evaluate(() => window.W5Opts.set('name', 'a'));
  await page.evaluate(() => window.W5Opts.set('after', 'a'));
  for (const L of ['b', 'c']) { await page.evaluate((v) => window.W5Opts.set('layout', v), L); await page.waitForTimeout(150); await noSideways(page, `layout ${L} ${tag}`); await shot(page, `${tag}-bag-layout-${L}`); }
  await page.evaluate(() => window.W5Opts.set('layout', 'a'));
  for (const Q of ['b', 'c']) {
    await page.evaluate((v) => window.W5Opts.set('qty', v), Q);
    await page.goto(BASE + 'site.html#/product/150-50-plain-saree-7?state=default'); await settle(page);
    ok(await page.locator(Q === 'b' ? '.buy select.qty-select' : '.buy .qty-chips').count() === 1, `5.4 ${Q}: control shows`);
    await shot(page, `${tag}-pdp-qty-${Q}`);
  }
  await page.evaluate(() => window.W5Opts.set('qty', 'a'));
  for (const I of ['b', 'c']) { await page.evaluate((v) => window.W5Opts.set('icon', v), I); await page.waitForTimeout(150); await noSideways(page, `icon ${I} ${tag}`); await shot(page, `${tag}-header-${I}`); }
  await page.evaluate(() => window.W5Opts.set('icon', 'a'));
  for (const P of ['b', 'c']) { await page.evaluate((v) => window.W5Opts.set('pdp', v), P); await page.waitForTimeout(150); await noSideways(page, `pdp ${P} ${tag}`); await shot(page, `${tag}-pdp-buttons-${P}`); }
  await page.evaluate(() => window.W5Opts.set('pdp', 'a'));
  await page.evaluate(() => window.W5Opts.set('problems', 'b'));
  await page.goto(BASE + 'site.html#/bag?state=problems'); await settle(page);
  ok(/Needs your attention/i.test(await page.locator('main').innerText()), '5.7 B: own group');
  await shot(page, `${tag}-bag-problems-b`);
  await page.evaluate(() => window.W5Opts.set('problems', 'c'));
  await page.goto(BASE + 'site.html#/bag?state=normal'); await settle(page);
  await page.goto(BASE + 'site.html#/bag?state=problems'); await settle(page);
  ok(await page.locator('.modal-box .chg-list').isVisible(), '5.7 C: pop-up lists the changes');
  await shot(page, `${tag}-bag-problems-c`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.W5Opts.set('problems', 'a'));
  await page.evaluate(() => window.W5Opts.set('w6', 'b'));
  await page.goto(BASE + 'site.html#/bag?state=normal'); await settle(page);
  ok(await page.locator('.sum .btn-primary[disabled]').count() === 1, '5.8 B: Checkout greyed');
  await page.evaluate(() => window.W5Opts.set('w6', 'c'));
  await page.waitForTimeout(150);
  await page.locator('.sum [data-act="checkout"]').click(); await page.waitForTimeout(300);
  ok(/#\/checkout/.test(page.url()), '5.8 C: Checkout opens the W6 page');
  await page.evaluate(() => window.W5Opts.set('w6', 'a'));

  // The panel: open, choose, copy, Escape
  await page.goto(BASE + 'site.html#/bag?state=normal'); await settle(page);
  await page.locator('.mo-fab').click();
  ok(await page.locator('.mo-panel').isVisible(), 'Design options panel opens');
  await page.locator('.mo-panel [data-mo-k="palette"][data-mo-v="b"]').click();
  ok(await page.evaluate(() => document.documentElement.getAttribute('data-palette')) === 'b', 'panel: palette B applies');
  await page.locator('.mo-panel [data-mo-state="empty"]').click(); await page.waitForTimeout(300);
  ok(/state=empty/.test(page.url()), 'panel: screen state buttons work');
  await page.locator('.mo-panel [data-mo-copy]').click(); await page.waitForTimeout(300);
  const copied = await page.locator('[data-mo-copied]').innerText();
  ok(/Copied|Select and copy/.test(copied), 'Copy my choices answers');
  const text = await page.evaluate(() => window.W5Opts.choicesText());
  ok(/Colours: B Heritage/.test(text) && /5\.2 After "Add to bag": A Side panel/.test(text), 'choices text lists the picks');
  await shot(page, `${tag}-panel`);
  await page.keyboard.press('Escape');
  ok(!(await page.locator('.mo-panel').isVisible()), 'Escape closes the panel');
  ok(page.errors.length === 0, `no page errors with options ${tag}: ${page.errors.slice(0, 3).join(' | ')}`);
  await shut(page);
  await Promise.race([ctx.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
}

(async () => {
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  try { for (const r of ROUNDS) await round(browser, r); } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
