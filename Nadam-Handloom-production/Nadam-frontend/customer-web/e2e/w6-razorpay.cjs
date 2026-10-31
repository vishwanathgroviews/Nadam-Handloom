/* W6 with Razorpay's REAL payment window in TEST MODE (no money): the server runs with
   PAYMENT_PROVIDER=razorpay and the test keys (rzp_test_…) in Nadam-backend/.env.
     node e2e/w6-razorpay.cjs explore    (stops at Razorpay's window: screenshot + its text)
     node e2e/w6-razorpay.cjs            (the payments: UPI success, UPI failure, card)
   Env as w6.e2e.cjs (NH_WEB, NH_API, NH_E2E_DB, NH_ENGINE, WEBKIT_PATH). Buys sarees in the
   local copy and puts them back at the end. Screenshots in e2e/out/w6rz-*.png. */
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
const MODE = process.argv[2] || 'run';
fs.mkdirSync(OUT, { recursive: true });
if (!/^nandam_(w5e2e|e2e|test)$/.test(DB)) throw new Error('Refusing: a local test copy only');

const fails = [];
let passed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log(`  ok   ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); } };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const sql = (q) => execFileSync(PSQL, ['-d', DB, '-Atc', q], { encoding: 'utf8' }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await sleep(250); } };
const newMobile = () => `6${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
const fmt = (m) => `${m.slice(0, 5)} ${m.slice(5)}`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `w6rz-${ENGINE}-${name}.png`) }).catch(() => {});
const made = [];
const piecesOf = (n) => sql(`SELECT string_agg(x.status, ',') FROM "OrderItem" i JOIN "Piece" x ON x.id = i."pieceId" JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" = ${q(n)}`);
const orderRow = (n) => sql(`SELECT o.status || '|' || coalesce(p.status,'') || '|' || coalesce(p.method,'') || '|' || coalesce(p."razorpayPaymentId",'') FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o.id WHERE o."orderNumber" = ${q(n)}`).split('|');

async function signUp(page, mobile) {
  await page.goto(`${BASE}/sign-in?next=%2Fcheckout`);
  await page.getByLabel('Mobile number').fill(fmt(mobile));
  const reply = page.waitForResponse((r) => /\/auth\/code$/.test(r.url()) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send code' }).click();
  const sent = await (await reply).json();
  await page.locator('.otp-row input').first().click();
  await page.keyboard.type(sent.devCode, { delay: 30 });
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  await page.getByLabel('Full name').fill('Sravani Test');
  await page.getByLabel('Email').fill(`rz.${mobile}@example.com`);
  await page.getByLabel('Pincode').fill('522503');
  await page.locator('.field-hint.ok').waitFor();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForURL(/\/checkout$/);
}
async function addAndCheckout(page, slug, first) {
  await page.goto(`${BASE}/product/${slug}`);
  await page.locator('.buy-row').getByRole('button', { name: /Add .*bag/ }).click();
  await page.getByRole('dialog', { name: /Added to your bag|Your bag/ }).waitFor();
  await page.goto(`${BASE}/checkout`);
  await page.locator('main h1').waitFor();
  if (first) {
    await page.getByRole('heading', { name: 'New address' }).waitFor();
    await page.getByLabel('House, flat, building').fill('D.No. 9-41, Gandhi Nagar');
    await page.locator('#co-af-pin').fill('522503');
    await until(async () => (await page.getByLabel('State').inputValue()) === 'Andhra Pradesh');
    await page.getByRole('button', { name: 'Save and deliver here' }).click();
  } else {
    await page.getByRole('button', { name: 'Deliver here' }).click();
  }
  await page.locator('.co-lines').waitFor();
}
const frame = (page) => page.frameLocator('iframe.razorpay-checkout-frame');
// Closes Razorpay's window as a customer would: the retry panel, the window's ×, then "yes".
async function closeWindow(page) {
  const f = frame(page);
  for (const sel of ['button.absolute.right-2.top-2', 'button.absolute.right-0.top-0']) {
    const b = f.locator(sel).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await sleep(800); }
  }
  const head = f.locator('button.h-7.w-7');
  const n = await head.count();
  if (n) { await head.nth(n - 1).click().catch(() => {}); await sleep(1500); }
  const texts = await f.locator('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => (e.innerText || '').trim()).filter(Boolean));
  const yes = texts.find((t) => /^(yes|exit|cancel|close)/i.test(t));
  if (yes) await f.getByRole('button', { name: yes }).first().click().catch(() => {});
  return { asked: texts };
}
// Pays with Razorpay's test card in its real window; the demo bank page answers Success or Failure.
async function payByCard(page, ctx, outcome) {
  const f = frame(page);
  await f.getByText('Cards', { exact: true }).first().click();
  await f.locator('input[name="card.number"]').fill('4111 1111 1111 1111');
  await f.locator('input[name="card.expiry"]').fill('12 / 30');
  await f.locator('input[name="card.cvv"]').fill('123');
  const popup = ctx.waitForEvent('page', { timeout: 30000 });
  await f.getByRole('button', { name: 'Continue' }).click();
  // The first press checks the card; a second may be needed to start the payment.
  for (let i = 0; i < 3; i++) {
    const p = await Promise.race([popup, sleep(5000).then(() => null)]);
    if (p) break;
    if (await f.getByRole('button', { name: 'Continue' }).isVisible().catch(() => false)) await f.getByRole('button', { name: 'Continue' }).click().catch(() => {});
  }
  const bank = await popup;
  await bank.getByRole('button', { name: outcome }).waitFor({ timeout: 20000 });
  await bank.screenshot({ path: path.join(OUT, `w6rz-${ENGINE}-bank.png`) }).catch(() => {});
  await bank.getByRole('button', { name: outcome }).click();
}
async function openWindow(page) {
  await page.locator('.co-sum').getByRole('button', { name: /^Pay ₹/ }).click();
  await page.locator('iframe.razorpay-checkout-frame').waitFor({ timeout: 30000 });
  await sleep(2500);
  return sql(`SELECT "orderNumber" FROM "Order" WHERE "orderNumber" = ${q(await page.evaluate(() => sessionStorage.getItem('nh-checkout')))}`);
}

(async () => {
  const picks = (await (await fetch(`${API}/products?sort=new&offset=120&limit=48`)).json()).items.filter((c) => c.available === 1 && c.price >= 500);
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
  // Security-policy refusals on OUR page (the live nginx settings are copied in vite preview).
  const blocked = [];
  // (Razorpay's window asks for the motion sensor for its fraud checks and is refused inside its own
  // frame: the same message shows with no settings at all, and paying works. Not ours.)
  page.on('console', (m) => { if (/Content Security Policy|Permissions policy/i.test(m.text()) && !/accelerometer|devicemotion|sensor/i.test(m.text()) && !/api\.razorpay\.com/.test(m.location()?.url || '')) blocked.push(m.text().slice(0, 220)); });
  try {
    await signUp(page, newMobile());
    await addAndCheckout(page, picks[0].slug, true);
    const number = await openWindow(page);
    console.log('order', number);
    if (MODE === 'run') {
      made.push(number);
      // 1. A card payment that succeeds.
      await payByCard(page, ctx, 'Success');
      await page.waitForURL(new RegExp(`/order/${number}$`), { timeout: 60000 });
      await page.getByRole('heading', { level: 1, name: /^Thank you/ }).waitFor({ timeout: 30000 });
      ok(true, `paid by card in Razorpay's test window: order page says thank you (${number})`);
      const [status, pay, method, payId] = orderRow(number);
      ok(status === 'processing' && pay === 'paid', `the server checked it with Razorpay: order processing, payment paid (${status}, ${pay})`);
      ok(method === 'card' && /^pay_/.test(payId), `Razorpay's own record: method ${method}, payment ${payId.slice(0, 8)}…`);
      ok(piecesOf(number) === 'sold_online', 'the saree is sold online');
      ok((await page.locator('.ord-hero').innerText()).includes('by Card'), 'the order page says it was paid by card');
      await shot(page, 'paid');
      // 2. A card payment the bank refuses.
      await addAndCheckout(page, picks[1].slug, false);
      const n2 = await openWindow(page);
      made.push(n2);
      await payByCard(page, ctx, 'Failure');
      await frame(page).getByText('Payment failed').first().waitFor({ timeout: 30000 });
      ok(true, 'Razorpay says "Payment failed" and offers a retry in its window');
      await shot(page, 'failed-in-window');
      const closed = await closeWindow(page);
      console.log('  (window buttons when closing:', JSON.stringify(closed.asked), ')');
      await page.getByText('Payment didn\'t go through. Nothing was taken.').waitFor({ timeout: 30000 });
      ok(true, 'a refused card: "Payment didn\'t go through. Nothing was taken." with Try again');
      ok(orderRow(n2)[0] === 'pending_payment' && piecesOf(n2) === 'reserved', 'nothing paid; the saree still held for the customer');
      await shot(page, 'failed');
      const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null);
      const head = (await fetch(BASE)).headers.get('content-security-policy');
      console.log(`  (security policy on this site: ${head ? 'yes' : 'none (dev server)'}${csp ? ', meta' : ''})`);
      ok(!blocked.length, `nothing of Razorpay's blocked by our page's security settings${blocked.length ? `: ${blocked.slice(0, 3).join(' | ')}` : ''}`);
    }
    if (MODE === 'explore5') {
      made.push(number);
      await payByCard(page, ctx, 'Failure');
      await sleep(9000);
      await shot(page, 'failure-msg');
      const f = frame(page);
      console.log('--- after Failure ---\n', (await f.locator('body').innerText()).replace(/\n[0-9,\n]+\n/g, '\n').slice(0, 900));
      const buttons = await f.locator('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => `${(e.innerText || '').trim().slice(0, 30)}|${e.getAttribute('aria-label') || ''}|${e.className.slice(0, 40)}`));
      console.log('buttons', JSON.stringify(buttons, null, 1));
    }
    if (MODE === 'explore4') {
      const f = frame(page);
      await f.getByText('Cards', { exact: true }).first().click();
      await f.locator('input[name="card.number"]').fill('4111 1111 1111 1111');
      await f.locator('input[name="card.expiry"]').fill('12 / 30');
      await f.locator('input[name="card.cvv"]').fill('123');
      const calls = [];
      page.on('response', (r) => { if (/razorpay\.com\/v1\/(payments|standard_checkout|checkout)/.test(r.url())) calls.push(`${r.status()} ${r.request().method()} ${r.url().replace(/\?.*$/, '').slice(0, 100)}`); });
      const popup = ctx.waitForEvent('page', { timeout: 25000 }).catch(() => null);
      await f.getByRole('button', { name: 'Continue' }).click();
      await sleep(4000);
      await shot(page, 'after-continue-1');
      if (await f.getByRole('button', { name: 'Continue' }).isVisible().catch(() => false)) await f.getByRole('button', { name: 'Continue' }).click();
      await sleep(6000);
      console.log('razorpay calls:', JSON.stringify(calls.slice(-8), null, 1));
      await shot(page, 'after-continue');
      console.log('--- window after Continue ---\n', (await f.locator('body').innerText()).replace(/\n[0-9,\n]+\n/g, '\n').slice(0, 1200));
      const p = await popup;
      if (p) {
        await p.waitForLoadState().catch(() => {});
        await sleep(2000);
        await p.screenshot({ path: path.join(OUT, `w6rz-${ENGINE}-bank.png`) }).catch(() => {});
        console.log('--- popup', p.url().slice(0, 80), '---\n', (await p.locator('body').innerText().catch(() => '')).slice(0, 800));
        const buttons = await p.locator('button, input[type=submit], a').evaluateAll((els) => els.map((e) => (e.innerText || e.value || '').trim()).filter(Boolean).slice(0, 20));
        console.log('popup buttons', JSON.stringify(buttons));
      } else console.log('no popup');
      made.push(number);
    }
    if (MODE === 'explore3') {
      const f = frame(page);
      await f.getByText('Cards', { exact: true }).first().click();
      await sleep(2500);
      await shot(page, 'cards');
      const inputs = await f.locator('input').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => ({ name: e.name, type: e.type, ph: e.placeholder, id: e.id, aria: e.getAttribute('aria-label'), auto: e.autocomplete })));
      console.log('inputs', JSON.stringify(inputs));
      const buttons = await f.locator('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)));
      console.log('buttons', JSON.stringify(buttons));
      made.push(number);
    }
    if (MODE === 'explore2') {
      const f = frame(page);
      await f.getByText('UPI', { exact: true }).first().click();
      await sleep(2000);
      await shot(page, 'upi');
      console.log('--- after UPI ---\n', (await f.locator('body').innerText()).replace(/\n[0-9,\n]+\n/g, '\n').slice(0, 1500));
      const inputs = await f.locator('input').evaluateAll((els) => els.map((e) => ({ name: e.name, type: e.type, ph: e.placeholder, id: e.id, aria: e.getAttribute('aria-label'), visible: !!e.offsetParent })));
      console.log('inputs', JSON.stringify(inputs.filter((i) => i.visible)));
      const buttons = await f.locator('button').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)));
      console.log('buttons', JSON.stringify(buttons));
      made.push(number);
    }
    if (MODE === 'explore') {
      await shot(page, 'window');
      const text = await frame(page).locator('body').innerText().catch((e) => `(no text: ${e.message})`);
      console.log('--- Razorpay window text ---\n', text.slice(0, 2500));
      const html = await frame(page).locator('body').innerHTML().catch(() => '');
      fs.writeFileSync('/private/tmp/claude-501/-Users-adusumillisrisumanthgmail-com-Documents-Nandam-Handlooms/02e37212-65dd-46e7-bafd-7d7518dc7d1b/scratchpad/rzp-run/window.html', html);
      console.log('errors:', errors.slice(0, 8));
      made.push(number);
    }
  } finally {
    if (made.length) {
      sql(`UPDATE "Piece" SET status = 'in_stock', "soldAt" = NULL WHERE id IN (SELECT i."pieceId" FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" IN (${made.map(q).join(',')}) AND i."pieceId" IS NOT NULL)`);
      sql(`UPDATE "Reservation" SET status = 'released' WHERE status = 'active' AND "orderId" IN (SELECT id FROM "Order" WHERE "orderNumber" IN (${made.map(q).join(',')}))`);
      sql(`UPDATE "Order" SET status = 'cancelled', "cancelReason" = 'Browser test (w6-razorpay)', "cancelledAt" = now() WHERE "orderNumber" IN (${made.map(q).join(',')})`);
    }
    await Promise.race([browser.close(), sleep(5000)]);
  }
  console.log(`\n${passed} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
