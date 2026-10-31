/* End-to-end test of website module W7, My orders, in a real browser against the real server on a
   LOCAL copy of the live data (default nandam_w5e2e), set up as for W6 (w6.e2e.cjs: the stand-in
   for Razorpay, PAYMENT_PROVIDER=fake). The shop's side (ship, delivered, cancel) goes through the
   admin app's own endpoints as the test owner of prisma/dev-seed.js (90000 00001, PIN 246810), on
   a device this test trusts in that copy and removes at the end.
   It signs up test customers, buys sarees, marks them shipped, delivered and cancelled, adds 20
   sample orders for "Show more" (removed at the end), and puts the sarees back in stock.
     node e2e/w7.e2e.cjs           (Chrome: 1440 light, 390 dark; screenshots in e2e/out/)
   On a real Android phone (NH_ENGINE=android): the phone's own Chrome, driven over USB. First
     adb reverse tcp:5180 tcp:5180 && adb reverse tcp:4300 tcp:4300
     adb forward tcp:9222 localabstract:chrome_devtools_remote   (Chrome open on the phone)
   The server must send real notifications (PUSH_PROVIDER=fcm and the website's Firebase settings).
   The phone round also turns notifications on, sees "shipped" as a message on the open page and
   "delivered" as a phone notification with Chrome in the background, and taps it. At the end the
   website's data on the phone (sign-in, notifications) and the downloaded test invoice are removed.
   Env: NH_WEB, NH_API, NH_E2E_DB, NH_WEBHOOK_SECRET, CHROME_PATH, NH_ENGINE=webkit + WEBKIT_PATH,
        NH_ENGINE=android + NH_CDP (default http://localhost:9222) + ADB, NH_ROUNDS, NH_NO_SHOTS=1. */
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
const ENGINE = ['webkit', 'android'].includes(process.env.NH_ENGINE) ? process.env.NH_ENGINE : 'chromium';
const ANDROID = ENGINE === 'android';
const ROUNDS = (process.env.NH_ROUNDS || (ANDROID ? 'phone-device' : '1440-light,390-dark')).split(',');
const ADB = process.env.ADB || `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });
const OWNER = { mobile: '9000000001', pin: '246810' };
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
const made = []; // order numbers this test bought (their sarees go back in stock at the end)
const samples = []; // the sample orders for "Show more" (removed at the end)
const awb = () => `W7${String(crypto.randomInt(1e9, 9e9))}`;

async function shot(page, name) {
  if (process.env.NH_NO_SHOTS) return;
  await page.screenshot({ path: path.join(OUT, `w7-${name}.png`), caret: 'initial', fullPage: true });
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

/* ---------- The shop's side: the admin app's endpoints as the test owner ---------- */
let owner = null;
async function ownerSignIn() {
  const deviceId = `w7-e2e-${crypto.randomUUID()}`;
  sql(`INSERT INTO "TrustedDevice" (id, "authAccountId", "deviceId", name, platform, "updatedAt") SELECT gen_random_uuid()::text, id, ${q(deviceId)}, 'W7 browser test', 'android', now() FROM "AuthAccount" WHERE phone = ${q(OWNER.mobile)}`);
  const r = await fetch(`${ROOT}/api/v2/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mobile: OWNER.mobile, pin: OWNER.pin, device: { id: deviceId, name: 'W7 browser test', platform: 'android' } }) });
  const body = await r.json();
  if (body.status !== 'signed_in') throw new Error(`The test owner couldn't sign in (run prisma/dev-seed.js on ${DB}): ${JSON.stringify(body).slice(0, 200)}`);
  owner = { deviceId, token: body.accessToken };
}
async function admin(method, p, body) {
  const r = await fetch(`${ROOT}/api/v2${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${owner.token}`, 'x-device-id': owner.deviceId }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const idOf = (number) => sql(`SELECT id FROM "Order" WHERE "orderNumber" = ${q(number)}`);
const noticeOf = (number, type) => sql(`SELECT status FROM "Notification" WHERE type = ${q(type)} AND data->>'orderNumber' = ${q(number)} ORDER BY "createdAt" DESC LIMIT 1`);
async function hook(event) {
  const body = JSON.stringify(event);
  const sig = crypto.createHmac('sha256', HOOK_SECRET).update(body).digest('hex');
  const r = await fetch(`${ROOT}/api/v2/payments/razorpay/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig, 'x-razorpay-event-id': `evt_w7_${crypto.randomBytes(6).toString('hex')}` }, body });
  return r.json();
}

/* ---------- The customer's side ---------- */
// On a phone the keyboard stays up after typing and the sticky header can sit over the button
// below the field: leave the field first (the keyboard goes), as a person would.
const doneTyping = (page) => (ANDROID ? page.evaluate(() => document.activeElement?.blur()).then(() => sleep(600)) : Promise.resolve());
const stand = (page) => page.getByRole('dialog', { name: 'Razorpay test window' });
const openNumber = (page) => page.evaluate(() => sessionStorage.getItem('nh-checkout'));
async function addFromPage(page, slug) {
  await page.goto(`${BASE}/product/${slug}`);
  await page.locator('.buy h1').waitFor();
  await page.locator('.buy-row').getByRole('button', { name: /Add .*bag/ }).click();
  await page.getByRole('dialog', { name: /Added to your bag|Your bag/ }).waitFor();
  await page.keyboard.press('Escape');
}
async function checkoutReady(page) {
  await page.locator('main h1').waitFor();
  await until(async () => (await page.locator('.co-grid, .co-gate, .empty').count()) > 0);
}
const payButton = (page, phone) => (phone ? page.locator('.pay-bar').getByRole('button', { name: /^Pay ₹/ }) : page.locator('.co-sum').getByRole('button', { name: /^Pay ₹/ }));
// Bag → checkout → Pay → the stand-in window: 'pay' or 'close'. Answers the order number.
async function buy(page, phone, slugs, { firstAddress = false, end = 'pay' } = {}) {
  for (const s of slugs) await addFromPage(page, s);
  await page.goto(`${BASE}/checkout`);
  await checkoutReady(page);
  if (firstAddress) {
    await page.getByRole('heading', { name: 'New address' }).waitFor();
    await page.getByLabel('House, flat, building').fill('D.No. 9-41, Gandhi Nagar');
    await page.getByLabel('Landmark').fill('Near the temple');
    await page.locator('#co-af-pin').fill('522503');
    await until(async () => (await page.getByLabel('State').inputValue()) === 'Andhra Pradesh');
    await doneTyping(page);
    await page.getByRole('button', { name: 'Save and deliver here' }).click();
  } else {
    await page.getByRole('button', { name: 'Deliver here' }).click();
  }
  await page.locator('.co-lines').waitFor();
  await payButton(page, phone).click();
  await stand(page).waitFor();
  const number = await openNumber(page);
  if (end === 'close') {
    await stand(page).getByRole('button', { name: 'Close (test)' }).click();
    await page.getByRole('alert').filter({ hasText: 'Payment not completed' }).waitFor();
    return number;
  }
  await stand(page).getByRole('button', { name: 'Pay (test)' }).click();
  await page.waitForURL(new RegExp(`/order/${number}$`));
  await page.getByRole('heading', { level: 1, name: /^Thank you/ }).waitFor();
  made.push(number);
  return number;
}
async function myOrders(page) {
  await page.goto(`${BASE}/account/orders`);
  await page.getByRole('heading', { level: 1, name: 'My orders' }).waitFor();
  await until(async () => (await page.locator('.ocard, .empty, .alert').count()) > 0);
}
const card = (page, number) => page.locator('.ocard').filter({ has: page.getByRole('heading', { level: 2, name: `Order ${number}` }) });
async function orderPage(page, number) {
  await page.goto(`${BASE}/order/${number}`);
  await page.getByRole('heading', { level: 1, name: `Order ${number}` }).waitFor();
}

async function run(browser, spec, round, picks) {
  const state = {};
  try {
    await steps(browser, spec, round, picks, state);
  } catch (err) {
    if (state.page) {
      await state.page.screenshot({ path: path.join(OUT, 'w7-FAILED.png'), fullPage: true }).catch(() => {});
      console.log('--- page at the failure ---\n', (await state.page.locator('main').innerText().catch(() => '')).slice(0, 1500));
    }
    if (ANDROID) { phoneShot('FAILED-phone'); await phoneCleanup(state); }
    throw err;
  }
}

/* ---------- The phone (NH_ENGINE=android) ---------- */
const phoneDownloads = () => adb('shell', 'ls', '/sdcard/Download/').split(/\s+/).filter((x) => /^INV-\d{6}( \(\d+\))?\.pdf$/.test(x));
const trayHas = (text) => adb('shell', 'dumpsys', 'notification', '--noredact').includes(text);
// Taps the notification with this text in the phone's notification shade.
function tapInShade(text) {
  adb('shell', 'cmd', 'statusbar', 'expand-notifications');
  execFileSync('sleep', ['1.5']);
  adb('shell', 'uiautomator', 'dump', '/sdcard/w7-ui.xml');
  const xml = adb('shell', 'cat', '/sdcard/w7-ui.xml');
  adb('shell', 'rm', '-f', '/sdcard/w7-ui.xml');
  const node = xml.split('<node').find((n) => n.includes(text));
  const b = node && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
  if (!b) return false;
  adb('shell', 'input', 'tap', String((+b[1] + +b[3]) >> 1), String((+b[2] + +b[4]) >> 1));
  return true;
}
function phoneShot(name) {
  if (process.env.NH_NO_SHOTS) return;
  fs.writeFileSync(path.join(OUT, `w7-${name}.png`), execFileSync(ADB, ['exec-out', 'screencap', '-p']));
}

async function steps(browser, spec, round, picks, state) {
  const [w, mode] = spec.split('-');
  let width = Number(w);
  let ctx;
  if (ANDROID) {
    ctx = browser.contexts()[0]; // the phone's own Chrome
    state.ctx = ctx;
    // Downloads go where Chrome on the phone puts them (Playwright would send them to this Mac).
    await (await browser.newBrowserCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'default' });
    await ctx.grantPermissions(['notifications'], { origin: BASE }).catch(() => {});
  } else {
    ctx = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, colorScheme: mode, locale: 'en-IN', timezoneId: 'Asia/Kolkata', acceptDownloads: true });
    if (ENGINE === 'chromium') await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  }
  await ctx.route(/razorpay\.com/, (r) => r.abort());
  await ctx.route('https://checkout.razorpay.com/v1/checkout.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_RZP }));
  await ctx.route(/wa\.me|dtdc\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Outside page (test)</title>' }));
  const page = await ctx.newPage();
  state.page = page;
  page.setDefaultTimeout(ANDROID ? 30000 : 15000);
  if (ANDROID) {
    await page.goto(`${BASE}/`);
    // A clean start: no earlier sign-in or notification of this website on the phone.
    await (await ctx.newCDPSession(page)).send('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'all' });
    width = await page.evaluate(() => window.innerWidth);
    state.downloadsBefore = phoneDownloads();
  }
  const phone = width < 900;
  const tag = ANDROID ? `android-${adb('shell', 'getprop', 'ro.product.model').trim()}-${width}` : `${ENGINE}-${width}-${mode}`;
  console.log(`\n=== ${tag} ===`);
  const cancelled = (t) => ENGINE === 'webkit' && /due to access control checks/.test(t);
  page.on('pageerror', (e) => { if (!cancelled(e.message)) errors.push(`${tag} page error: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !cancelled(m.text()) && !/Failed to load resource: (the server responded with a status of (401|404|409|400|429)|net::ERR_INTERNET_DISCONNECTED)/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });

  const [s1, s2, s3, s4] = picks.slice(round * 4, round * 4 + 4);
  const mobile = newMobile();

  /* ---------- A new customer: no orders yet ---------- */
  await page.goto(`${BASE}/account/orders`);
  await page.waitForURL(/\/sign-in\?next=%2Faccount%2Forders$/);
  ok(true, `${tag}: My orders asks a visitor to sign in first`);
  await page.getByLabel('Mobile number').fill(fmt(mobile));
  await doneTyping(page);
  const reply = page.waitForResponse((r) => /\/auth\/code$/.test(r.url()) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Send code' }).click();
  const sent = await (await reply).json();
  await page.locator('.otp-row input').first().click();
  await page.keyboard.type(sent.devCode, { delay: 30 });
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  await page.getByLabel('Full name').fill('Lakshmi Prasanna');
  await page.getByLabel('Email').fill(`w7.${mobile}@example.com`);
  await page.getByLabel('Pincode').fill('522503');
  await page.locator('.field-hint.ok').waitFor();
  await doneTyping(page);
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForURL(/\/account\/orders$/);
  await page.getByRole('heading', { name: 'No orders yet' }).waitFor();
  ok(true, `${tag}: signed up, straight back to My orders: "No orders yet"`);
  ok(await page.locator('.acct nav').getByRole('link', { name: 'My orders' }).getAttribute('aria-current') === 'page', `${tag}: "My orders" is a tab of My account (7.1 A)`);
  ok(await page.locator('main').getByRole('link', { name: 'New in' }).isVisible(), `${tag}: no orders: New in and All collections`);
  await a11y(page, `${tag} no orders`);
  await shot(page, `${tag}-empty`);
  if (ANDROID) {
    /* Notifications on, on this phone (W1's page) */
    await page.goto(`${BASE}/account/notifications`);
    await page.getByText(/Turn on notifications|Notifications are on for this browser/).first().waitFor();
    if (await page.getByRole('button', { name: 'Turn on notifications' }).count()) await page.getByRole('button', { name: 'Turn on notifications' }).click();
    // Chrome's own "Allow" question, if the permission wasn't given already.
    if (!(await page.getByText('Notifications are on for this browser').first().waitFor({ timeout: 6000 }).then(() => true, () => false))) {
      for (const label of ['Allow', 'ALLOW']) {
        adb('shell', 'uiautomator', 'dump', '/sdcard/w7-ui.xml');
        const node = adb('shell', 'cat', '/sdcard/w7-ui.xml').split('<node').find((n) => n.includes(`text="${label}"`));
        const b = node && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
        if (b) { adb('shell', 'input', 'tap', String((+b[1] + +b[3]) >> 1), String((+b[2] + +b[4]) >> 1)); break; }
      }
      await page.getByText('Notifications are on for this browser').first().waitFor({ timeout: 30000 });
    }
    const acctId = sql(`SELECT id FROM "AuthAccount" WHERE phone = ${q(mobile)}`);
    ok(sql(`SELECT count(*) FROM "PushToken" WHERE "authAccountId" = ${q(acctId)} AND "removedAt" IS NULL AND 'orders' = ANY(topics)`) === '1', `${tag}: notifications are on for this phone, with order updates (Firebase)`);
    phoneShot(`${tag}-notifications-on`);
  }
  await page.goto(`${BASE}/account`);
  await page.getByRole('heading', { name: /^Namaste/ }).waitFor();
  await sleep(600);
  ok(await page.getByRole('heading', { name: 'Your latest order' }).count() === 0, `${tag}: the overview has no latest order yet`);
  ok(await page.locator('.tile-link', { hasText: 'My orders' }).getAttribute('href') === '/account/orders', `${tag}: the overview has a My orders tile`);
  ok(await page.locator('.hdr .acct-link').getAttribute('href') === '/account', `${tag}: the header's account link opens My account`);
  if (await page.getByRole('button', { name: 'Menu' }).isVisible()) {
    await page.getByRole('button', { name: 'Menu' }).click();
    ok(await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'My orders' }).isVisible(), `${tag}: the phone menu has My orders`);
    await page.keyboard.press('Escape');
  }
  await page.goto(BASE);
  ok(await page.locator('footer.ftr').getByRole('link', { name: 'My orders' }).waitFor().then(() => true, () => false), `${tag}: the home page's footer links to My orders`);

  /* ---------- Paid: Thank you, then the order in My orders ---------- */
  const n1 = await buy(page, phone, [s1.slug, s2.slug], { firstAddress: true });
  ok(await page.locator('.ord-hero').getByRole('link', { name: 'My orders' }).isVisible(), `${tag}: right after paying: "Thank you", with a link to My orders`);
  await page.locator('.ord-hero').getByRole('link', { name: 'My orders' }).click();
  await page.waitForURL(/\/account\/orders$/);
  await card(page, n1).waitFor();
  const c1 = await card(page, n1).innerText();
  ok(/BEING PACKED/i.test(c1) && c1.includes(rs(s1.price + s2.price)) && /2 pieces · UPI|2 pieces · Card|2 pieces/.test(c1), `${tag}: the card: being packed, the total, the pieces`);
  ok(/We pack within 2 working days/.test(c1), `${tag}: the card says what happens next`);
  ok(c1.includes(`${s1.name} and 1 more`) || c1.includes(`${s2.name} and 1 more`), `${tag}: the card names the first saree and how many more`);
  ok(await card(page, n1).getByRole('button', { name: /Download the invoice/ }).isVisible() && await card(page, n1).getByRole('button', { name: /Buy order .* again/ }).isVisible(), `${tag}: the card has Invoice and Buy again`);
  ok((await page.locator('.olist-head').innerText()).includes('1 order · newest first'), `${tag}: "1 order · newest first"`);

  /* ---------- A checkout still being paid for (7.9 A) ---------- */
  const held = await buy(page, phone, [s3.slug], { end: 'close' });
  await myOrders(page);
  const top = page.locator('.ocard').first();
  ok((await top.innerText()).includes(held) && /WAITING FOR PAYMENT/i.test(await top.innerText()) && /Held for you until \d{1,2}:\d\d [ap]m/.test(await top.innerText()), `${tag}: a checkout whose sarees are held shows first: waiting for payment, held until a time`);
  ok(await top.getByRole('link', { name: 'Pay now' }).isVisible() && await top.getByRole('button').count() === 0, `${tag}: it has Pay now, no invoice or Buy again`);
  await a11y(page, `${tag} my orders`);
  await noSideScroll(page, `${tag} my orders`);
  await shot(page, `${tag}-list`);
  await page.goto(`${BASE}/account`);
  await page.getByRole('heading', { name: 'Your latest order' }).waitFor();
  ok((await page.locator('.latest').innerText()).includes(held) && await page.locator('.latest').getByRole('link', { name: 'Pay now' }).isVisible(), `${tag}: the overview shows the latest order with Pay now`);
  await shot(page, `${tag}-overview`);
  await page.locator('.latest').getByRole('link', { name: 'Pay now' }).click();
  await page.getByRole('heading', { level: 1, name: `Order ${held}` }).waitFor();
  ok(/Waiting for payment.*held for you until/s.test(await page.getByRole('alert').first().innerText()), `${tag}: its page: waiting for payment, held until a time, Pay`);
  await page.getByRole('alert').first().getByRole('button', { name: 'Change my bag' }).click();
  await page.waitForURL(/\/bag$/);
  await myOrders(page);
  ok(!(await page.locator('main').innerText()).includes(held), `${tag}: after "Change my bag" the unfinished checkout leaves My orders`);

  /* ---------- The order's page: progress, invoice ---------- */
  await orderPage(page, n1);
  ok(await page.locator('.otrack li.done').count() === 1 && /Packed/.test(await page.locator('.otrack li[aria-current="step"]').innerText()), `${tag}: the progress line: paid, now being packed`);
  ok(/Need to cancel or change something\? WhatsApp us/.test(await page.locator('.ord-help').innerText()), `${tag}: cancel or change: WhatsApp us (7.10 to discuss)`);
  ok(await page.getByRole('button', { name: /cancel/i }).count() === 0, `${tag}: no Cancel button`);
  ok((await page.locator('.ord-grid').innerText()).includes('Near the temple'), `${tag}: the address kept with the order`);
  if (ANDROID) {
    await page.getByRole('button', { name: 'Download invoice' }).click();
    await page.getByText(/Invoice INV-\d{6} downloaded/).waitFor();
    const got = await until(async () => phoneDownloads().some((x) => !state.downloadsBefore.includes(x)), 20000);
    const name = phoneDownloads().find((x) => !state.downloadsBefore.includes(x));
    const head = name ? adb('shell', 'head', '-c', '4', `/sdcard/Download/${name}`) : '';
    ok(got && head === '%PDF', `${tag}: Download invoice saves ${name || 'nothing'} (a PDF) in the phone's Downloads`);
  } else {
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download invoice' }).click();
    const file = await dl;
    const pdf = fs.readFileSync(await file.path());
    ok(/^INV-\d{6}\.pdf$/.test(file.suggestedFilename()) && pdf.subarray(0, 4).toString() === '%PDF', `${tag}: Download invoice saves ${file.suggestedFilename()} (a PDF), through our server`);
    await page.getByText(/Invoice INV-\d{6} downloaded/).waitFor();
  }
  await a11y(page, `${tag} order (packing)`);
  await noSideScroll(page, `${tag} order (packing)`);
  await shot(page, `${tag}-order-packing`);

  /* ---------- Shipped in the admin app: tracking ---------- */
  const tracking = awb();
  const shipped = await admin('POST', `/orders/${idOf(n1)}/ship`, { awb: tracking });
  ok(shipped.status === 200, `${tag}: the shop marks it shipped in the admin app (${shipped.status})`);
  ok(await until(async () => noticeOf(n1, 'order_shipped') !== ''), `${tag}: the customer's "shipped" notice is recorded (${noticeOf(n1, 'order_shipped') || 'none'}: no browser has notifications on)`);
  if (ANDROID) {
    ok(await until(async () => noticeOf(n1, 'order_shipped') === 'sent', 20000), `${tag}: Firebase accepted the "shipped" notice for this phone`);
    const msg = page.locator('.toast').filter({ hasText: 'Your order has shipped' }).first();
    ok(await msg.waitFor({ timeout: 30000 }).then(() => true, () => false), `${tag}: with the website open on the phone, "Your order has shipped" shows on the page`);
    ok((await msg.innerText().catch(() => '')).includes(tracking), `${tag}: the message has the tracking number`);
    phoneShot(`${tag}-shipped-message`);
  }
  await orderPage(page, n1);
  ok(/SHIPPED/i.test(await page.locator('.ord-head .ost').innerText()) && await page.locator('.otrack li.done').count() === 3, `${tag}: shipped: the badge, three steps done`);
  ok((await page.locator('.trk .awb').innerText()) === tracking, `${tag}: the tracking card shows ${tracking}`);
  ok(await page.getByRole('link', { name: /Track on DTDC/ }).getAttribute('href') === 'https://www.dtdc.com/track-your-shipment/', `${tag}: "Track on DTDC" opens DTDC's tracking page`);
  await page.getByRole('button', { name: 'Copy' }).click();
  if (ENGINE === 'chromium') {
    await page.getByText(`Tracking number ${tracking} copied`).waitFor();
    ok(await page.evaluate(() => navigator.clipboard.readText()) === tracking, `${tag}: Copy puts the number on the clipboard`);
  } else {
    ok(await page.locator('.toast').filter({ hasText: /copied|Couldn't copy/ }).first().waitFor().then(() => true, () => false), `${tag}: Copy answers`);
  }
  await a11y(page, `${tag} order (shipped)`);
  await noSideScroll(page, `${tag} order (shipped)`);
  await shot(page, `${tag}-order-shipped`);
  await myOrders(page);
  ok((await card(page, n1).innerText()).includes(`DTDC ${tracking}`), `${tag}: the card shows the courier and number`);
  await card(page, n1).getByRole('link', { name: /Track order/ }).click();
  await page.waitForURL(new RegExp(`/order/${n1}#tracking$`));
  await page.locator('#tracking').waitFor();
  ok(await until(async () => page.evaluate(() => { const r = document.getElementById('tracking').getBoundingClientRect(); return r.top >= -2 && r.top < window.innerHeight / 2; })), `${tag}: Track opens the order at its tracking card`);

  /* ---------- Delivered ---------- */
  if (ANDROID) adb('shell', 'input', 'keyevent', 'KEYCODE_HOME'); // Chrome in the background
  await sleep(1500);
  ok((await admin('POST', `/orders/${idOf(n1)}/delivered`)).status === 200, `${tag}: the shop marks it delivered`);
  ok(await until(async () => noticeOf(n1, 'order_delivered') !== ''), `${tag}: the "delivered" notice is recorded`);
  if (ANDROID) {
    ok(await until(async () => trayHas('Your order was delivered'), 30000), `${tag}: Chrome in the background: the phone shows the notification "Your order was delivered"`);
    ok(trayHas(`${n1} was delivered. We hope you love it.`), `${tag}: with the order number and the text`);
    adb('shell', 'cmd', 'statusbar', 'expand-notifications');
    await sleep(1500);
    phoneShot(`${tag}-delivered-notification`);
    ok(tapInShade('Your order was delivered'), `${tag}: tapping the notification`);
    const opened = await until(async () => ctx.pages().some((p) => p.url().endsWith(`/order/${n1}`)), 20000);
    ok(opened, `${tag}: opens the order on the website`);
    await sleep(1500);
    phoneShot(`${tag}-opened-from-notification`);
    adb('shell', 'cmd', 'statusbar', 'collapse');
  }
  await orderPage(page, n1);
  ok(await page.locator('.otrack li.done').count() === 4 && /Delivered \d{1,2} \w{3,4} 20\d\d · DTDC tracking number/.test(await page.locator('.trk').innerText()), `${tag}: delivered: every step done, the date on the tracking card`);

  /* ---------- Buy again (7.7 A) ---------- */
  await page.getByRole('button', { name: 'Buy again' }).click();
  await page.locator('.toast').filter({ hasText: 'None of these sarees can be bought now. 2 have sold since.' }).waitFor();
  ok(await page.locator('.toast').getByRole('button', { name: 'Ask on WhatsApp' }).isVisible(), `${tag}: Buy again when both have sold: says so, with "Ask on WhatsApp"`);
  // The shop puts one back in stock (say, a return).
  const back = sql(`SELECT i."pieceId" FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" JOIN "Product" p ON p.id = i."productId" WHERE o."orderNumber" = ${q(n1)} AND p.slug = ${q(s1.slug)}`);
  sql(`UPDATE "Piece" SET status = 'in_stock' WHERE id = ${q(back)}`);
  try {
    await page.reload();
    await page.getByRole('heading', { level: 1, name: `Order ${n1}` }).waitFor();
    await page.getByRole('button', { name: 'Buy again' }).click();
    await page.locator('.toast').filter({ hasText: `1 saree added to your bag. ${s2.name} has sold since.` }).waitFor();
    ok(true, `${tag}: Buy again: the saree still there goes to the bag; the sold one is named`);
    const panel = page.getByRole('dialog', { name: /Your bag|Added to your bag/ });
    await panel.waitFor();
    ok((await panel.innerText()).includes(s1.sku || s1.name), `${tag}: the bag panel opens with it`);
    await shot(page, `${tag}-buy-again`);
    await page.keyboard.press('Escape');
    ok(sql(`SELECT count(*) FROM "BagItem" b JOIN "Product" p ON p.id = b."productId" JOIN "AuthAccount" a ON a.id = b."authAccountId" WHERE a.phone = ${q(mobile)} AND p.slug = ${q(s1.slug)}`) === '1', `${tag}: kept in the account's bag`);
  } finally {
    sql(`UPDATE "Piece" SET status = 'sold_online' WHERE id = ${q(back)}`);
  }

  /* ---------- Cancelled by the shop after paying ---------- */
  // An empty bag first (the earlier sarees are still in it), so the order is this saree alone.
  sql(`DELETE FROM "BagItem" WHERE "authAccountId" = (SELECT id FROM "AuthAccount" WHERE phone = ${q(mobile)})`);
  const n2 = await buy(page, phone, [s4.slug]);
  const cancel = await admin('POST', `/orders/${idOf(n2)}/cancel`, { reason: 'Damaged while packing (browser test)' });
  ok(cancel.status === 200, `${tag}: the shop cancels the paid order in the admin app (${cancel.status})`);
  await orderPage(page, n2);
  const note = await page.locator('.ord-view .alert').first().innerText();
  ok(note.includes(`Cancelled by the shop: ${rs(s4.price)} is being refunded`) && !/Nothing was charged/.test(await page.locator('main').innerText()), `${tag}: cancelled after paying: "being refunded", never "nothing was charged"`);
  ok(!(await page.locator('main').innerText()).includes('browser test'), `${tag}: the shop's own note isn't shown`);
  ok(/CANCELLED · REFUND ON ITS WAY/i.test(await page.locator('.ord-head .ost').innerText()) && /stamped CANCELLED/.test(await page.locator('.ord-grid').innerText()), `${tag}: its badge, and the invoice stamped CANCELLED`);
  await shot(page, `${tag}-order-shopcancel`);
  const payId = sql(`SELECT p."razorpayPaymentId" FROM "Payment" p JOIN "Order" o ON o.id = p."orderId" WHERE o."orderNumber" = ${q(n2)}`);
  const h = await hook({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_w7${crypto.randomBytes(5).toString('hex')}`, payment_id: payId, amount: s4.price * 100, status: 'processed' } } } });
  ok(h.result === 'refund by hand processed', `${tag}: the owner's refund in Razorpay arrives as a notice (${h.result})`);
  await orderPage(page, n2);
  ok(/Cancelled by the shop: your .* was refunded/.test(await page.locator('.ord-view .alert').first().innerText()) && /Refunded on \d/.test(await page.locator('.ord-view .alert').first().innerText()), `${tag}: then: "was refunded", with the date`);

  /* ---------- Show more: 20 more (sample) orders ---------- */
  const acct = sql(`SELECT id FROM "AuthAccount" WHERE phone = ${q(mobile)}`);
  const pid = sql(`SELECT id FROM "Product" WHERE slug = ${q(s1.slug)}`);
  for (let i = 0; i < 20; i++) {
    const num = `NH${String(crypto.randomInt(0, 1e8)).padStart(8, '0')}`;
    const oid = crypto.randomUUID();
    samples.push(oid);
    sql(`INSERT INTO "Order" (id, "orderNumber", "authAccountId", channel, status, subtotal, total, "shippingAddress", "placedAt", "updatedAt") VALUES (${q(oid)}, ${q(num)}, ${q(acct)}, 'online', 'delivered', 2800, 2800, '{"fullName":"Lakshmi","phone":"9876543210","line1":"Sample","city":"Guntur","state":"Andhra Pradesh","pincode":"522002"}', now() - interval '${40 + i} days', now());
      INSERT INTO "Payment" (id, "orderId", "razorpayOrderId", status, amount, "updatedAt") VALUES (${q(crypto.randomUUID())}, ${q(oid)}, ${q(`order_w7s${crypto.randomBytes(6).toString('hex')}`)}, 'paid', 2800, now());
      INSERT INTO "OrderItem" (id, "orderId", "productId", "nameSnapshot", "priceSnapshot", quantity) VALUES (${q(crypto.randomUUID())}, ${q(oid)}, ${q(pid)}, 'Sample saree (browser test)', 2800, 1)`);
  }
  await myOrders(page);
  ok(await page.locator('.ocard').count() === 20 && await page.getByRole('button', { name: 'Show more' }).isVisible(), `${tag}: 20 at a time, then Show more`);
  await page.getByRole('button', { name: 'Show more' }).click();
  await until(async () => (await page.locator('.ocard').count()) === 22);
  ok(await page.locator('.ocard').count() === 22, `${tag}: Show more brings the rest (22 in all)`);
  ok(await page.evaluate(() => !!document.activeElement?.closest('.ocard') && [...document.querySelectorAll('.ocard')].indexOf(document.activeElement.closest('.ocard')) === 20), `${tag}: the focus goes to the first newly shown order`);
  ok((await page.locator('main').innerText()).includes('That\'s all 22 orders.'), `${tag}: the end of the list says so`);
  await noSideScroll(page, `${tag} my orders (22)`);

  /* ---------- Not found, and the old website's addresses ---------- */
  await page.goto(`${BASE}/order/NH00000000`);
  await page.getByRole('heading', { name: 'We couldn\'t find this order' }).waitFor();
  ok(await page.locator('main').getByRole('link', { name: 'My orders' }).getAttribute('href') === '/account/orders', `${tag}: an unknown or another person's order: "not found", with My orders`);
  for (const old of ['/order-confirmation/5f2c', '/account/orders/5f2c']) {
    await page.goto(`${BASE}${old}`);
    await page.waitForURL(/\/account\/orders$/);
  }
  ok(true, `${tag}: the old website's order links open My orders`);

  await page.goto('about:blank').catch(() => {});
  if (ANDROID) {
    await phoneCleanup(state);
    return;
  }
  await shut(page);
  await shut(ctx);
}

// The phone: the website's data (sign-in, notifications) and the test invoices go; our tabs close.
async function phoneCleanup(state) {
  const ctx = state.ctx;
  if (!ctx) return;
  await ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  const p = ctx.pages().find((x) => x.url().startsWith(BASE)) || state.page;
  if (p) await (await ctx.newCDPSession(p)).send('Storage.clearDataForOrigin', { origin: new URL(BASE).origin, storageTypes: 'all' }).catch(() => {});
  for (const name of phoneDownloads().filter((x) => !(state.downloadsBefore || []).includes(x))) adb('shell', 'rm', '-f', `/sdcard/Download/${name}`);
  for (const x of ctx.pages()) if (x.url().startsWith(BASE) || x.url() === 'about:blank') await x.close().catch(() => {});
  state.ctx = null;
}

(async () => {
  const cfg = await get('/config');
  if (!cfg.payments?.enabled) throw new Error('The server must run with PAYMENTS_ENABLED=true PAYMENT_PROVIDER=fake (see w6.e2e.cjs)');
  const picks = (await get('/products?sort=new&offset=96&limit=48')).items.filter((c) => c.available === 1 && c.price >= 500);
  if (picks.length < ROUNDS.length * 4) throw new Error('Not enough real sarees in the test copy');
  await ownerSignIn();
  const browser = ANDROID ? await chromium.connectOverCDP(process.env.NH_CDP || 'http://localhost:9222', { timeout: 30000 })
    : ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  try {
    for (let i = 0; i < ROUNDS.length; i++) await run(browser, ROUNDS[i], i, picks);
  } finally {
    // On the phone this only lets go of Chrome (it keeps running).
    await Promise.race([browser.close(), sleep(5000)]);
    if (samples.length) sql(`DELETE FROM "Order" WHERE id IN (${samples.map(q).join(',')})`);
    // The sarees this test bought go back in stock in the test copy.
    if (made.length) {
      sql(`UPDATE "Piece" SET status = 'in_stock', "soldAt" = NULL WHERE id IN (SELECT i."pieceId" FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE o."orderNumber" IN (${made.map(q).join(',')}) AND i."pieceId" IS NOT NULL)`);
      sql(`UPDATE "Order" SET status = 'cancelled', "cancelReason" = 'Browser test (w7.e2e)', "cancelledAt" = now() WHERE "orderNumber" IN (${made.map(q).join(',')})`);
    }
    sql(`DELETE FROM "TrustedDevice" WHERE "deviceId" = ${q(owner?.deviceId || '-')}`);
  }
  ok(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  console.log(`\n${passed} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
