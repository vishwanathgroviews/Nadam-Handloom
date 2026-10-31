/* End-to-end test of website module W5, the bag, in a real browser against the real server on a
   LOCAL copy of the live data (default nandam_w5e2e: createdb -T nandam_live_20261016 nandam_w5e2e).
   It changes that copy: it signs up test customers, saves their bags, and for a moment marks a
   saree sold or changes a collection's price (always put back).
     node e2e/w5.e2e.cjs           (Chrome: 1440 light, 390 dark; screenshots in e2e/out/)
   Env: NH_WEB (default http://localhost:5180), NH_API (default http://127.0.0.1:4300),
        NH_E2E_DB, CHROME_PATH, NH_ENGINE=webkit + WEBKIT_PATH, NH_ROUNDS=390-light,1440-dark,
        NH_NO_SHOTS=1. Server: SMS_PROVIDER=console (the code comes back in the reply). */
const { chromium, webkit } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.NH_WEB || 'http://localhost:5180';
const API = `${process.env.NH_API || 'http://127.0.0.1:4300'}/api/v2/shop`;
const DB = process.env.NH_E2E_DB || 'nandam_w5e2e';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@18/bin/psql';
const OUT = path.join(__dirname, 'out');
const ENGINE = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const ROUNDS = (process.env.NH_ROUNDS || '1440-light,390-dark').split(',');
fs.mkdirSync(OUT, { recursive: true });
if (!/^nandam_(w5e2e|e2e|test)$/.test(DB)) throw new Error('Refusing: NH_E2E_DB must be a local test copy (nandam_w5e2e, nandam_e2e or nandam_test)');

// The bag's WhatsApp button: the main button, or (W6, payments on) a small link under Checkout.
const SEND_BAG = /^(Send bag on WhatsApp|Order on WhatsApp instead)$/;
const fails = [];
const errors = [];
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ok   ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); }
};
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const sql = (q) => execFileSync(PSQL, ['-d', DB, '-Atc', q], { encoding: 'utf8' }).trim();
const get = async (p) => {
  try { return await (await fetch(`${API}${p}`)).json(); } catch { await sleep(500); return (await fetch(`${API}${p}`)).json(); }
};
const rs = (v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`;
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await sleep(100); } };
const used = new Set();
const newMobile = () => { for (;;) { const m = `6${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`; if (!used.has(m)) { used.add(m); return m; } } };
const fmt = (m) => `${m.slice(0, 5)} ${m.slice(5)}`;
const slugs = (list) => list.map((x) => x.slug);
// WebKit can hang on closing a tab (Playwright, not the website): give it 5 seconds, then go on.
const shut = (x) => Promise.race([x.close().catch(() => {}), sleep(5000)]);

async function shot(page, name) {
  if (process.env.NH_NO_SHOTS) return;
  await page.screenshot({ path: path.join(OUT, `w5-${name}.png`), caret: 'initial' });
}
async function noSideScroll(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, `${label}: no sideways scrolling (${over}px)`);
}
async function a11y(page, label) {
  const r = await page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().length > 0;
    return {
      h1: document.querySelectorAll('main h1').length,
      noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      unnamed: [...document.querySelectorAll('button, a[href]')].filter((b) => visible(b) && !named(b)).map((b) => b.outerHTML.slice(0, 90)),
    };
  });
  ok(r.h1 === 1, `${label}: one main heading (${r.h1})`);
  ok(r.noAlt === 0, `${label}: every picture has alt text`);
  ok(!r.unnamed.length, `${label}: every button and link has a name ${r.unnamed.join(' | ')}`);
}

const bagCount = async (page) => { const n = page.locator('.hdr .bag-n'); return (await n.count()) ? Number(await n.innerText()) : 0; };
const total = (page) => page.locator('.sum .sumrow.total .v').innerText();
const settled = (page) => until(async () => !(await page.locator('.checking i').count()));
// The bag page has loaded and its check has finished.
async function bagReady(page) {
  await page.locator('main h1').waitFor();
  await until(async () => (await page.locator('.bagp, .empty').count()) > 0);
  await settled(page);
}
async function openBag(page) { await page.goto(`${BASE}/bag`); await bagReady(page); }
const panel = (page) => page.getByRole('dialog', { name: /Added to your bag|Your bag/ });

async function addFromPage(page, slug, { pieces = 1 } = {}) {
  await page.goto(`${BASE}/product/${slug}`);
  await page.locator('.buy h1').waitFor();
  for (let i = 1; i < pieces; i++) await page.locator('.buy-qty').getByRole('button', { name: 'One piece more' }).click();
  await page.locator('.buy-row').getByRole('button', { name: /Add .*bag/ }).click();
  await panel(page).waitFor();
}

async function codeFrom(page, action) {
  const reply = page.waitForResponse((r) => /\/auth\/code$/.test(r.url()) && r.request().method() === 'POST');
  await action();
  const r = await reply;
  return r.json().catch(() => ({}));
}
async function typeCode(page, code) {
  await page.locator('.otp-row input').first().click();
  await page.keyboard.type(code, { delay: 30 });
}
async function signUp(page, mobile) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Mobile number').fill(fmt(mobile));
  const sent = await codeFrom(page, () => page.getByRole('button', { name: 'Send code' }).click());
  await page.locator('.otp-row').waitFor();
  await typeCode(page, sent.devCode);
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  await page.getByLabel('Full name').fill('Anitha Reddy');
  await page.getByLabel('Email').fill(`w5.${mobile}@example.com`);
  await page.getByLabel('Pincode').fill('522503');
  await page.locator('.field-hint.ok').waitFor();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForURL(/\/account$/);
}
async function signIn(page, mobile) {
  sql(`DELETE FROM "PhoneCode" WHERE mobile = '${mobile}'`);
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Mobile number').fill(fmt(mobile));
  const sent = await codeFrom(page, () => page.getByRole('button', { name: 'Send code' }).click());
  await page.locator('.otp-row').waitFor();
  await typeCode(page, sent.devCode);
  await page.waitForURL(/\/account$/);
}

async function run(browser, spec, round, picks) {
  const [w, mode] = spec.split('-');
  const width = Number(w);
  const tag = `${ENGINE}-${width}-${mode}`;
  console.log(`\n=== ${tag} ===`);
  const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, colorScheme: mode, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp (test)</title>' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  // WebKit reports requests it cancels itself when the test leaves a page at once ("… due to access
  // control checks"); the website catches those. Anything else is an error.
  const cancelled = (t) => ENGINE === 'webkit' && /due to access control checks/.test(t);
  page.on('pageerror', (e) => { if (!cancelled(e.message)) errors.push(`${tag} page error: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !cancelled(m.text()) && !/Failed to load resource: (the server responded with a status of (401|404|409|400|429)|net::ERR_INTERNET_DISCONNECTED)/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });

  const [one, two, three, old] = picks.singles.slice(round * 4, round * 4 + 4);
  const set = picks.sets[round];

  /* ---------- A visitor ---------- */
  await page.goto(`${BASE}/cart`);
  ok(await page.waitForURL(/\/bag$/).then(() => true, () => false), `${tag} the old /cart address opens the bag`);
  await bagReady(page);
  ok(await page.getByRole('heading', { name: 'Your bag is empty' }).isVisible(), `${tag} empty bag`);
  ok(await page.locator('main .empty').getByRole('link', { name: 'Sets for the family' }).isVisible(), `${tag} empty bag offers ways to start`);
  await a11y(page, `${tag} empty bag`);
  await shot(page, `${tag}-empty`);

  // A single piece: Add to bag, side panel, Escape, "In your bag".
  await addFromPage(page, one.slug);
  const p = panel(page);
  ok(await p.getByText('Added to your bag').isVisible(), `${tag} side panel: "Added to your bag"`);
  ok((await p.locator('.bline').count()) === 1 && (await p.locator('.sumrow.total .v').innerText()) === rs(one.price), `${tag} side panel: the saree and its price ${rs(one.price)}`);
  ok((await bagCount(page)) === 1, `${tag} header bag shows 1`);
  await noSideScroll(page, `${tag} side panel`);
  await shot(page, `${tag}-panel`);
  await page.keyboard.press('Escape');
  ok(await until(async () => !(await p.count())), `${tag} Escape closes the side panel`);
  ok(await page.locator('.buy-row').getByRole('button', { name: /In your bag/ }).isVisible(), `${tag} the button now says "In your bag"`);

  // A set: choose pieces, add, then the page says how many more fit.
  await addFromPage(page, set.slug, { pieces: 2 });
  ok(/2 pieces/.test(await panel(page).locator(`.bline[data-slug="${set.slug}"]`).innerText()), `${tag} set: 2 pieces in the side panel`);
  await panel(page).getByRole('button', { name: 'Keep shopping' }).click();
  ok(await page.locator('.buy-qty .left').getByText(`2 in your bag · up to ${set.available - 2} more`).isVisible(), `${tag} set: "2 in your bag · up to ${set.available - 2} more"`);
  ok((await bagCount(page)) === 3, `${tag} header bag shows 3 pieces`);
  await shot(page, `${tag}-set-page`);

  // The bag page.
  await openBag(page);
  ok((await page.locator('.blines .bline').count()) === 2, `${tag} bag page: 2 sarees`);
  const t1 = one.price + 2 * set.price;
  ok((await total(page)) === rs(t1), `${tag} bag total ${rs(t1)}`);
  ok(await until(() => page.getByText('Prices and stock checked just now').isVisible()), `${tag} "Prices and stock checked just now"`);
  ok(await page.locator(`.bline[data-slug="${one.slug}"]`).getByText(one.sku).isVisible(), `${tag} each line shows the saree's code`);
  await noSideScroll(page, `${tag} bag`);
  await a11y(page, `${tag} bag`);
  await shot(page, `${tag}-bag`);

  await page.locator(`.bline[data-slug="${set.slug}"]`).getByRole('button', { name: 'One piece more' }).click();
  ok(await until(async () => (await total(page)) === rs(one.price + 3 * set.price)), `${tag} one more piece: ${rs(one.price + 3 * set.price)}`);

  await page.locator(`.bline[data-slug="${one.slug}"]`).getByRole('button', { name: /^Remove/ }).click();
  ok(await until(async () => (await page.locator('.blines .bline').count()) === 1), `${tag} removed`);
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  ok(await until(async () => (await page.locator('.blines .bline').count()) === 2), `${tag} Undo puts it back`);
  ok((await page.locator('.blines .bline').first().getAttribute('data-slug')) === one.slug, `${tag} ... in its place`);

  // Send bag on WhatsApp: the message, then "Sent on WhatsApp?".
  await settled(page);
  await page.locator('.sum').getByRole('button', { name: SEND_BAG }).click();
  const dlg = page.getByRole('dialog', { name: 'Send your bag on WhatsApp' });
  await dlg.waitFor();
  const msg = await dlg.locator('.wa-preview').innerText();
  ok(msg.includes(`Code ${one.sku} · 1 piece · ${rs(one.price)}`) && msg.includes(`Code ${set.sku} · 3 pieces × ${rs(set.price)} = ${rs(3 * set.price)}`) && msg.includes(`Total: ${rs(one.price + 3 * set.price)} (4 pieces, free delivery)`), `${tag} WhatsApp message: codes, pieces, total`);
  // Each saree's link under it: WhatsApp shows the first one's photo above the message (23 Oct 2026).
  const origin = new URL(page.url()).origin;
  ok(msg.includes(`\n   ${origin}/product/${one.slug}\n`) && msg.includes(`\n   ${origin}/product/${set.slug}\n`), `${tag} WhatsApp message: each saree's link`);
  ok(await dlg.locator('.wa-preview').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${tag} the links wrap inside the message box`);
  const href = await dlg.getByRole('link', { name: 'Open WhatsApp' }).getAttribute('href');
  ok(href.startsWith('https://wa.me/917382388565?text=') && decodeURIComponent(href.split('text=')[1]) === msg, `${tag} WhatsApp opens the shop's chat with the same message`);
  await shot(page, `${tag}-whatsapp`);
  const [wa] = await Promise.all([ctx.waitForEvent('page'), dlg.getByRole('link', { name: 'Open WhatsApp' }).click()]);
  await shut(wa);
  ok(await page.getByText('Sent on WhatsApp?').isVisible(), `${tag} "Sent on WhatsApp?" after sending`);
  await page.getByRole('button', { name: 'Keep it' }).click();

  // Sold at the store while in the bag, and a new price.
  sql(`UPDATE "Piece" SET status = 'sold_offline' WHERE "productId" = (SELECT id FROM "Product" WHERE slug = '${one.slug}') AND status = 'in_stock'`);
  const colId = sql(`SELECT "subcategoryId" FROM "Product" WHERE slug = '${set.slug}'`);
  const oldPrice = sql(`SELECT "onlinePrice" FROM "Subcategory" WHERE id = '${colId}'`);
  sql(`UPDATE "Subcategory" SET "onlinePrice" = "onlinePrice" + 100 WHERE id = '${colId}'`);
  try {
    await page.reload();
    await bagReady(page);
    const soldLine = page.locator(`.bline[data-slug="${one.slug}"]`);
    ok(await soldLine.getByText(/Sold out: it sold since you added it/).isVisible(), `${tag} sold at the store: marked on the line`);
    ok(await page.getByText('Some sarees changed since you added them').isVisible(), `${tag} one note at the top`);
    ok(await page.locator(`.bline[data-slug="${set.slug}"]`).getByText(`Price went up from ${rs(set.price)} to ${rs(set.price + 100)} since you added it.`).isVisible(), `${tag} new price shown on the line`);
    ok((await total(page)) === rs(3 * (set.price + 100)), `${tag} the total leaves out the sold saree and uses today's price`);
    ok(await page.getByText("1 saree that can't be bought now is not counted.").isVisible(), `${tag} "not counted" said in the summary`);
    await shot(page, `${tag}-changed`);
    await page.locator(`.bline[data-slug="${set.slug}"]`).getByRole('button', { name: 'One piece fewer' }).click();
    ok(await until(async () => !(await page.getByText(/Price went up/).count())), `${tag} the price note goes once the bag is changed`);
  } finally {
    sql(`UPDATE "Piece" SET status = 'in_stock' WHERE "productId" = (SELECT id FROM "Product" WHERE slug = '${one.slug}') AND status = 'sold_offline'`);
    sql(`UPDATE "Subcategory" SET "onlinePrice" = ${oldPrice} WHERE id = '${colId}'`);
  }

  // Offline: the saved bag stays, sending waits.
  await page.reload();
  await bagReady(page);
  await ctx.setOffline(true);
  ok(await page.getByText("You're offline").isVisible(), `${tag} offline: said on the bag`);
  ok(await page.locator('.sum').getByRole('button', { name: SEND_BAG }).isDisabled(), `${tag} offline: sending waits`);
  await shot(page, `${tag}-offline`);
  await ctx.setOffline(false);
  ok(await until(async () => page.locator('.sum').getByRole('button', { name: SEND_BAG }).isEnabled()), `${tag} back online: sending works again`);

  // The old website's bag, brought back once.
  await page.evaluate(([s, n, pr]) => localStorage.setItem('NANDAM_CART_V1', JSON.stringify([{ productId: 'x', slug: s, name: n, price: pr, quantity: 1 }])), [old.slug, old.name, old.price]);
  await page.reload();
  await bagReady(page);
  ok(await page.getByText('We brought back 1 saree from your earlier visit').isVisible(), `${tag} old website's bag brought back`);
  ok((await page.locator(`.bline[data-slug="${old.slug}"]`).count()) === 1, `${tag} ... its saree is in the bag`);
  ok(await page.evaluate(() => localStorage.getItem('NANDAM_CART_V1')) === null, `${tag} ... and the old bag is removed`);
  await page.getByRole('button', { name: 'OK' }).click();

  // Two tabs keep in step.
  const tab2 = await ctx.newPage();
  await tab2.goto(`${BASE}/shop`);
  await tab2.locator('.hdr .bag-link').waitFor();
  const before = await bagCount(tab2);
  await addFromPage(page, two.slug);
  ok(await until(async () => (await bagCount(tab2)) === before + 1), `${tag} the other tab shows the new count at once`);
  await tab2.goto('about:blank'); // the website in it stops, even if closing the tab hangs (WebKit)
  await shut(tab2);
  await page.keyboard.press('Escape');

  /* ---------- Signing in joins the bags; signing out clears this browser ---------- */
  const mobile = newMobile();
  const guest = await page.evaluate(() => JSON.parse(localStorage.getItem('nh-bag-v1')).items.map((i) => i.slug));
  await signUp(page, mobile);
  await openBag(page);
  ok(slugs(await page.evaluate(() => JSON.parse(localStorage.getItem('nh-bag-v1')).items)).sort().join() === [...guest].sort().join(), `${tag} new customer: the bag moved into the account`);
  const accountId = sql(`SELECT id FROM "AuthAccount" WHERE phone LIKE '%${mobile}'`);
  ok(Number(sql(`SELECT count(*) FROM "BagItem" WHERE "authAccountId" = '${accountId}'`)) === guest.length, `${tag} saved in the account (${guest.length} sarees)`);
  ok(await page.getByText('Saved in your account').isVisible(), `${tag} "Saved in your account"`);
  ok(!(await page.getByText(/Your bags are joined/).count()), `${tag} a brand-new customer gets no "joined" message`);
  await addFromPage(page, three.slug);
  await page.keyboard.press('Escape');
  ok(Number(sql(`SELECT count(*) FROM "BagItem" WHERE "authAccountId" = '${accountId}'`)) === guest.length + 1, `${tag} signed in: adding saves to the account`);

  await page.goto(`${BASE}/account`);
  await page.getByRole('button', { name: /^Sign out$/ }).first().click();
  await page.waitForURL((u) => !/\/account/.test(u.pathname));
  // Within the website (no reload), as a customer would: the phone menu's "Bag"; on a computer
  // the same move through the address (the header's bag opens the side panel instead).
  if (await page.getByRole('button', { name: 'Menu' }).isVisible()) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /^Bag/ }).click();
  } else {
    await page.evaluate(() => { window.history.pushState({}, '', '/bag'); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
  await bagReady(page);
  ok(await page.getByText("You're signed out, so your bag was removed from this browser").isVisible(), `${tag} signed out: the bag left this browser`);
  ok((await bagCount(page)) === 0, `${tag} signed out: header bag is empty`);
  await shot(page, `${tag}-signed-out`);

  // A visitor bag again, then signing in: joined with the saved one.
  await addFromPage(page, one.slug);
  await page.keyboard.press('Escape');
  await signIn(page, mobile);
  await openBag(page);
  ok(await page.getByText(/Welcome back, Anitha\. Your bags are joined/).isVisible(), `${tag} signing in again: "Welcome back… joined"`);
  ok((await page.locator('.blines .bline').count()) === guest.length + 1, `${tag} the saved bag is back, joined with this one (${guest.length + 1} sarees)`);
  await shot(page, `${tag}-joined`);

  // Clear the bag (asks first).
  await page.getByRole('button', { name: SEND_BAG }).first().click();
  const [wa2] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('link', { name: 'Open WhatsApp' }).click()]);
  await shut(wa2);
  await page.getByRole('button', { name: 'Clear the bag' }).click();
  await page.getByRole('dialog', { name: 'Clear your bag?' }).getByRole('button', { name: 'Clear the bag' }).click();
  ok(await page.getByRole('heading', { name: 'Your bag is empty' }).waitFor().then(() => true, () => false), `${tag} cleared`);
  ok(Number(sql(`SELECT count(*) FROM "BagItem" WHERE "authAccountId" = '${accountId}'`)) === 0, `${tag} cleared in the account too`);

  // A sold-out saree's page has no "Add to bag".
  await page.goto(`${BASE}/product/${picks.sold}`);
  await page.locator('.buy h1').waitFor();
  ok(!(await page.locator('.buy').getByRole('button', { name: /Add to bag/ }).count()) && await page.getByRole('link', { name: /Ask for a similar saree/ }).isVisible(), `${tag} sold-out saree: no "Add to bag"`);

  await shut(ctx);
}

(async () => {
  const sets = (await get('/products?sets=1&offset=0&limit=48')).items.filter((c) => c.available >= 3);
  const singles = (await get('/products?sort=new&offset=0&limit=48')).items.filter((c) => c.available === 1);
  const sold = sql(`SELECT p.slug FROM "Product" p JOIN "Subcategory" s ON s.id = p."subcategoryId" WHERE p."isActive" AND p."deletedAt" IS NULL AND p."channelVisibility" IN ('online_only','both') AND s."isActive" AND s."onlinePrice" >= 500 AND EXISTS (SELECT 1 FROM "ProductImage" i WHERE i."productId" = p.id) AND p.stock = 0 AND NOT EXISTS (SELECT 1 FROM "Piece" x WHERE x."productId" = p.id AND x.status = 'in_stock') LIMIT 1`);
  if (sets.length < ROUNDS.length || singles.length < ROUNDS.length * 4 || !sold) throw new Error('Not enough real sarees in the test copy');
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  try {
    for (let i = 0; i < ROUNDS.length; i++) await run(browser, ROUNDS[i], i, { sets, singles, sold });
  } finally {
    await Promise.race([browser.close(), sleep(5000)]);
  }
  ok(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  console.log(`\n${passed} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
