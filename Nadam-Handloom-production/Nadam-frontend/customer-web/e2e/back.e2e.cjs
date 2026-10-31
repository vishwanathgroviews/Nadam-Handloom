/* End-to-end test: the "‹ Back" button (owner, 31 Oct 2026).
   Every inner page starts its breadcrumb row with Back. It goes back one page on the website
   (the list keeps its place), or, on a page opened straight from a link, one level up (the last
   linked crumb, or home) instead of leaving the website. Sign-in, not found, loading and
   couldn't-load pages have Back on its own.
   Needs the server and website as for W6/W7 (server on a local copy, default nandam_w5e2e, with
   SMS_PROVIDER=console). Signs up one new test customer and adds one sample order for it (the
   order is removed at the end).
   Env: NH_WEB (default http://localhost:5180), NH_API, NH_E2E_DB, NH_ENGINE=webkit + WEBKIT_PATH,
        NH_ROUNDS (default 1440-light,390-dark), NH_NO_SHOTS=1. */
const { chromium, webkit } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.NH_WEB || 'http://localhost:5180';
const ROOT = process.env.NH_API || 'http://127.0.0.1:4300';
const API = `${ROOT}/api/v2/shop`;
const DB = process.env.NH_E2E_DB || 'nandam_w5e2e';
if (!/^nandam_(w5e2e|e2e|test)$/.test(DB)) throw new Error('Refusing: NH_E2E_DB must be a local test copy (nandam_w5e2e, nandam_e2e or nandam_test)');
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@18/bin/psql';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const WEBKIT = process.env.NH_ENGINE === 'webkit';
const ROUNDS = (process.env.NH_ROUNDS || '1440-light,390-dark').split(',');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const sql = (s) => execFileSync(PSQL, ['-d', DB, '-Atc', s], { encoding: 'utf8' }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// WebKit can hang when Playwright closes a tab: don't wait for it longer than 5 s.
const shut = (x) => Promise.race([x.close().catch(() => {}), sleep(5000)]);
const get = async (p) => (await fetch(`${API}${p}`)).json();
let passed = 0;
const failed = [];
const ok = (cond, name) => { if (cond) { passed++; console.log(`  ok   ${name}`); } else { failed.push(name); console.log(`  FAIL ${name}`); } };
const shot = async (page, name) => { if (process.env.NH_NO_SHOTS) return; await new Promise((r) => setTimeout(r, 900)); await page.screenshot({ path: path.join(OUT, `back-${name}.png`) }); };
const pathOf = (page) => { const u = new URL(page.url()); return u.pathname + u.search; };
const samples = [];
const UPLOADS = process.env.NH_UPLOADS || path.join(__dirname, '../../../Nadam-backend/tmp/e2e-uploads');

// The page's Back button and facts about it.
async function backInfo(page) {
  const b = page.locator('.back-btn').first();
  await b.waitFor({ timeout: 15000 });
  return page.evaluate(() => {
    const el = document.querySelector('.back-btn');
    const r = el.getBoundingClientRect();
    const row = el.closest('.crumbs-row');
    const crumbs = row?.querySelector('.crumbs');
    const cr = crumbs?.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // contrast of the label against the button (the banner one sits on a photo: not measured)
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r1, g1, b1]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r1) + 0.7152 * f(g1) + 0.0722 * f(b1); };
    const fg = rgb(cs.color);
    let bgEl = el; let bg = rgb(cs.backgroundColor);
    while ((bg.length === 4 && bg[3] === 0) && bgEl.parentElement) { bgEl = bgEl.parentElement; bg = rgb(getComputedStyle(bgEl).backgroundColor); }
    const L1 = lum(fg); const L2 = lum(bg);
    return {
      text: el.textContent.trim(),
      tag: el.tagName,
      first: row?.firstElementChild === el,
      inBanner: !!el.closest('.cbanner'),
      color: cs.color,
      contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05),
      h: el.offsetHeight, left: r.left, // offsetHeight: a page's entry animation (a slight zoom) doesn't count top: r.top, right: r.right,
      sameRow: cr ? Math.abs((cr.top + cr.height / 2) - (r.top + r.height / 2)) < 14 || cr.height > r.height : true,
      inView: r.left >= 0 && r.right <= innerWidth && r.width > 0,
      sideways: document.documentElement.scrollWidth > innerWidth + 1,
      parent: [...(crumbs?.querySelectorAll('a') || [])].map((a) => a.getAttribute('href')).pop() || null,
    };
  });
}

// Checks the button's look on this page, presses it, and checks where it went.
async function pressBack(page, tag, label, expectPath, { width, banner = false } = {}) {
  const info = await backInfo(page);
  ok(info.tag === 'BUTTON' && info.text === 'Back', `${tag} ${label}: a "Back" button`);
  ok(info.inView && !info.sideways, `${tag} ${label}: Back in view, no sideways scroll`);
  if (info.parent !== null || banner) ok(info.first, `${tag} ${label}: Back starts the breadcrumb row`);
  if (width >= 900 && info.parent !== null) ok(info.sameRow, `${tag} ${label}: Back and the breadcrumbs on one line`);
  if (width < 900) ok(info.h >= 40, `${tag} ${label}: Back is easy to tap on a phone (${Math.round(info.h)} px)`);
  if (banner) ok(info.inBanner && /255, 255, 255/.test(info.color), `${tag} ${label}: Back is white on the category photo`);
  else ok(info.contrast >= 4.5, `${tag} ${label}: Back is readable (contrast ${info.contrast.toFixed(1)})`);
  await page.locator('.back-btn').first().click();
  const want = typeof expectPath === 'function' ? expectPath : (p) => p === expectPath;
  const t0 = Date.now();
  while (!want(pathOf(page)) && Date.now() - t0 < 8000) await sleep(100);
  ok(want(pathOf(page)), `${tag} ${label}: Back goes to ${typeof expectPath === 'string' ? expectPath : 'the right page'} (${pathOf(page)})`);
}

// A page opened straight from a link: a new tab with nothing before it on the website.
async function direct(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
  return page;
}

async function round(browser, spec) {
  const [w, mode] = spec.split('-');
  const width = Number(w);
  const tag = `[${WEBKIT ? 'webkit' : 'chrome'} ${spec}]`;
  console.log(`\n${tag}`);
  const ctx = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, colorScheme: mode, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const errors = [];
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    // 401/404: signed-out and not-found pages; 403: the local copy's old photo links (the photo store answers 403 for a photo replaced since)
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of (401|403|404)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  });

  const catalog = await get('/catalog');
  const cat = catalog.categories.find((c) => c.count > 0);
  const products = await get('/products?offset=0&limit=24');

  /* ---------- A saree from All sarees, then Back: the list is where it was ---------- */
  let page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.locator('nav a', { hasText: 'All sarees' }).first().click();
  await page.waitForURL(/\/shop$/);
  await page.locator('.pcard.in').first().waitFor();
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await sleep(900);
  const y = await page.evaluate(() => window.scrollY);
  const card = page.locator('.pgrid > .pcard').nth(width < 900 ? 4 : 8);
  await card.scrollIntoViewIfNeeded();
  const y2 = await page.evaluate(() => window.scrollY);
  await card.locator('a.ph').click();
  await page.waitForURL(/\/product\//);
  await page.locator('.pdp .buy').first().waitFor();
  await shot(page, `${spec}-saree`);
  await pressBack(page, tag, 'saree page (from All sarees)', '/shop', { width });
  await sleep(1500);
  const yBack = await page.evaluate(() => window.scrollY);
  ok(Math.abs(yBack - y2) < 80 && y > 0, `${tag} back on All sarees at the same place (${Math.round(y2)} → ${Math.round(yBack)})`);
  const hidden = await page.$$eval('.pgrid > .pcard', (els) => els.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && Number(getComputedStyle(el).opacity) < 1; }).length);
  await sleep(700);
  const hidden2 = await page.$$eval('.pgrid > .pcard', (els) => els.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && Number(getComputedStyle(el).opacity) < 1; }).length);
  ok(hidden2 === 0, `${tag} the sarees in view all show after Back (${hidden} → ${hidden2} still fading)`);

  /* ---------- Keyboard: Shift+Tab from the first crumb reaches Back; Enter goes back ---------- */
  await page.locator('.pgrid > .pcard a.ph').first().click();
  await page.waitForURL(/\/product\//);
  await page.locator('.pdp .buy').first().waitFor();
  if (WEBKIT) {
    // Safari's Tab skips buttons and links unless "Press Tab to highlight each item" is on:
    // there, check that the focused button works with Enter.
    await page.locator('.back-btn').focus();
    ok(await page.evaluate(() => document.activeElement?.classList.contains('back-btn')), `${tag} keyboard: Back can take the focus`);
  } else {
    await page.locator('.crumbs a').first().focus();
    await page.keyboard.press('Shift+Tab');
    const focus = await page.evaluate(() => ({ back: document.activeElement?.classList.contains('back-btn'), ring: getComputedStyle(document.activeElement).outlineStyle }));
    ok(focus.back && focus.ring !== 'none', `${tag} keyboard: Back is reached with Tab and shows a focus ring (${focus.ring})`);
  }
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/shop$/);
  ok(true, `${tag} keyboard: Enter on Back goes back to All sarees`);
  await shut(page);

  /* ---------- Opened straight from a link: one level up, never off the website ---------- */
  const saree = products.items[3];
  page = await direct(ctx, `/product/${saree.slug}`);
  await page.locator('.pdp .buy').first().waitFor();
  const parent = (await backInfo(page)).parent;
  ok(/^\/category\/[^/]+(\/[^/]+)?$/.test(parent || ''), `${tag} a shared saree link: its collection is the level up (${parent})`);
  await pressBack(page, tag, 'saree page (opened from a link)', parent, { width });
  await shut(page);

  page = await direct(ctx, `/category/${cat.slug}`);
  await page.locator('.cbanner h1').filter({ hasText: /\S/ }).first().waitFor();
  await shot(page, `${spec}-category`);
  await pressBack(page, tag, 'category page (opened from a link)', '/', { width, banner: true });
  await shut(page);

  /* ---------- Category → collection, then Back ---------- */
  page = await ctx.newPage();
  await page.goto(`${BASE}/category/${cat.slug}`);
  await page.locator('.ctile').first().click();
  await page.waitForURL(new RegExp(`/category/${cat.slug}/[^/]+$`));
  await page.locator('.pgrid > .pcard').first().waitFor();
  await pressBack(page, tag, 'collection page (from its category)', `/category/${cat.slug}`, { width });
  await shut(page);

  for (const [url, label] of [['/collections', 'All collections'], ['/shop?q=saree', 'search results'], ['/bag', 'empty bag'], ['/privacy', 'privacy policy'], ['/terms', 'terms'], ['/shipping', 'shipping'], ['/refunds', 'refunds'], ['/contact', 'contact']]) {
    page = await direct(ctx, url);
    await pressBack(page, tag, `${label} (opened from a link)`, '/', { width });
    await shut(page);
  }

  /* ---------- Not found: Back on its own ---------- */
  page = await direct(ctx, '/product/no-such-saree-anywhere');
  await page.getByRole('heading', { name: "This saree isn't on the website now" }).waitFor();
  await pressBack(page, tag, 'a saree that is gone', '/', { width });
  await shut(page);
  page = await direct(ctx, '/no-such-page');
  await page.getByRole('heading', { name: "We couldn't find that page" }).waitFor();
  await pressBack(page, tag, 'a page that does not exist', '/', { width });
  await shut(page);

  /* ---------- Sign-in from a saree: Back returns to the saree ---------- */
  page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.locator('.pcard a.ph').first().click();
  await page.waitForURL(/\/product\//);
  const sareePath = pathOf(page);
  await page.locator('.pdp .buy').first().waitFor();
  await page.getByRole('link', { name: 'Sign in' }).first().click();
  await page.waitForURL(/\/sign-in/);
  await page.getByLabel('Mobile number').waitFor();
  await shot(page, `${spec}-sign-in`);
  await pressBack(page, tag, 'sign-in (from a saree)', sareePath, { width });

  /* ---------- Signed in: account, my orders, an order, checkout ---------- */
  const mobile = `6${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`;
  await page.goto(`${BASE}/sign-in?next=%2Faccount`);
  await page.getByLabel('Mobile number').fill(`${mobile.slice(0, 5)} ${mobile.slice(5)}`);
  const reply = page.waitForResponse((r) => /\/auth\/code$/.test(r.url()) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send code' }).click();
  const sent = await (await reply).json();
  await page.locator('.otp-row input').first().click();
  await page.keyboard.type(sent.devCode, { delay: 30 });
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  await page.getByLabel('Full name').fill('Back Button Test');
  await page.getByLabel('Email').fill(`back.${mobile}@example.com`);
  await page.getByLabel('Pincode').fill('522503');
  await page.locator('.field-hint.ok').waitFor();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForURL(/\/account$/);
  ok(true, `${tag} signed up a test customer`);

  const acct = sql(`SELECT id FROM "AuthAccount" WHERE phone = ${q(mobile)}`);
  const pid = sql(`SELECT id FROM "Product" WHERE slug = ${q(saree.slug)}`);
  const num = `NH${String(crypto.randomInt(0, 1e8)).padStart(8, '0')}`;
  const oid = crypto.randomUUID();
  samples.push(oid);
  sql(`INSERT INTO "Order" (id, "orderNumber", "authAccountId", channel, status, subtotal, total, "shippingAddress", "placedAt", "updatedAt") VALUES (${q(oid)}, ${q(num)}, ${q(acct)}, 'online', 'delivered', 2800, 2800, '{"fullName":"Back Test","phone":"9876543210","line1":"Sample","city":"Guntur","state":"Andhra Pradesh","pincode":"522002"}', now() - interval '3 days', now());
    INSERT INTO "Payment" (id, "orderId", "razorpayOrderId", status, amount, "updatedAt") VALUES (${q(crypto.randomUUID())}, ${q(oid)}, ${q(`order_back${crypto.randomBytes(6).toString('hex')}`)}, 'paid', 2800, now());
    INSERT INTO "OrderItem" (id, "orderId", "productId", "nameSnapshot", "priceSnapshot", quantity) VALUES (${q(crypto.randomUUID())}, ${q(oid)}, ${q(pid)}, 'Sample saree (Back test)', 2800, 1)`);

  await page.goto(`${BASE}/account`);
  await page.locator('.crumbs-row').waitFor();
  await page.locator('a[href="/account/orders"]').first().click();
  await page.waitForURL(/\/account\/orders$/);
  await page.locator('.ocard').first().waitFor();
  await shot(page, `${spec}-my-orders`);
  await pressBack(page, tag, 'My orders (from My account)', '/account', { width });
  await page.locator('a[href="/account/orders"]').first().click();
  await page.waitForURL(/\/account\/orders$/);
  await page.locator('.ocard a, a.ocard').first().click();
  await page.waitForURL(/\/order\//);
  await page.locator('.crumbs', { hasText: `Order ${num}` }).waitFor();
  await shot(page, `${spec}-order`);
  await pressBack(page, tag, 'an order (from My orders)', '/account/orders', { width });
  await shut(page);

  page = await direct(ctx, '/order/NH00000000');
  await page.getByRole('heading', { name: "We couldn't find this order" }).waitFor();
  await pressBack(page, tag, 'an order that is not found (opened from a link)', '/account/orders', { width });
  await shut(page);

  page = await direct(ctx, '/account/profile');
  await pressBack(page, tag, 'profile (opened from a link)', '/account', { width });
  await shut(page);

  page = await ctx.newPage();
  await page.goto(`${BASE}/product/${saree.slug}`);
  await page.locator('.pdp .buy').first().waitFor();
  await page.getByRole('button', { name: /Add to bag/ }).first().click();
  await sleep(800);
  await page.goto(`${BASE}/bag`);
  await page.getByRole('link', { name: 'Checkout' }).first().click();
  await page.waitForURL(/\/checkout$/);
  await page.getByRole('heading', { name: 'Checkout' }).waitFor();
  await shot(page, `${spec}-checkout`);
  await pressBack(page, tag, 'checkout (from the bag)', '/bag', { width });
  await shut(page);

  ok(errors.length === 0, `${tag} no page or console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await shut(ctx);
}

(async () => {
  const engine = WEBKIT ? webkit : chromium;
  const browser = await engine.launch(WEBKIT ? (process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : { executablePath: EXE });
  const t0 = Date.now();
  try {
    for (const spec of ROUNDS) await round(browser, spec);
  } catch (err) {
    failed.push(`crashed: ${err.message.split('\n')[0]}`);
    console.error(err);
  } finally {
    // The sample order (and the invoice the server makes when its page opens) goes again.
    for (const oid of samples) {
      for (const key of sql(`SELECT "storageKey" FROM "Invoice" WHERE "orderId" = ${q(oid)} AND "storageKey" IS NOT NULL`).split('\n').filter(Boolean)) fs.rmSync(path.join(UPLOADS, key), { force: true });
      sql(`DELETE FROM "Invoice" WHERE "orderId" = ${q(oid)}; DELETE FROM "OrderItem" WHERE "orderId" = ${q(oid)}; DELETE FROM "Payment" WHERE "orderId" = ${q(oid)}; DELETE FROM "Order" WHERE id = ${q(oid)}`);
    }
    await browser.close();
  }
  console.log(`\n${passed} checks passed, ${failed.length} failed, ${Math.round((Date.now() - t0) / 1000)} s.${failed.length ? `\n - ${failed.join('\n - ')}` : ''}`);
  process.exit(failed.length ? 1 : 0);
})();
