/* End-to-end test of website module W6, checkout and payment, in a real browser against the real
   server on a LOCAL copy of the live data (default nandam_w5e2e). Razorpay's window is the
   stand-in in fixtures/fake-razorpay.js (served in place of Razorpay's script); the server must
   run with the stand-in for Razorpay's servers:
     PAYMENTS_ENABLED=true PAYMENT_PROVIDER=fake RAZORPAY_KEY_ID=rzp_test_fakeprovider01
     RAZORPAY_KEY_SECRET=… RAZORPAY_WEBHOOK_SECRET=<NH_WEBHOOK_SECRET> SMS_PROVIDER=console
   It signs up test customers, buys sarees in that copy, and for a moment changes a price or marks
   a saree sold (put back straight after); at the end the sarees it bought go back in stock.
     node e2e/w6.e2e.cjs           (Chrome: 1440 light, 390 dark; screenshots in e2e/out/)
   Env: NH_WEB, NH_API, NH_E2E_DB, NH_WEBHOOK_SECRET, CHROME_PATH, NH_ENGINE=webkit + WEBKIT_PATH,
        NH_ROUNDS, NH_NO_SHOTS=1. */
const { chromium, webkit } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.NH_WEB || 'http://localhost:5180';
const ROOT = process.env.NH_API || 'http://127.0.0.1:4300';
const API = `${ROOT}/api/v2/shop`;
const DB = process.env.NH_E2E_DB || 'nandam_w5e2e';
const HOOK_SECRET = process.env.NH_WEBHOOK_SECRET || 'e2e_webhook_secret_0123456789abcdef';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@18/bin/psql';
const OUT = path.join(__dirname, 'out');
const FAKE_RZP = fs.readFileSync(path.join(__dirname, 'fixtures', 'fake-razorpay.js'), 'utf8');
const ENGINE = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const ROUNDS = (process.env.NH_ROUNDS || '1440-light,390-dark').split(',');
fs.mkdirSync(OUT, { recursive: true });
if (!/^nandam_(w5e2e|e2e|test)$/.test(DB)) throw new Error('Refusing: NH_E2E_DB must be a local test copy (nandam_w5e2e, nandam_e2e or nandam_test)');

const fails = [];
const errors = [];
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ok   ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); }
};
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const sql = (q) => execFileSync(PSQL, ['-d', DB, '-Atc', q], { encoding: 'utf8' }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const get = async (p) => (await fetch(`${API}${p}`)).json();
const rs = (v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`;
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await sleep(150); } };
const used = new Set();
const newMobile = () => { for (;;) { const m = `6${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`; if (!used.has(m)) { used.add(m); return m; } } };
const fmt = (m) => `${m.slice(0, 5)} ${m.slice(5)}`;
const shut = (x) => Promise.race([x.close().catch(() => {}), sleep(5000)]);
const made = []; // order numbers made by this test (their sarees go back in stock at the end)

async function shot(page, name) {
  if (process.env.NH_NO_SHOTS) return;
  await page.screenshot({ path: path.join(OUT, `w6-${name}.png`), caret: 'initial' });
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
      unlabelled: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((i) => visible(i) && !(i.labels?.length || i.getAttribute('aria-label'))).length,
    };
  });
  ok(r.h1 === 1, `${label}: one main heading (${r.h1})`);
  ok(r.noAlt === 0, `${label}: every picture has alt text`);
  ok(!r.unnamed.length, `${label}: every button and link has a name ${r.unnamed.join(' | ')}`);
  ok(r.unlabelled === 0, `${label}: every field has a label`);
}

const piecesOf = (number) => sql(`SELECT string_agg(x.status, ',' ORDER BY x.status) FROM "OrderItem" i JOIN "Piece" x ON x.id = i."pieceId" JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" = ${q(number)}`);
const orderRow = (number) => {
  const [status, pay, inv, ship, reason] = sql(`SELECT o.status, coalesce(p.status,''), coalesce(i."invoiceNumber",''), coalesce(s.status,''), coalesce(o."cancelReason",'') FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id LEFT JOIN "Invoice" i ON i."orderId" = o.id LEFT JOIN "Shipment" s ON s."orderId" = o.id WHERE o."orderNumber" = ${q(number)}`).split('|');
  return { status, pay, inv, ship, reason };
};
const openNumber = (page) => page.evaluate(() => sessionStorage.getItem('nh-checkout'));
const bagCount = async (page) => { const n = page.locator('.hdr .bag-n'); return (await n.count()) ? Number(await n.innerText()) : 0; };
const stand = (page) => page.getByRole('dialog', { name: 'Razorpay test window' });

async function webhookCaptured(payment) {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: payment } } });
  const sig = crypto.createHmac('sha256', HOOK_SECRET).update(body).digest('hex');
  const r = await fetch(`${ROOT}/api/v2/payments/razorpay/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig, 'x-razorpay-event-id': `evt_e2e_${crypto.randomBytes(6).toString('hex')}` }, body });
  return r.json();
}

async function addFromPage(page, slug) {
  await page.goto(`${BASE}/product/${slug}`);
  await page.locator('.buy h1').waitFor();
  await page.locator('.buy-row').getByRole('button', { name: /Add .*bag/ }).click();
  await page.getByRole('dialog', { name: /Added to your bag|Your bag/ }).waitFor();
}
async function codeFrom(page, action) {
  const reply = page.waitForResponse((r) => /\/auth\/code$/.test(r.url()) && r.request().method() === 'POST');
  await action();
  return (await reply).json().catch(() => ({}));
}
async function typeCode(page, code) {
  await page.locator('.otp-row input').first().click();
  await page.keyboard.type(code, { delay: 30 });
}
async function checkoutReady(page) {
  await page.locator('main h1').waitFor();
  await until(async () => (await page.locator('.co-grid, .co-gate, .empty').count()) > 0);
}
// Pay: the summary's button on a laptop, the bar at the bottom on a phone.
const payButton = (page, phone) => (phone ? page.locator('.pay-bar').getByRole('button', { name: /^Pay ₹/ }) : page.locator('.co-sum').getByRole('button', { name: /^Pay ₹/ }));
async function deliverHere(page) {
  await page.getByRole('button', { name: 'Deliver here' }).click();
  await page.locator('.co-lines').waitFor();
}

async function run(browser, spec, round, picks) {
  const state = {};
  try {
    await steps(browser, spec, round, picks, state);
  } catch (err) {
    if (state.page) {
      await state.page.screenshot({ path: path.join(OUT, 'w6-FAILED.png'), fullPage: true }).catch(() => {});
      console.log('--- page at the failure ---\n', (await state.page.locator('main').innerText().catch(() => '')).slice(0, 1500));
    }
    throw err;
  }
}

async function steps(browser, spec, round, picks, state) {
  const [w, mode] = spec.split('-');
  const width = Number(w);
  const phone = width < 900;
  const tag = `${ENGINE}-${width}-${mode}`;
  console.log(`\n=== ${tag} ===`);
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, colorScheme: mode, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  // Playwright tries the last route first: anything else of Razorpay's is blocked, its script is the stand-in.
  await ctx.route(/razorpay\.com/, (r) => r.abort());
  await ctx.route('https://checkout.razorpay.com/v1/checkout.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_RZP }));
  await ctx.route(/wa\.me/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp (test)</title>' }));
  const page = await ctx.newPage();
  state.page = page;
  page.setDefaultTimeout(15000);
  const cancelled = (t) => ENGINE === 'webkit' && /due to access control checks/.test(t);
  page.on('pageerror', (e) => { if (!cancelled(e.message)) errors.push(`${tag} page error: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !cancelled(m.text()) && !/Failed to load resource: (the server responded with a status of (401|404|409|400|429)|net::ERR_INTERNET_DISCONNECTED)/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });

  const [s1, s2, s3, s4, s5] = picks.slice(round * 5, round * 5 + 5);
  const mobile = newMobile();

  /* ---------- A visitor: Checkout in the bag, then sign in ---------- */
  await addFromPage(page, s1.slug);
  const panel = page.getByRole('dialog', { name: /Added to your bag|Your bag/ });
  ok(await panel.getByRole('link', { name: 'Checkout' }).isVisible(), `${tag}: the side panel's main button is Checkout`);
  ok(await panel.getByRole('button', { name: 'Order on WhatsApp instead' }).isVisible(), `${tag}: WhatsApp stays as a small link`);
  await shot(page, `${tag}-panel`);
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/bag`);
  await page.locator('.bagp').waitFor();
  ok(await page.locator('.sum').getByRole('link', { name: 'Checkout' }).isVisible(), `${tag}: the bag's main button is Checkout`);
  ok(/Secure payment by Razorpay/.test(await page.locator('.sum').innerText()), `${tag}: the bag says payment is by Razorpay`);
  if (phone) ok(await page.locator('.bag-bar').getByRole('link', { name: 'Checkout' }).isVisible(), `${tag}: the phone bar has Checkout`);
  await (phone ? page.locator('.bag-bar') : page.locator('.sum')).getByRole('link', { name: 'Checkout' }).click();
  await page.waitForURL(/\/checkout$/);
  await checkoutReady(page);
  ok(await page.getByRole('heading', { name: 'Sign in to check out' }).isVisible(), `${tag}: a visitor is asked to sign in, the bag kept`);
  await a11y(page, `${tag} checkout (signed out)`);
  await shot(page, `${tag}-gate`);
  await page.locator('.co-gate').getByRole('link', { name: 'Sign in' }).click();
  await page.waitForURL(/\/sign-in\?next=%2Fcheckout$/);
  await page.getByLabel('Mobile number').fill(fmt(mobile));
  const sent = await codeFrom(page, () => page.getByRole('button', { name: 'Send code' }).click());
  await page.locator('.otp-row').waitFor();
  await typeCode(page, sent.devCode);
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  await page.getByLabel('Full name').fill('Lakshmi Prasanna');
  await page.getByLabel('Email').fill(`w6.${mobile}@example.com`);
  await page.getByLabel('Pincode').fill('522503');
  await page.locator('.field-hint.ok').waitFor();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForURL(/\/checkout$/);
  await checkoutReady(page);
  ok(true, `${tag}: after signing up, straight back to checkout`);

  /* ---------- The first address, then Pay and paid ---------- */
  await page.getByRole('heading', { name: 'New address' }).waitFor();
  ok(true, `${tag}: no saved address: the form opens at once`);
  ok(await page.getByLabel('Full name').inputValue() === 'Lakshmi Prasanna', `${tag}: the name is filled in`);
  await page.getByLabel('House, flat, building').fill('D.No. 9-41, Gandhi Nagar');
  await page.getByLabel('Landmark').fill('Near the temple');
  await page.locator('#co-af-pin').fill('522503');
  await until(async () => (await page.getByLabel('State').inputValue()) === 'Andhra Pradesh');
  await shot(page, `${tag}-address-form`);
  await page.getByRole('button', { name: 'Save and deliver here' }).click();
  await page.locator('.co-lines').waitFor();
  ok((await page.locator('.co-done').innerText()).includes('Near the temple'), `${tag}: the address step is done, with the landmark`);
  const lineText = await page.locator('.co-lines').innerText();
  ok(lineText.includes(s1.sku) && lineText.includes(rs(s1.price)), `${tag}: the review shows the saree with its code and price`);
  ok(/Includes GST 5% .*CGST 2\.5% \+ SGST 2\.5%/.test(await page.locator('.co-sum .tax').innerText()), `${tag}: the GST note`);
  await a11y(page, `${tag} checkout (review)`);
  await noSideScroll(page, `${tag} checkout`);
  await shot(page, `${tag}-review`);
  await payButton(page, phone).click();
  await stand(page).waitFor();
  const opts = await page.evaluate(() => window.__rzpLast);
  ok(opts.amount === s1.price * 100 && opts.currency === 'INR' && /^rzp_test_/.test(opts.key) && /^order_/.test(opts.order_id), `${tag}: Razorpay opens with the exact amount in paise and our payment request`);
  ok(opts.prefill?.contact === `+91${mobile}` && opts.prefill?.name === 'Lakshmi Prasanna', `${tag}: name and mobile are filled in Razorpay's window`);
  ok(opts.timeout > 14 * 60 && opts.timeout <= 15 * 60, `${tag}: the window closes with the hold (${opts.timeout} s)`);
  ok(await page.locator('.hold-line').isVisible(), `${tag}: "held for you until" shows while paying`);
  let number = await openNumber(page);
  ok(/^NH\d{8}$/.test(number || ''), `${tag}: the order number is ${number}`);
  ok(piecesOf(number) === 'reserved', `${tag}: the saree is held (reserved) while paying`);
  await shot(page, `${tag}-razorpay`);
  await stand(page).getByRole('button', { name: 'Pay (test)' }).click();
  await page.waitForURL(new RegExp(`/order/${number}$`));
  await page.getByRole('heading', { level: 1, name: 'Thank you, Lakshmi' }).waitFor();
  made.push(number);
  ok((await page.locator('.ord-hero').innerText()).includes(`${number} is confirmed and paid: ${rs(s1.price)} by UPI`), `${tag}: Order confirmed with the number, total and method`);
  ok((await page.locator('.ord-grid').innerText()).includes('Paid'), `${tag}: the order page shows the payment`);
  const row = orderRow(number);
  ok(row.status === 'processing' && row.pay === 'paid', `${tag}: in the database: processing (To ship in the admin app), payment paid`);
  ok(/^INV-\d{6}$/.test(row.inv) && row.ship === 'not_shipped', `${tag}: the GST invoice ${row.inv} and the shipment are made`);
  ok(piecesOf(number) === 'sold_online', `${tag}: the saree is sold online`);
  await until(async () => (await bagCount(page)) === 0);
  ok((await bagCount(page)) === 0, `${tag}: the bought saree left the bag`);
  await a11y(page, `${tag} order confirmed`);
  await noSideScroll(page, `${tag} order confirmed`);
  await shot(page, `${tag}-confirmed`);

  /* ---------- Closed, failed, then paid ---------- */
  await addFromPage(page, s2.slug);
  await page.goto(`${BASE}/checkout`);
  await checkoutReady(page);
  ok(await page.getByRole('radio', { name: /Gandhi Nagar/ }).isChecked(), `${tag}: the saved address is already chosen`);
  await deliverHere(page);
  await payButton(page, phone).click();
  await stand(page).waitFor();
  number = await openNumber(page);
  await stand(page).getByRole('button', { name: 'Close (test)' }).click();
  const closed = page.getByRole('alert').filter({ hasText: 'Payment not completed' });
  await closed.waitFor();
  ok(/Your sarees are held for you until \d{1,2}:\d{2} [ap]m/.test(await closed.innerText()), `${tag}: window closed: "Payment not completed", held until a time`);
  ok(piecesOf(number) === 'reserved', `${tag}: still held after closing the window`);
  await shot(page, `${tag}-closed`);
  await closed.getByRole('button', { name: 'Pay now' }).click();
  await stand(page).waitFor();
  ok(await openNumber(page) === number, `${tag}: Pay now reuses the same order`);
  await stand(page).getByRole('button', { name: 'Fail (test)' }).click();
  await sleep(400);
  await stand(page).getByRole('button', { name: 'Close (test)' }).click();
  const failed = page.getByRole('alert').filter({ hasText: 'Payment didn\'t go through. Nothing was taken.' });
  await failed.waitFor();
  ok(true, `${tag}: a failed payment says nothing was taken`);
  await shot(page, `${tag}-failed`);
  await failed.getByRole('button', { name: 'Try again' }).click();
  await stand(page).getByRole('button', { name: 'Pay (test)' }).click();
  await page.waitForURL(new RegExp(`/order/${number}$`));
  await page.getByRole('heading', { level: 1, name: 'Thank you, Lakshmi' }).waitFor();
  made.push(number);
  ok(orderRow(number).status === 'processing' && piecesOf(number) === 'sold_online', `${tag}: paid on the third try: one order, sold once`);
  ok(sql(`SELECT count(*) FROM "PaymentAttempt" a JOIN "Order" o ON o.id = a."orderId" WHERE o."orderNumber" = ${q(number)}`) === '3', `${tag}: three payment requests for one order`);

  /* ---------- "Change my bag" ---------- */
  await addFromPage(page, s3.slug);
  await page.goto(`${BASE}/checkout`);
  await checkoutReady(page);
  await deliverHere(page);
  await payButton(page, phone).click();
  await stand(page).waitFor();
  number = await openNumber(page);
  await stand(page).getByRole('button', { name: 'Close (test)' }).click();
  await page.getByRole('alert').filter({ hasText: 'Payment not completed' }).getByRole('button', { name: 'Change my bag' }).click();
  await page.waitForURL(/\/bag$/);
  ok(orderRow(number).status === 'cancelled' && piecesOf(number) === 'in_stock', `${tag}: Change my bag ends the checkout and puts the saree back on sale`);
  await page.locator('.bagp').waitFor();
  ok((await page.locator('.blines').innerText()).includes(s3.sku), `${tag}: the saree is still in the bag`);

  /* ---------- A price changes before Pay ---------- */
  await page.goto(`${BASE}/checkout`);
  await checkoutReady(page);
  await deliverHere(page);
  sql(`UPDATE "Subcategory" SET "onlinePrice" = "onlinePrice" + 100 WHERE id = (SELECT "subcategoryId" FROM "Product" WHERE slug = ${q(s3.slug)})`);
  try {
    await payButton(page, phone).click();
    await page.getByRole('alert').filter({ hasText: 'Something changed before you paid' }).waitFor();
    ok(await stand(page).count() === 0, `${tag}: a new price stops Pay: nothing charged, no window`);
    await until(async () => (await page.locator('.co-lines').innerText()).includes('price changed from'));
    ok((await page.locator('.co-lines').innerText()).includes(`price changed from ${rs(s3.price)}`), `${tag}: the line shows the price change`);
    ok((await page.locator(phone ? '.pay-bar .t b' : '.co-sum .sumrow.total .v').innerText()) === rs(s3.price + 100), `${tag}: the total uses the new price`);
    await shot(page, `${tag}-changed`);
  } finally {
    sql(`UPDATE "Subcategory" SET "onlinePrice" = "onlinePrice" - 100 WHERE id = (SELECT "subcategoryId" FROM "Product" WHERE slug = ${q(s3.slug)})`);
  }

  /* ---------- The phone loses the connection after paying: Razorpay's notice completes it ---------- */
  await page.goto(`${BASE}/checkout`);
  await checkoutReady(page);
  await deliverHere(page);
  await payButton(page, phone).click();
  await stand(page).waitFor();
  number = await openNumber(page);
  await stand(page).getByRole('button', { name: 'Lose connection (test)' }).click();
  await until(async () => page.evaluate(() => !!window.__rzpLost));
  const lost = await page.evaluate(() => window.__rzpLost);
  ok(orderRow(number).status === 'pending_payment', `${tag}: paid, but the server hasn't heard yet`);
  const hook = await webhookCaptured(lost);
  ok(hook.result === 'paid', `${tag}: Razorpay's notice completes the order (${hook.result})`);
  // The customer opens the website again: it says the order is confirmed, once.
  await page.goto(`${BASE}/shop`);
  const news = page.locator('.order-notice');
  await news.waitFor();
  ok((await news.innerText()).includes(`Your order ${number} is confirmed and paid`), `${tag}: back on the website, "Your order … is confirmed" shows`);
  await shot(page, `${tag}-order-notice`);
  await news.getByRole('link', { name: 'See the order' }).click();
  await page.waitForURL(new RegExp(`/order/${number}$`));
  await page.getByRole('heading', { level: 1, name: 'Thank you, Lakshmi' }).waitFor();
  await page.goto(`${BASE}/shop`);
  await page.locator('main h1').waitFor();
  await sleep(800);
  ok(await page.locator('.order-notice').count() === 0, `${tag}: said once (not again after seeing the order)`);
  // Opened again later: the order's own page (W7), no second "Thank you".
  await page.goto(`${BASE}/order/${number}`);
  await page.getByRole('heading', { level: 1, name: `Order ${number}` }).waitFor();
  made.push(number);
  ok(piecesOf(number) === 'sold_online', `${tag}: the order page shows it paid; sold once`);
  ok((await webhookCaptured(lost)).result === 'paid', `${tag}: the same payment again changes nothing`);

  /* ---------- Paid after a saree sold at the store: refunded ---------- */
  await addFromPage(page, s4.slug);
  await page.goto(`${BASE}/checkout`);
  await checkoutReady(page);
  await page.getByText(`Your payment for order ${number} went through`).waitFor();
  ok(true, `${tag}: back at checkout, the earlier payment is said to have gone through`);
  await deliverHere(page);
  await payButton(page, phone).click();
  await stand(page).waitFor();
  number = await openNumber(page);
  const rzOrder = (await page.evaluate(() => window.__rzpLast)).order_id;
  await stand(page).getByRole('button', { name: 'Close (test)' }).click();
  await page.getByRole('alert').filter({ hasText: 'Payment not completed' }).waitFor();
  const pieceIds = sql(`SELECT string_agg(quote_literal(i."pieceId"), ',') FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" = ${q(number)}`);
  sql(`UPDATE "Reservation" SET status = 'expired', "expiresAt" = (now() AT TIME ZONE 'UTC') WHERE "orderId" = (SELECT id FROM "Order" WHERE "orderNumber" = ${q(number)}) AND status = 'active'`);
  sql(`UPDATE "Piece" SET status = 'sold_offline' WHERE id IN (${pieceIds})`);
  try {
    const paid = await (await fetch(`${ROOT}/api/v2/payments/fake/pay`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: rzOrder }) })).json();
    const r = await webhookCaptured(paid.payment);
    ok(r.result === 'refunded', `${tag}: paid after the saree sold at the store: refunded automatically (${r.result})`);
    await page.goto(`${BASE}/order/${number}`);
    await page.getByRole('heading', { level: 1, name: `Order ${number}` }).waitFor();
    const refundNote = await page.locator('.ord-view .alert').first().innerText();
    ok(new RegExp(`Your ${rs(s4.price)} (is being|was) refunded`).test(refundNote) && /sold/i.test(refundNote), `${tag}: the customer sees the refund (and why) on the order's page`);
    ok(orderRow(number).status === 'cancelled' && piecesOf(number) === 'sold_offline', `${tag}: never sold twice`);
    await a11y(page, `${tag} refunded`);
    await shot(page, `${tag}-refunded`);
  } finally {
    sql(`UPDATE "Piece" SET status = 'in_stock' WHERE id IN (${pieceIds})`);
  }

  /* ---------- The 15 minutes end (once) ---------- */
  if (round === 0) {
    await addFromPage(page, s5.slug);
    await page.goto(`${BASE}/checkout`);
    await checkoutReady(page);
    await deliverHere(page);
    await payButton(page, phone).click();
    await stand(page).waitFor();
    number = await openNumber(page);
    await stand(page).getByRole('button', { name: 'Close (test)' }).click();
    sql(`UPDATE "Reservation" SET "expiresAt" = (now() AT TIME ZONE 'UTC') - interval '1 second' WHERE "orderId" = (SELECT id FROM "Order" WHERE "orderNumber" = ${q(number)})`);
    const ended = await until(async () => /^in_stock(,in_stock)*$/.test(piecesOf(number)), 45000);
    ok(ended, `${tag}: the server ends the hold by itself (saree back on sale)`);
    await page.goto(`${BASE}/order/${number}`);
    await page.getByRole('heading', { name: 'The 15 minutes are over' }).waitFor();
    ok(orderRow(number).status === 'pending_payment', `${tag}: the order stays in Unpaid checkouts`);
    await shot(page, `${tag}-hold-ended`);
  }

  /* ---------- The pages Razorpay asks for ---------- */
  for (const [p, h] of [['/shipping', 'Shipping policy'], ['/refunds', 'Cancellation and refunds'], ['/contact', 'Contact us']]) {
    await page.goto(`${BASE}${p}`);
    await page.getByRole('heading', { level: 1, name: h }).waitFor();
    ok(await page.locator('footer').getByRole('link', { name: h === 'Shipping policy' ? 'Shipping' : h }).count() === 1, `${tag}: ${p} opens and the footer links to it`);
  }
  await a11y(page, `${tag} contact`);
  await noSideScroll(page, `${tag} contact`);

  await page.goto('about:blank').catch(() => {});
  await shut(page);
  await shut(ctx);
}

(async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  ok(/Disallow: \/checkout/.test(robots) && /Disallow: \/order\//.test(robots), 'search engines are kept out of checkout and order pages');
  const cfg = await get('/config');
  if (!cfg.payments?.enabled) throw new Error('The server must run with PAYMENTS_ENABLED=true PAYMENT_PROVIDER=fake (see the top of this file)');
  const picks = (await get('/products?sort=new&offset=48&limit=48')).items.filter((c) => c.available === 1 && c.price >= 500);
  if (picks.length < ROUNDS.length * 5) throw new Error('Not enough real sarees in the test copy');
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  try {
    for (let i = 0; i < ROUNDS.length; i++) await run(browser, ROUNDS[i], i, picks);
  } finally {
    await Promise.race([browser.close(), sleep(5000)]);
    // The sarees this test bought go back in stock in the test copy.
    if (made.length) {
      sql(`UPDATE "Piece" SET status = 'in_stock', "soldAt" = NULL WHERE id IN (SELECT i."pieceId" FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" IN (${made.map(q).join(',')}) AND i."pieceId" IS NOT NULL)`);
      sql(`UPDATE "Order" SET status = 'cancelled', "cancelReason" = 'Browser test (w6.e2e)', "cancelledAt" = now() WHERE "orderNumber" IN (${made.map(q).join(',')})`);
    }
  }
  ok(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  console.log(`\n${passed} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
