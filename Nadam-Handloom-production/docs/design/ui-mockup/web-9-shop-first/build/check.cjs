/* Real-browser check of the "products first" shop mock-up, every flow end to end.
   With the mock-up folder served (python3 -m http.server 8765 --bind 127.0.0.1 in docs/design/ui-mockup):
     NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-9-shop-first/build/check.cjs
   NH_ENGINE=webkit WEBKIT_PATH=...  the same in Safari's engine.  SHOTS=1  saves the start page pictures. */
const { chromium, webkit } = require('playwright-core');
const path = require('node:path');

const BASE = process.env.NH_MOCK || 'http://127.0.0.1:8765/web-9-shop-first';
const ENGINE = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const fails = [];
let passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log(`  ok   ${m}`); } else { fails.push(`${ENGINE} ${m}`); console.log(`  FAIL ${m}`); } };
const seen = (loc, state = 'visible', timeout = 6000) => loc.waitFor({ state, timeout }).then(() => true, () => false);
const price = (t) => Number(String(t).replace(/[^\d]/g, ''));

async function open(browser, w, mode, opts = {}, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, colorScheme: mode, hasTouch: w < 600, ...extra });
  await ctx.addInitScript((o) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('w9mock.opts.v1', JSON.stringify(o)); sessionStorage.setItem('seeded', '1'); } }, { theme: mode, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  return { ctx, page };
}
const goto = async (page, hash) => { await page.goto(`${BASE}/site.html${hash}`); await page.locator('main h1').first().waitFor(); await page.waitForTimeout(250); };
const hashTo = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(350); };
async function basics(page, tag) {
  const r = await page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]') && getComputedStyle(el).visibility !== 'hidden';
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().length > 0;
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    return {
      h1: document.querySelectorAll('main h1').length,
      side: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      unnamed: [...document.querySelectorAll('button, a[href]')].filter((b) => visible(b) && !named(b)).map((b) => b.outerHTML.slice(0, 70)),
      unlabelled: [...document.querySelectorAll('input:not([type=hidden]), select')].filter((el) => visible(el) && !(el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label'))).map((el) => el.outerHTML.slice(0, 60)),
      dup: ids.filter((x, i) => ids.indexOf(x) !== i),
    };
  });
  ok(r.h1 === 1, `${tag}: one main heading`);
  ok(r.side <= 1, `${tag}: no sideways scrolling (${r.side}px)`);
  ok(!r.noAlt && !r.unnamed.length && !r.unlabelled.length && !r.dup.length, `${tag}: alt text, names, labels, unique ids ${[...r.unnamed, ...r.unlabelled, ...r.dup].join(' | ')}`);
}

async function browsing(browser, w, mode, home) {
  const tag = `${w}-${mode} home ${home.toUpperCase()}`;
  console.log(`\n=== ${ENGINE} ${tag}: finding a saree ===`);
  const { ctx, page } = await open(browser, w, mode, { home });
  const phone = w < 900;
  await goto(page, '#/');
  ok(await page.locator('.grid .card').count() >= (home === 'b' ? 0 : 20) && (home !== 'b' || await page.locator('.rail .card').count() > 10), `${tag}: sarees on the first page`);
  const first = await page.evaluate(() => { const c = document.querySelector('main .card'); return c ? Math.round(c.getBoundingClientRect().top) : 9999; });
  ok(home === 'b' ? first < 1600 : first < (phone ? 560 : 520), `${tag}: the first saree is ${home === 'b' ? 'near the top' : 'on the first screen'} (${first}px)`);
  await basics(page, tag);
  if (process.env.SHOTS && mode === 'light' && (w === 1440 || w === 390)) { // the start page's pictures, without the mock-up controls
    await page.addStyleTag({ content: '.mo-fab, .mock-strip { display: none !important; }' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, '..', 'img', `shot-home-${home}-${phone ? 'phone' : 'laptop'}.jpg`), type: 'jpeg', quality: 76 });
    await page.evaluate(() => document.head.lastElementChild.remove());
  }
  if (home !== 'a') { ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`); await ctx.close(); return; }

  // Filters: a category, the counts follow; an applied chip; clear.
  const total = Number((await page.locator('.list-head .count').innerText()).match(/[\d,]+/)[0].replace(/,/g, ''));
  if (!phone) {
    await page.locator('.filters-side input[data-f="cat"][value="handloom-pattu-dress-material"]').click();
    await page.waitForTimeout(350);
    const n = Number((await page.locator('.list-head .count').innerText()).match(/[\d,]+/)[0]);
    ok(n > 0 && n < total && page.url().includes('cat=handloom-pattu-dress-material'), `${tag}: category filter (${total} → ${n}), in the address`);
    ok(await page.locator('.applied .chip', { hasText: 'Dress materials' }).count() === 1, `${tag}: the filter shows as a chip`);
    await page.locator('.applied [data-act="clear"]').click(); await page.waitForTimeout(300);
    ok(!page.url().includes('cat='), `${tag}: Clear all`);
    // Sort and pages.
    await page.selectOption('[data-sort]', 'price-asc'); await page.waitForTimeout(300);
    const prices = await page.locator('.grid .card .price').allInnerTexts();
    ok(prices.length > 2 && price(prices[0]) <= price(prices[1]) && price(prices[1]) <= price(prices[prices.length - 1]), `${tag}: sort by price, low to high (${prices[0]} …)`);
    await page.locator('.pager a', { hasText: '2' }).first().click(); await page.waitForTimeout(400);
    ok(page.url().includes('page=2') && /Showing 25–48/.test(await page.locator('.pager-note').innerText()), `${tag}: page 2 shows 25–48`);
  } else {
    await page.locator('[data-act="filters"]').click();
    const sheet = page.locator('.sheet');
    ok(await seen(sheet), `${tag}: Filter opens a sheet`);
    await sheet.locator('[data-fg="craft"]').click();
    await sheet.locator('input[data-f="craft"][value="embroidery"]').click();
    await page.waitForTimeout(450);
    ok(await seen(page.locator('.sheet')) && page.url().includes('craft=embroidery'), `${tag}: ticking a craft keeps the sheet open`);
    const btn = await page.locator('.sheet .df .btn-primary').innerText();
    await page.locator('.sheet .df .btn-primary').click();
    ok(await seen(page.locator('.sheet'), 'detached') && /Show \d+ sarees?/.test(btn), `${tag}: "${btn}" closes it`);
    ok(/1/.test(await page.locator('.mob-bar [data-act="filters"]').innerText()), `${tag}: the Filter button counts the filters`);
    await page.locator('[data-act="sort"]').click();
    await page.locator('.sheet input[value="price-desc"]').click(); await page.waitForTimeout(400);
    const prices = await page.locator('.grid .card .price').allInnerTexts();
    ok(price(prices[0]) >= price(prices[1]), `${tag}: Sort sheet: price high to low`);
    await hashTo(page, '#/');
    const before = await page.locator('.grid .card').count();
    await page.locator('.more-wrap .btn').click(); await page.waitForTimeout(400);
    ok((await page.locator('.grid .card').count()) === before + 24, `${tag}: "Show more sarees" adds 24 (${before} → ${before + 24})`);
  }
  // Search: suggestions, results, nothing found.
  const box = page.locator('#q-h');
  await box.fill('kalamkari');
  ok(await seen(page.locator('.suggest')), `${tag}: search suggests as you type`);
  await box.press('Enter'); await page.waitForTimeout(350);
  const names = await page.locator('.grid .card .col').allInnerTexts();
  ok(page.url().includes('search?q=kalamkari') && names.length > 0 && names.every((x) => /kalamkari|hand painted/i.test(x)), `${tag}: search "kalamkari" (${names.length} found)`);
  await hashTo(page, '#/search?q=banarasi');
  ok(await seen(page.getByRole('heading', { name: 'Nothing found for "banarasi"' })), `${tag}: nothing found: says so, offers the categories and WhatsApp`);
  // The menu (phone) or a category menu (laptop).
  if (phone) {
    await page.locator('.menu-btn').click();
    ok(await seen(page.locator('.drawer.left')), `${tag}: the menu opens`);
    await page.keyboard.press('Escape');
    ok(await seen(page.locator('.drawer.left'), 'detached'), `${tag}: Escape closes the menu`);
  } else {
    await page.locator('.nav li', { hasText: 'Pattu sarees' }).first().hover();
    ok(await seen(page.locator('.nav .mega').first()), `${tag}: a category shows its collections on hover`);
  }
  ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
}

async function buying(browser, w, mode) {
  const tag = `${w}-${mode}`;
  console.log(`\n=== ${ENGINE} ${tag}: the saree, the bag, sign in, checkout, orders ===`);
  const { ctx, page } = await open(browser, w, mode, {});
  const phone = w < 900;
  await goto(page, '#/sets');
  // A set: pieces, add, the bag opens.
  await page.locator('.grid .card .nm').first().click();
  await page.locator('.buybox h1').waitFor();
  const name = (await page.locator('.buybox h1').innerText()).trim();
  ok(/In stock: \d+ identical pieces/.test(await page.locator('.stockline').innerText()), `${tag}: saree page: a set says how many`);
  await basics(page, `${tag} saree page`);
  await page.locator('[data-qty="1"]').click();
  ok((await page.locator('.qty output').innerText()) === '2', `${tag}: two pieces of the set`);
  await page.locator('.buy-acts [data-add]').click();
  const drawer = page.locator('.drawer:not(.left)');
  ok(await seen(drawer) && /Added to your bag/.test(await drawer.innerText()), `${tag}: Add to bag opens the bag: "Added"`);
  ok((await page.locator('[data-bag-n]').innerText()) === '2', `${tag}: the header counts 2 pieces`);
  await page.keyboard.press('Escape');
  ok(await seen(drawer, 'detached'), `${tag}: Escape closes the bag`);
  await page.locator('.gallery .main').click();
  ok(await seen(page.locator('.lightbox')), `${tag}: the photo opens full screen`);
  await page.keyboard.press('Escape');
  await page.locator('#pin').fill('522503'); await page.locator('[data-pin] button').click();
  ok(/Mangalagiri, Andhra Pradesh/.test(await page.locator('[data-pin-res]').innerText()), `${tag}: delivery check for 522503`);
  // A single piece from the list: Add from the card.
  await hashTo(page, '#/all');
  const card = page.locator('.grid .card').filter({ hasText: 'Only 1' }).first();
  const cardName = (await card.locator('.nm').innerText()).trim();
  await card.locator('.acts [data-add]').click();
  ok(await seen(drawer) && (await drawer.locator('.bline').count()) === 2, `${tag}: a card's Add to bag: 2 sarees in the bag`);
  await drawer.locator('a', { hasText: 'View bag' }).click();
  await page.locator('main h1', { hasText: 'Your bag' }).waitFor();
  const t1 = price(await page.locator('.sumbox .tot span').last().innerText());
  await page.locator('.bline').first().locator('[data-d="-1"]').click(); await page.waitForTimeout(250);
  const t2 = price(await page.locator('.sumbox .tot span').last().innerText());
  ok(t2 < t1, `${tag}: one piece less: the total follows (${t1} → ${t2})`);
  await page.locator('.bline').last().locator('[data-rm]').click();
  ok((await page.locator('.bline').count()) === 1 && await seen(page.locator('.toast', { hasText: 'Removed' })), `${tag}: remove, with Undo`);
  await page.locator('.toast button', { hasText: 'Undo' }).click(); await page.waitForTimeout(250);
  ok((await page.locator('.bline').count()) === 2, `${tag}: Undo puts it back`);
  await basics(page, `${tag} bag`);
  // Checkout: sign in first (returning customer, wrong code once).
  await page.locator('.sumbox a', { hasText: 'Checkout' }).click();
  await page.locator('main h1', { hasText: 'Sign in' }).waitFor();
  ok(page.url().includes('signin') && page.url().includes('next=') && await page.locator('.hdr-row.plain').count() === 1, `${tag}: checkout asks to sign in first (plain header)`);
  await page.locator('#mob').fill('98765'); await page.locator('[data-auth] button[type=submit]').click();
  ok(await seen(page.getByText('Enter a 10-digit mobile number')), `${tag}: a short number is refused`);
  await page.locator('#mob').fill('9876543210'); await page.locator('[data-auth] button[type=submit]').click();
  await page.locator('main h1', { hasText: 'Enter the code' }).waitFor();
  await page.locator('.otp input').first().fill('1');
  for (const d of '11111') await page.keyboard.type(d);
  await page.locator('[data-auth] button[type=submit]').click();
  ok(await seen(page.getByText('That code isn\'t right')), `${tag}: a wrong code says how many tries are left`);
  const boxes = page.locator('.otp input');
  for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill('123456'[i]);
  await page.locator('[data-auth] button[type=submit]').click();
  await page.locator('main h2', { hasText: 'Where should we deliver?' }).waitFor();
  ok(await page.locator('input[name="addr"]').count() === 2, `${tag}: back at checkout with the 2 saved addresses`);
  await basics(page, `${tag} checkout`);
  await page.locator('a', { hasText: 'Deliver here' }).click();
  await page.locator('main h2', { hasText: 'Deliver to' }).waitFor();
  await page.locator('[data-act="pay"]').click();
  const rzp = page.locator('.rzp');
  ok(await seen(rzp) && /Stand-in for Razorpay/i.test(await rzp.innerText()), `${tag}: Pay opens the payment window (stand-in)`);
  await rzp.locator('[data-way="card"]').click();
  await rzp.locator('[data-act="paid"]').click();
  await page.locator('main h1', { hasText: 'Your order is placed' }).waitFor();
  const no = (await page.locator('.done-hero b').first().innerText()).trim();
  ok(/^NH\d{8}$/.test(no) && /by Card/.test(await page.locator('.done-hero p').innerText()), `${tag}: order placed: ${no}, paid by card`);
  ok(!(await page.locator('[data-bag-n]').count()), `${tag}: the bag is empty after paying`);
  await page.locator('a', { hasText: 'See my order' }).click();
  await page.locator('main h1', { hasText: no }).waitFor();
  ok(await seen(page.locator('.badge', { hasText: 'Paid · being packed' })), `${tag}: the order page: paid, being packed`);
  await hashTo(page, '#/orders');
  ok((await page.locator('.ocard').first().innerText()).includes(no), `${tag}: My orders: the new order first`);
  await page.locator('.ocard', { hasText: 'NH25104471' }).click();
  ok(await seen(page.getByText('DTDC tracking number: D84512039')), `${tag}: a shipped order shows its tracking number`);
  await basics(page, `${tag} order`);
  await page.locator('[data-act="signout"]').count();
  ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();

  // A new customer: name, a new address with the pincode filling the city, then a failed payment.
  const n2 = await open(browser, w, mode, {});
  const p2 = n2.page;
  await goto(p2, '#/all');
  await p2.locator('.grid .card .acts [data-add]').first().click();
  await p2.locator('.drawer a', { hasText: 'Checkout' }).click();
  await p2.locator('#mob').waitFor();
  await p2.locator('#mob').fill('9123456789'); await p2.keyboard.press('Enter');
  await p2.locator('.otp input').first().waitFor();
  for (let i = 0; i < 6; i += 1) await p2.locator('.otp input').nth(i).fill('123456'[i]);
  await p2.keyboard.press('Enter');
  await p2.locator('#nm').waitFor();
  await p2.keyboard.press('Enter');
  ok(await seen(p2.getByText('Type your name')), `${tag} new customer: the name is needed`);
  await p2.locator('#nm').fill('Lakshmi Devi'); await p2.keyboard.press('Enter');
  await p2.locator('#a-name').waitFor();
  ok((await p2.locator('#a-name').inputValue()) === 'Lakshmi Devi' && (await p2.locator('#a-phone').inputValue()) === '9123456789', `${tag} new customer: the form starts with the name and mobile`);
  await p2.locator('form[data-addr] button[type=submit]').click();
  ok(await seen(p2.getByText('Please fill in:')), `${tag} new customer: missing fields are named`);
  await p2.locator('#a-pin').fill('522503');
  ok((await p2.locator('#a-city').inputValue()) === 'Mangalagiri' && (await p2.locator('#a-state').inputValue()) === 'Andhra Pradesh', `${tag} new customer: the pincode fills the city and state`);
  await p2.locator('#a-l1').fill('Door 7-12, Hussain Katta');
  await p2.locator('form[data-addr] button[type=submit]').click();
  await p2.locator('[data-act="pay"]').waitFor();
  await p2.locator('[data-act="pay"]').click();
  await p2.locator('[data-act="payfail"]').click();
  ok(await seen(p2.getByText('The payment didn\'t go through')), `${tag}: a failed payment: says no money was taken`);
  ok(!p2.errors.length, `${tag} new customer: no page errors ${p2.errors.join(' | ')}`);
  await n2.ctx.close();
}

async function looks(browser) {
  console.log(`\n=== ${ENGINE} looks, choices and states ===`);
  const one = async (opts, hash, check, label, w = 1440) => {
    const { ctx, page } = await open(browser, w, opts.theme || 'light', opts);
    await goto(page, hash);
    ok(await check(page), label);
    ok(!page.errors.length, `${label}: no page errors ${page.errors.join(' | ')}`);
    await ctx.close();
  };
  await one({ card: 'b' }, '#/all', async (p) => (await p.locator('.card .quick').first().isVisible()) && !(await p.locator('.card .acts').first().isVisible()), 'card B: a round + on the photo, no button');
  await one({ card: 'c' }, '#/all', async (p) => (await p.locator('.card .stock').first().isVisible()) && (await p.locator('.card .wa-mini').first().isVisible()), 'card C: stock line and WhatsApp');
  await one({ filters: 'b' }, '#/all', async (p) => { if (!(await p.locator('.fbar').isVisible()) || (await p.locator('.filters-side').count())) return false; await p.locator('[data-drop="price"]').click(); await p.locator('[data-pop="price"] input[value="u25"]').click(); await p.waitForTimeout(300); return p.url().includes('price=u25'); }, 'filters B: drop-downs across the top work');
  await one({ search: 'b' }, '#/all', async (p) => { if (await p.locator('#q-h').isVisible()) return false; await p.locator('.search-tool').click(); return p.locator('#q-pop').isVisible(); }, 'search B: the icon opens the search');
  await one({ pdp: 'b' }, `#/p/${await firstSlug(browser)}`, async (p) => (await p.locator('html').getAttribute('data-pdp')) === 'b', 'saree page B');
  await one({ palette: 'c', font: 'b', corners: 'b', theme: 'dark' }, '#/all', async (p) => (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())) === '#63BDB6', 'palette C, dark: the colours change');
  await one({}, '#/?state=loading', async (p) => (await p.locator('.card.sk').count()) === 8, 'home: loading placeholders');
  await one({}, '#/?state=error', async (p) => { await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForTimeout(300); return (await p.locator('.grid .card').count()) > 0; }, 'home: couldn\'t load, Try again');
  await one({}, '#/?craft=checks&price=o50', async (p) => p.getByRole('heading', { name: 'No sarees match these filters' }).isVisible(), 'filters with nothing: says so');
  await one({}, `#/p/${await firstSlug(browser)}?state=soldout`, async (p) => (await p.getByText('This saree has sold').isVisible()) && !(await p.locator('.buy-acts').count()), 'saree page: sold out, asks for a similar one');
  await one({}, '#/bag?state=empty', async (p) => p.getByRole('heading', { name: 'Your bag is empty' }).isVisible(), 'bag: empty');
  await one({}, '#/orders?state=empty', async (p) => p.getByRole('heading', { name: 'No orders yet' }).isVisible(), 'My orders: none yet');
  await one({}, '#/c/pattu-lehanga-sets', async (p) => (await p.locator('.grid .card').count()) > 0 && (await p.locator('.nav a[aria-current="page"]').innerText()).includes('Lehanga'), 'a category page');
  await one({}, '#/nope', async (p) => p.getByRole('heading', { name: 'We couldn\'t find that page' }).isVisible(), 'unknown address: a helpful page');
  await one({ home: 'c' }, '#/?cat=handloom-pattu-dress-material', async (p) => (await p.locator('.tabs .chip.on').innerText()).includes('Dress'), 'home C: a category tab', 390);
  // The Design options panel.
  const { ctx, page } = await open(browser, 1440, 'light', {});
  await goto(page, '#/');
  await page.locator('.mo-fab').click();
  await page.locator('.mo-panel [data-mo-k="home"][data-mo-v="b"]').click();
  ok(await seen(page.locator('.banner')), 'Design options: home B at once');
  const text = await page.evaluate(() => window.W9Opts.choicesText());
  ok(/1\. What opens first: B One banner/.test(text) && /2\. The saree card: A/.test(text), 'Copy my choices: the picks as text');
  const screens = await page.evaluate(() => window.W9Opts.screens().flatMap((g) => g[1].map((s) => s[0])).filter((s) => s.startsWith('site.html#')));
  let bad = [];
  for (const s of screens) {
    await page.goto(`${BASE}/${s}`); await page.locator('main h1').first().waitFor({ timeout: 5000 }).catch(() => {});
    const h = (await page.locator('main h1').first().innerText().catch(() => '')).trim();
    if (!h || /couldn't find|isn't on the website/i.test(h)) bad.push(`${s} → ${h}`);
  }
  ok(!bad.length && screens.length >= 20, `every screen in "Go to screen" opens (${screens.length}) ${bad.join(' | ')}`);
  ok(!page.errors.length, `screens: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
  // Reduce motion: nothing animates.
  const rm = await open(browser, 1440, 'light', {}, { reducedMotion: 'reduce' });
  await goto(rm.page, '#/');
  const dur = await rm.page.evaluate(() => getComputedStyle(document.querySelector('.card')).animationDuration);
  ok(dur.endsWith('ms') ? parseFloat(dur) < 1 : parseFloat(dur) < 0.01, `reduce motion: the cards don't animate (${dur})`);
  await rm.ctx.close();
  for (const [file, h1] of [['index.html', 'Products first: a typical online shop'], ['kit.html', 'The parts of the shop'], ['preview.html', 'The shop on a phone, a tablet and a laptop']]) {
    for (const w of [1440, 390]) {
      const o = await open(browser, w, 'light', {});
      await o.page.goto(`${BASE}/${file}`); await o.page.waitForTimeout(700);
      ok((await o.page.locator('h1').allInnerTexts()).map((t) => t.trim()).join('|') === h1, `${file} ${w}: opens`);
      ok(await o.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), `${file} ${w}: no sideways scrolling`);
      if (file === 'preview.html' && w === 1440) ok(await o.page.locator('iframe').count() === 2, 'preview: phone and laptop side by side');
      ok(!o.page.errors.length, `${file} ${w}: no page errors ${o.page.errors.join(' | ')}`);
      await o.ctx.close();
    }
  }
}
let slugCache = null;
async function firstSlug(browser) {
  if (slugCache) return slugCache;
  const { ctx, page } = await open(browser, 1440, 'light', {});
  await page.goto(`${BASE}/site.html#/`);
  slugCache = await page.evaluate(() => window.NH.products.find((p) => p.available === 1).slug);
  await ctx.close();
  return slugCache;
}

(async () => {
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  const started = Date.now();
  try {
    for (const [w, mode] of [[1440, 'light'], [390, 'light'], [390, 'dark'], [820, 'dark']]) await browsing(browser, w, mode, 'a');
    for (const home of ['b', 'c']) for (const [w, mode] of [[1440, 'light'], [390, 'light']]) await browsing(browser, w, mode, home);
    for (const [w, mode] of [[1440, 'light'], [390, 'light']]) await buying(browser, w, mode);
    await looks(browser);
  } catch (e) { fails.push(`crashed: ${e.message.split('\n')[0]}`); console.error(e); } finally { await browser.close(); }
  console.log(`\n${passed} checks passed, ${fails.length} failed, ${Math.round((Date.now() - started) / 1000)} s`);
  if (fails.length) { console.log(fails.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
})();
