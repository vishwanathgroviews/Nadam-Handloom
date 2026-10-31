/* End-to-end test of website module W1 (sign-in and My account) in a real browser, against the
   real server and a local TEST database. Never point it at the live server.
   Needs: the server on a test database with SMS_PROVIDER=console (codes come back in replies)
   and PUSH_PROVIDER=console; the website (npm run dev). See e2e/README.md.
     node e2e/w1.e2e.cjs            (both widths, light and dark; screenshots in e2e/out/)
   Env: NH_WEB (default http://127.0.0.1:5180), NH_E2E_DB (default nandam_e2e),
        CHROME_PATH (default: Playwright's chrome-headless-shell 1243 on this Mac),
        NH_ENGINE=webkit (Safari's engine, closest to iPhones), NH_ROUNDS=390-light,1440-dark. */
const { chromium, webkit } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.NH_WEB || 'http://127.0.0.1:5180';
const DB = process.env.NH_E2E_DB || 'nandam_e2e';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@18/bin/psql';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
if (!/^nandam_(e2e|test)/.test(DB)) throw new Error('Refusing: NH_E2E_DB must be a local test database (nandam_e2e...)');

const fails = [];
const errors = [];
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ok   ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); }
};
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
// The server stores times in UTC (timestamp without time zone): use now() at time zone 'utc'.
const sql = (q) => execFileSync(PSQL, ['-d', DB, '-Atc', q], { encoding: 'utf8' }).trim();
// Every test browser shares one network (127.0.0.1), so the 20-codes-an-hour network limit
// would stop the run: the test forgets its own codes between rounds (test database only).
const forgetCodes = () => sql(`delete from "PhoneCode" where "ipAddress" in ('127.0.0.1', '::1', '::ffff:127.0.0.1')`);
const used = new Set();
const newMobile = () => { for (;;) { const m = `7${String(crypto.randomInt(0, 1e9)).padStart(9, '0')}`; if (!used.has(m)) { used.add(m); return m; } } };
const fmt = (m) => `${m.slice(0, 5)} ${m.slice(5)}`;

// A real 600 × 800 JPEG (with camera details the server must remove).
const JPEG = fs.readFileSync(path.join(__dirname, 'fixtures/photo.jpg'));

// Waits until the page has had no request in flight for half a second.
const inFlight = new WeakMap();
function trackRequests(page) {
  const set = new Set();
  inFlight.set(page, set);
  page.on('request', (r) => set.add(r));
  page.on('requestfinished', (r) => set.delete(r));
  page.on('requestfailed', (r) => set.delete(r));
}
async function settled(page, quietMs = 500, maxMs = 10000) {
  const set = inFlight.get(page);
  const end = Date.now() + maxMs;
  let quietSince = Date.now();
  while (Date.now() < end) {
    if ([...set].some((r) => r.url().includes('/api/'))) quietSince = Date.now();
    else if (Date.now() - quietSince >= quietMs) return;
    await sleep(50);
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function noSideScroll(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, `${label}: no sideways scrolling (${over}px)`);
}

// Every visible form control has a name screen readers can read.
async function labelled(page, label) {
  const missing = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]):not(.trap), select, textarea')) {
      if (el.closest('[aria-hidden="true"]') || el.offsetParent === null) continue;
      const name = el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.closest('label')?.textContent || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent);
      if (!name || !name.trim()) out.push(el.outerHTML.slice(0, 80));
    }
    return out;
  });
  ok(missing.length === 0, `${label}: every field has a label${missing.length ? ` (missing: ${missing.join(' | ')})` : ''}`);
}

async function codeFrom(page, action) {
  const reply = page.waitForResponse((r) => /\/auth\/code$|\/me\/mobile\/code$/.test(r.url()) && r.request().method() === 'POST');
  await action();
  const r = await reply;
  return { status: r.status(), body: await r.json().catch(() => ({})) };
}

async function typeCode(page, code) {
  await page.locator('.otp-row input').first().click();
  await page.keyboard.type(code, { delay: 30 });
}

async function signUp(page, { mobile = newMobile(), name = 'Anitha Reddy', email, pincode = '522503' } = {}) {
  await page.goto(`${BASE}/sign-in`);
  await page.getByLabel('Mobile number').fill(fmt(mobile));
  const sent = await codeFrom(page, () => page.getByRole('button', { name: 'Send code' }).click());
  await page.locator('.otp-row').waitFor();
  await typeCode(page, sent.body.devCode);
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email || `e2e.${mobile}@example.com`);
  await page.getByLabel('Pincode').fill(pincode);
  await page.locator('.field-hint.ok').waitFor();
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.waitForURL(/\/account$/);
  return { mobile };
}

async function run(browser, width, mode) {
  const tag = `${width}-${mode}`;
  console.log(`\n=== ${width}px, ${mode} ===`);
  forgetCodes();
  const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 }, colorScheme: mode, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(`${tag} page error: ${e.message}`));
  // ERR_CONNECTION_REFUSED: 22 sample photos in nandam_e2e point to an old local address
  // (localhost:4100); since W2 the home page shows the newest sarees, so they load there
  // (refused, or blocked when another local project answers on 4100).
  const deadSamplePhoto = (m) => /localhost:4100\/uploads\//.test(`${m.text()} ${m.location()?.url || ''}`);
  page.on('console', (m) => { if (m.type() === 'error' && !deadSamplePhoto(m) && !/Failed to load resource: (the server responded with a status of (401|404|409|400|429)|net::ERR_CONNECTION_REFUSED|net::ERR_BLOCKED_BY_RESPONSE|Could not connect to the server\.)/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });

  /* ---------- Visitor ---------- */
  await page.goto(BASE);
  ok(await page.getByRole('heading', { level: 1, name: /Nandam Handlooms/ }).count() === 1 && await page.getByRole('searchbox').isVisible(), `${tag} home page`);
  ok((await page.locator('html').getAttribute('data-mode')) === mode, `${tag} Auto theme follows the device (${mode})`);
  await noSideScroll(page, `${tag} home`);
  await shot(page, `${tag}-home`);
  // Phones and tablets: the menu button opens the side menu (computers have the menu bar).
  if (await page.getByRole('button', { name: 'Menu' }).isVisible()) {
    await page.getByRole('button', { name: 'Menu' }).click();
    ok(await page.getByRole('dialog', { name: 'Menu' }).isVisible(), `${tag} the side menu opens`);
    await page.keyboard.press('Escape');
    ok(!(await page.getByRole('dialog', { name: 'Menu' }).isVisible().catch(() => false)), `${tag} Escape closes the menu`);
  } else {
    ok(await page.getByRole('navigation', { name: 'Shop' }).getByRole('link', { name: 'All sarees' }).isVisible(), `${tag} the menu bar shows`);
  }
  await page.goto(`${BASE}/account/profile`);
  await page.waitForURL(/\/sign-in\?next=%2Faccount%2Fprofile/);
  ok(true, `${tag} a visitor on My account is sent to sign in, and back after`);

  /* ---------- Sign up ---------- */
  const mobile = newMobile();
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByRole('button', { name: 'Send code' }).click();
  ok(await page.getByText('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.').isVisible(), `${tag} short mobile refused before sending`);
  await labelled(page, `${tag} sign-in`);
  await shot(page, `${tag}-signin-mobile`);
  await page.getByLabel('Mobile number').fill(`+91 ${fmt(mobile)}`);
  const sent = await codeFrom(page, () => page.getByRole('button', { name: 'Send code' }).click());
  ok(sent.status === 202 && /^\d{6}$/.test(sent.body.devCode || ''), `${tag} code sent (test mode)`);
  await page.getByRole('heading', { name: 'Enter the code' }).waitFor();
  ok(await page.getByText(`+91 ${fmt(mobile)}`).isVisible(), `${tag} the number is shown on the code step`);
  ok(await page.getByText(/You can ask for a new code in/).isVisible(), `${tag} resend countdown`);
  const wrong = sent.body.devCode === '000000' ? '111111' : '000000';
  await typeCode(page, wrong);
  await page.getByText('That code isn\'t right. 2 tries left.').waitFor();
  ok((await page.locator('.otp-row input').first().inputValue()) === '', `${tag} wrong code: boxes cleared, 2 tries left`);
  await shot(page, `${tag}-signin-code-wrong`);
  await labelled(page, `${tag} code step`);
  await typeCode(page, sent.body.devCode);
  await page.getByRole('heading', { name: 'Complete your profile' }).waitFor();
  ok(true, `${tag} right code: new customer goes to "Complete your profile"`);
  await page.getByRole('button', { name: 'Create my account' }).click();
  ok(await page.getByText('Enter your full name.').isVisible(), `${tag} empty profile: field messages`);
  await page.getByLabel('Full name').fill('Anitha  Reddy');
  await page.getByLabel('Email').fill('anitha@');
  await page.getByLabel('Pincode').fill('522503');
  await page.locator('.field-hint.ok').waitFor();
  ok((await page.getByLabel('City').inputValue()) === 'Guntur' && (await page.getByLabel('State').inputValue()) === 'Andhra Pradesh', `${tag} pincode fills city and state`);
  await page.getByRole('button', { name: 'Create my account' }).click();
  ok(await page.getByText('Enter a valid email address, like name@example.com.').isVisible(), `${tag} bad email refused`);
  await page.getByLabel('City').fill('Mangalagiri');
  await page.getByLabel('Email').fill(`anitha.${mobile}@example.com`);
  await page.getByLabel(/Send me new arrivals/).check();
  await labelled(page, `${tag} profile step`);
  await shot(page, `${tag}-signin-profile`);
  await page.getByRole('button', { name: 'Create my account' }).click();
  // Back to the page the visitor first asked for (Profile), signed in.
  await page.waitForURL(/\/account\/profile$/);
  ok(await page.getByText('Account created. Welcome, Anitha!').isVisible(), `${tag} account made, signed in, back on the page first asked for`);
  await page.getByRole('link', { name: 'Overview' }).first().click();
  await page.getByRole('heading', { name: 'Namaste, Anitha' }).waitFor();
  ok(true, `${tag} My account overview greets the customer`);
  ok((await page.locator('.hdr .acct-link').textContent()).includes(width > 980 ? 'Anitha' : ''), `${tag} header shows the customer`);
  const row = sql(`select p."city", p."marketingOptIn", p."signupDevice" from "AuthAccount" a join "UserProfile" p on p."authAccountId" = a.id where a.phone = '${mobile}'`);
  // (Headless Chrome reports a desktop browser at every width.)
  ok(row === 'Mangalagiri|t|desktop', `${tag} saved: corrected city, offers consent, device (${row})`);
  await noSideScroll(page, `${tag} account`);
  await shot(page, `${tag}-account-overview`);

  /* ---------- Stays signed in ---------- */
  await page.reload();
  await page.getByRole('heading', { name: 'Namaste, Anitha' }).waitFor();
  ok(true, `${tag} still signed in after a reload (30-day cookie)`);
  const cookies = await ctx.cookies();
  const c = cookies.find((x) => x.name === 'nh_shop_session');
  ok(c && c.httpOnly && c.sameSite === 'Lax' && c.path === '/api/v2/shop/auth', `${tag} sign-in cookie is HttpOnly, SameSite=Lax, limited to /api/v2/shop/auth`);
  ok(!(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).includes('eyJ'), `${tag} no sign-in key in browser storage`);

  /* ---------- Profile ---------- */
  await page.getByRole('link', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Profile', level: 1 }).waitFor();
  await labelled(page, `${tag} profile`);
  await page.getByLabel('Full name').fill('Anitha Rani Reddy');
  await page.getByLabel(/Date of birth/).fill('2030-01-01');
  await page.getByRole('button', { name: 'Save changes' }).click();
  ok(await page.getByText('Enter your real date of birth (you must be 13 or older).').isVisible(), `${tag} future birthday refused`);
  await page.getByLabel(/Date of birth/).fill('1992-04-15');
  await page.getByLabel(/Preferred language/).selectOption('te');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Profile saved').waitFor();
  ok(sql(`select "displayName" || '|' || "dateOfBirth" || '|' || "language" from "UserProfile" p join "AuthAccount" a on a.id = p."authAccountId" where a.phone = '${mobile}'`) === 'Anitha Rani Reddy|1992-04-15|te', `${tag} profile saved`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('No changes to save').waitFor();
  ok(true, `${tag} nothing changed: nothing sent`);
  await page.locator('input[type=file]').setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await page.getByText('Profile picture saved').waitFor();
  ok(await page.locator('.pic-row .avatar img').isVisible(), `${tag} profile picture uploaded and shown`);
  await page.locator('input[type=file]').setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  ok(await page.getByText('Choose a JPEG, PNG or WebP photo.').isVisible(), `${tag} a PDF is refused before uploading`);
  await shot(page, `${tag}-account-profile`);
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByText('Profile picture removed').waitFor();
  ok(true, `${tag} profile picture removed`);

  /* ---------- Change of mobile ---------- */
  forgetCodes();
  const newNumber = newMobile();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('New mobile number').fill(mobile);
  await dialog.getByRole('button', { name: 'Send code' }).click();
  ok(await dialog.getByText('This is already your mobile number.').isVisible(), `${tag} change mobile: same number refused`);
  await dialog.getByLabel('New mobile number').fill(newNumber);
  const mc = await codeFrom(page, () => dialog.getByRole('button', { name: 'Send code' }).click());
  await dialog.getByRole('heading', { name: 'Enter the code' }).waitFor();
  await typeCode(page, mc.body.devCode);
  await page.getByText('Mobile number changed').waitFor();
  ok((await page.locator('.input-group input[readonly]').inputValue()) === fmt(newNumber), `${tag} mobile changed after the code`);

  /* ---------- Addresses ---------- */
  await page.getByRole('link', { name: 'Addresses' }).first().click();
  await page.getByRole('heading', { name: 'No saved addresses' }).waitFor();
  ok(true, `${tag} addresses: empty state`);
  await page.getByRole('button', { name: 'Add an address' }).click();
  const af = page.getByRole('dialog');
  await af.getByLabel('House, flat, building').fill('ab');
  await af.getByRole('button', { name: 'Save address' }).click();
  ok(await af.getByText('Enter the house or flat number and building.').isVisible(), `${tag} address: short house refused`);
  await labelled(page, `${tag} address form`);
  await af.getByLabel('House, flat, building').fill('Flat 302, Sri Sai Residency');
  await af.getByLabel(/Area, street/).fill('Road No. 12, Banjara Hills');
  await af.getByLabel('Pincode').fill('500034');
  await af.locator('.field-hint.ok').waitFor();
  await shot(page, `${tag}-address-form`);
  await af.getByRole('button', { name: 'Save address' }).click();
  await page.getByText('Address added').waitFor();
  ok(await page.getByText('Default', { exact: true }).isVisible(), `${tag} first address is the default`);
  await page.getByRole('button', { name: 'Add a new address' }).click();
  await page.getByRole('dialog').getByLabel('House, flat, building').fill('Plot 18, Cyber Towers Lane');
  await page.getByRole('dialog').getByLabel('Pincode').fill('500081');
  await page.getByRole('dialog').locator('.field-hint.ok').waitFor();
  await page.getByRole('dialog').getByText('Office', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save address' }).click();
  await page.getByText('Address added').waitFor();
  await page.getByRole('button', { name: 'Make default' }).click();
  await page.getByText('Default address changed').waitFor();
  ok((await page.locator('.addr-card').first().textContent()).includes('Office'), `${tag} make default: the office address moves first`);
  await shot(page, `${tag}-addresses`);
  await page.locator('.addr-card').nth(1).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Address deleted').waitFor();
  ok((await page.locator('.addr-card').count()) === 1, `${tag} address deleted after confirming`);

  /* ---------- Notifications ---------- */
  await page.getByRole('link', { name: 'Notifications' }).first().click();
  await page.locator('.push-card, .alert').first().waitFor();
  ok(await page.getByText(/Get updates on this device|can't show notifications|Notifications are blocked/).first().isVisible(), `${tag} notifications: this browser's state is shown`);
  const consent = page.getByRole('switch', { name: 'New arrivals and offers' });
  ok(await consent.isChecked(), `${tag} offers consent from sign-up shows as on`);
  await consent.click({ force: true });
  await page.getByText('No more offers. Order updates continue.').waitFor();
  ok(sql(`select "marketingOptIn" from "UserProfile" p join "AuthAccount" a on a.id = p."authAccountId" where a.phone = '${newNumber}'`) === 'f', `${tag} offers consent turned off and saved`);
  await shot(page, `${tag}-notifications`);

  /* ---------- Signed-in devices: a second browser ---------- */
  forgetCodes();
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const p2 = await other.newPage();
  p2.on('pageerror', (e) => errors.push(`${tag} second browser: ${e.message}`));
  trackRequests(p2);
  await p2.goto(`${BASE}/sign-in?next=%2Faccount%2Faddresses`);
  sql(`delete from "PhoneCode" where mobile = '${newNumber}'`);
  await p2.getByLabel('Mobile number').fill(newNumber);
  const c2 = await codeFrom(p2, () => p2.getByRole('button', { name: 'Send code' }).click());
  await typeCode(p2, c2.body.devCode);
  await p2.waitForURL(/\/account\/addresses$/);
  ok(await p2.getByText('Welcome back, Anitha').isVisible(), `${tag} known customer: straight in, back to the page they wanted`);
  await page.getByRole('link', { name: 'Signed-in devices' }).first().click();
  await page.getByText('Safari on iPhone').waitFor();
  ok(await page.getByText('This device').isVisible(), `${tag} devices: this one marked, the iPhone listed`);
  await shot(page, `${tag}-devices`);
  await page.getByRole('row', { name: /Safari on iPhone/ }).getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await page.getByText('Signed out Safari on iPhone').waitFor();
  await p2.getByRole('link', { name: 'Profile', exact: true }).first().click();
  await p2.waitForURL(/\/sign-in\?next=/);
  ok(await p2.getByText('You were signed out from another device. Please sign in again.').isVisible(), `${tag} the iPhone is signed out, told why, sent to sign in`);

  /* ---------- Delete my account, then keep it ---------- */
  await page.getByRole('link', { name: 'Delete account' }).first().click();
  await page.getByRole('button', { name: 'Request deletion' }).click();
  ok(await page.getByText('Tick the box to confirm first.').isVisible(), `${tag} delete: needs the tick`);
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Request deletion' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Request deletion' }).click();
  await page.getByText(/Your account will be deleted on/).waitFor();
  ok(true, `${tag} deletion requested: banner with the date`);
  await shot(page, `${tag}-delete-requested`);
  await page.getByRole('button', { name: 'Keep my account' }).click();
  await page.getByText('Your account is kept. Nothing was deleted.').waitFor();
  ok(!(await page.getByText(/Your account will be deleted on/).isVisible().catch(() => false)), `${tag} "Keep my account" cancels it`);

  /* ---------- Offline ---------- */
  await page.getByRole('link', { name: 'Profile', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Profile', level: 1 }).waitFor();
  await page.getByLabel('Full name').waitFor();
  await ctx.setOffline(true);
  await page.getByLabel('Full name').fill('Anitha Reddy');
  await page.getByRole('button', { name: 'Save changes' }).click();
  ok(await page.getByText(/You are offline/).first().isVisible(), `${tag} offline: banner and a clear message, nothing lost`);
  ok((await page.getByLabel('Full name').inputValue()) === 'Anitha Reddy', `${tag} offline: what was typed is kept`);
  await ctx.setOffline(false);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Profile saved').waitFor();
  ok(true, `${tag} back online: saving works`);

  /* ---------- Sign out of all devices ---------- */
  await page.getByRole('link', { name: 'Signed-in devices' }).first().click();
  await page.getByRole('button', { name: 'Sign out of all devices' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out everywhere' }).click();
  await page.waitForURL(/\/sign-in$/);
  await page.getByText('Signed out of all devices').waitFor();
  ok(true, `${tag} signed out everywhere, on the sign-in page`);
  ok((await ctx.cookies()).every((x) => x.name !== 'nh_shop_session'), `${tag} the sign-in cookie is gone`);

  /* ---------- A sign-in that ran out ---------- */
  const late = await signUp(p2, {});
  // Let the account page's requests finish first: Safari reports requests cut off by a
  // reload as page errors (a real reload just cancels them, unseen). Playwright's
  // "networkidle" only follows full page loads, not in-app page changes, so count them.
  await settled(p2);
  sql(`update "Session" set "expiresAt" = (now() at time zone 'utc') - interval '1 minute' where "revokedAt" is null and kind = 'customer' and "authAccountId" = (select id from "AuthAccount" where phone = '${late.mobile}')`);
  await p2.reload();
  await p2.waitForURL(/\/sign-in/);
  ok(await p2.getByText('You were signed out after 30 days without a visit. Please sign in again.').isVisible(), `${tag} 30 days unused: signed out with the reason`);
  await other.close();

  /* ---------- Sign out (this browser) ---------- */
  await signUp(page, {});
  await page.getByRole('navigation', { name: 'My account' }).getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(`${BASE}/`);
  await page.getByText('Signed out', { exact: true }).waitFor();
  ok(true, `${tag} "Sign out" goes to the home page`);
  ok(await page.getByRole('link', { name: 'Sign in' }).first().isVisible(), `${tag} the header shows "Sign in" again`);

  /* ---------- Theme switch ---------- */
  await page.goto(BASE);
  const want = mode === 'dark' ? 'Light' : 'Dark';
  await page.locator('.ftr').getByRole('button', { name: want }).click();
  ok((await page.locator('html').getAttribute('data-mode')) === want.toLowerCase(), `${tag} theme switch: ${want}`);
  await page.reload();
  ok((await page.locator('html').getAttribute('data-mode')) === want.toLowerCase(), `${tag} theme choice remembered`);
  await page.locator('.ftr').getByRole('button', { name: 'Auto' }).click();
  ok((await page.locator('html').getAttribute('data-mode')) === mode, `${tag} back to Auto`);
  await page.locator('.ftr').scrollIntoViewIfNeeded();
  await shot(page, `${tag}-footer`);
  await ctx.close();
}

async function maintenance(browser) {
  console.log('\n=== Website switched off ===');
  sql(`update "AppConfig" set "webMaintenanceEnabled" = true, "webMaintenanceMessage" = 'New collection going up. Back at 6 pm.' where id = 'default'`);
  try {
    await sleep(11000); // the server re-reads the switch every 10 seconds
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.getByRole('heading', { name: 'The website is being updated' }).waitFor();
    ok(await page.getByText('New collection going up. Back at 6 pm.').isVisible(), 'maintenance page with the owner\'s message');
    await shot(page, 'maintenance-390');
    await ctx.close();
  } finally {
    sql(`update "AppConfig" set "webMaintenanceEnabled" = false, "webMaintenanceMessage" = '' where id = 'default'`);
    await sleep(11000);
  }
}

(async () => {
  sql(`insert into "AppConfig" (id, "updatedAt") values ('default', now()) on conflict (id) do nothing`);
  const engine = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
  const browser = engine === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  const rounds = (process.env.NH_ROUNDS || '1440-light,390-dark,390-light,1440-dark').split(',').map((r) => r.split('-'));
  console.log(`Browser engine: ${engine}`);
  const started = Date.now();
  try {
    for (const [w, mode] of rounds) await run(browser, Number(w), mode);
    if (!process.env.NH_ROUNDS) await maintenance(browser);
  } catch (err) {
    fails.push(`crashed: ${err.message.split('\n')[0]}`);
    console.error(err);
  } finally {
    await browser.close();
  }
  for (const e of errors) fails.push(e);
  console.log(`\n${passed} checks passed, ${fails.length} failed, ${Math.round((Date.now() - started) / 1000)} s. Screenshots: ${OUT}`);
  if (fails.length) { console.log(fails.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
})();
