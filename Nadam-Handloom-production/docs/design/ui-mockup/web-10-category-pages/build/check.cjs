/* Real-browser check of the website mock-up: the home page as picked (option A, 6 categories,
   latest collections, every saree), categories → collections → sarees, and the buying journey.
   With the mock-up folder served (python3 -m http.server 8765 --bind 127.0.0.1 in docs/design/ui-mockup):
     NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-10-category-pages/build/check.cjs
   NH_ENGINE=webkit WEBKIT_PATH=...  the same in Safari's engine.  SHOTS=1  saves the start page pictures.
   The saree photos load from the shop's media (S3): the check needs the internet. */
const { chromium, webkit } = require('playwright-core');
const path = require('node:path');

const BASE = process.env.NH_MOCK || 'http://127.0.0.1:8765/web-10-category-pages';
const ENGINE = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const fails = [];
let passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log(`  ok   ${m}`); } else { fails.push(`${ENGINE} ${m}`); console.log(`  FAIL ${m}`); } };
const seen = (loc, state = 'visible', timeout = 6000) => loc.waitFor({ state, timeout }).then(() => true, () => false);
const num = (t) => Number(String(t).replace(/[^\d]/g, ''));

async function open(browser, w, mode, opts = {}, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, colorScheme: mode, hasTouch: w < 600, ...extra });
  await ctx.addInitScript((o) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('w10mock.opts.v1', JSON.stringify(o)); sessionStorage.setItem('seeded', '1'); } }, { theme: mode, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  return { ctx, page };
}
// The page itself, not every photo from the shop's media (a slow moment there isn't a page problem).
const goto = async (page, hash) => { await page.goto(`${BASE}/site.html${hash}`, { waitUntil: 'domcontentloaded' }); await page.locator('main h1').first().waitFor(); await page.waitForTimeout(250); };
const hashTo = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(350); };
const data = (page) => page.evaluate(() => ({
  cats: window.NH.categories.map((c) => ({ slug: c.slug, name: c.name, short: c.short, collections: c.collections, soon: c.soon })),
  cols: window.NH.collections.map((c) => ({ id: c.id, name: c.name, category: c.category, count: c.count, newest: c.newest })),
  total: window.NH.products.length,
  byCol: window.NH.products.reduce((m, p) => { m[p.collection.id] = m[p.collection.id] || { n: 0, sets: 0 }; m[p.collection.id].n += 1; if (p.available > 1) m[p.collection.id].sets += 1; return m; }, {}),
}));
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
async function shot(page, name) {
  if (!process.env.SHOTS) return;
  await page.addStyleTag({ content: '.mo-fab, .mock-strip { display: none !important; }' });
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.cat-strip, .rail').forEach((r) => { r.scrollLeft = 0; }); }); await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, '..', 'img', `${name}.jpg`), type: 'jpeg', quality: 76 });
  await page.evaluate(() => document.head.lastElementChild.remove());
}
const photosLoaded = (page, sel, n = 4) => page.evaluate(async ([s, k]) => {
  const imgs = [...document.querySelectorAll(s)].slice(0, k);
  imgs.forEach((i) => { i.loading = 'eager'; });
  imgs[imgs.length - 1]?.scrollIntoView();
  await new Promise((r) => setTimeout(r, 2000));
  return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
}, [sel, n]);

/* ---------- 1 → 2 → 3: home, a category, a collection ---------- */
async function steps(browser, w, mode) {
  const tag = `${w}-${mode}`;
  const phone = w < 700;
  console.log(`\n=== ${ENGINE} ${tag}: home → category → collection ===`);
  const { ctx, page } = await open(browser, w, mode);
  await goto(page, '#/');
  const D = await data(page);
  ok(D.cats.length === 6 && D.cats.filter((c) => c.soon).length === 2, `${tag}: 6 categories in the data, 2 coming soon`);
  const circles = await page.locator('.cat-strip .cs.cat').allInnerTexts();
  ok(circles.length === 6 && circles.filter((t) => /Coming soon/.test(t)).length === 2, `${tag}: home: the 6 categories as round photos, 2 "Coming soon"`);
  ok(await page.locator('.nav > .wrap > ul > li').count() === 9, `${tag}: the menu bar: All, the 6 categories, New in, Sets`);
  const latest = await page.locator('.latest .ctile .t b').allInnerTexts();
  const want = [...D.cols].sort((x, y) => y.newest.localeCompare(x.newest)).slice(0, 10).map((c) => c.name);
  ok(latest.join('|') === want.join('|'), `${tag}: home: the latest collections, newest first (${latest[0]} …)`);
  ok(num(await page.locator('.list-head .count').innerText()) === D.total && D.total > 1700, `${tag}: home: every saree (${D.total})`);
  const firstCard = await page.evaluate(() => Math.round(document.querySelector('main .grid .card').getBoundingClientRect().top));
  ok(firstCard < (phone ? 1250 : 1150), `${tag}: home: the sarees start right after the latest collections (${firstCard}px)`);
  ok(await photosLoaded(page, '.cat-strip .cs.cat img', 6) && await photosLoaded(page, '.latest .ctile img', 4) && await photosLoaded(page, 'main .grid .card img', 4), `${tag}: home: category, collection and saree photos load`);
  await basics(page, `${tag} home`);
  if (mode === 'light' && (w === 1440 || w === 390)) await shot(page, `step-1-${phone ? 'phone' : 'laptop'}`);
  // Step 2: a category's collections.
  const cat = D.cats[0];
  await page.locator('.cat-strip .cs.cat').first().click();
  await page.locator('main h1', { hasText: cat.name }).waitFor();
  const cols = D.cols.filter((c) => c.category === cat.slug);
  const tiles = page.locator('.ccols .ctile');
  ok(await tiles.count() === cols.length && cols.length === cat.collections, `${tag}: ${cat.short}: all ${cols.length} collections`);
  ok((await page.locator('.ccols .ctile .t b').allInnerTexts()).join('|') === cols.map((c) => c.name).join('|'), `${tag}: ${cat.short}: most pieces first`);
  ok(!(await page.locator('main .grid .card').count()), `${tag}: ${cat.short}: only the collections (choice 1 A)`);
  const top = await tiles.first().boundingBox();
  ok(top.y < (phone ? 844 : 900), `${tag}: the first collection is on the first screen (${Math.round(top.y)}px)`);
  const perRow = await page.evaluate(() => { const t = [...document.querySelectorAll('.ccols .ctile')]; const y = t[0].offsetTop; return t.filter((x) => Math.abs(x.offsetTop - y) < 2).length; });
  ok(perRow === (phone ? 2 : w <= 1100 ? 3 : 4), `${tag}: ${perRow} collections in a row`);
  ok(await photosLoaded(page, '.ccols .ctile img', 6), `${tag}: the collection photos load`);
  await basics(page, `${tag} category`);
  if (mode === 'light' && (w === 1440 || w === 390)) await shot(page, `step-2-${phone ? 'phone' : 'laptop'}`);
  // Step 3: a collection's sarees.
  const col = cols.find((c) => c.name === 'Gap Border Embroidery Sarees') || cols[0];
  await page.locator('.ccols .ctile', { hasText: col.name }).first().click();
  await page.locator('main h1', { hasText: col.name }).waitFor();
  const n = D.byCol[col.id].n;
  ok(num(await page.locator('.ctool .count').innerText()) === n && n === col.count, `${tag}: ${col.name}: ${n} sarees (the website says ${col.count})`);
  ok(await page.locator('.cgrid .card').count() === Math.min(24, n), `${tag}: the first ${Math.min(24, n)} show`);
  ok(await photosLoaded(page, '.cgrid .card img', 4), `${tag}: the saree photos load`);
  while (await page.locator('[data-cmore]').count()) { await page.locator('[data-cmore]').click(); await page.waitForTimeout(150); }
  ok(await page.locator('.cgrid .card').count() === n, `${tag}: Load more until all ${n} show`);
  if (D.byCol[col.id].sets) {
    await page.locator('[data-csets]').click(); await page.waitForTimeout(200);
    ok(num(await page.locator('.ctool .count').innerText()) === D.byCol[col.id].sets, `${tag}: Sets only: ${D.byCol[col.id].sets}`);
    await page.locator('[data-csets]').click(); await page.waitForTimeout(150);
  }
  if (w > 900) { // the grid size buttons show on laptops
    await page.locator('[data-ccols="3"]').click(); await page.waitForTimeout(200);
    const row = await page.evaluate(() => { const t = [...document.querySelectorAll('.cgrid .card')]; const y = t[0].offsetTop; return t.filter((x) => Math.abs(x.offsetTop - y) < 2).length; });
    ok(row === 3, `${tag}: bigger photos, 3 in a row`);
    await page.locator('[data-ccols="4"]').click(); await page.waitForTimeout(150);
  }
  await basics(page, `${tag} collection`);
  if (mode === 'light' && (w === 1440 || w === 390)) await shot(page, `step-3-${phone ? 'phone' : 'laptop'}`);
  await page.locator('.crumbs a', { hasText: cat.short }).click();
  ok(await seen(page.locator('main h1', { hasText: cat.name })), `${tag}: the breadcrumb goes back to the category`);
  await page.goBack(); await page.waitForTimeout(300);
  ok((await page.locator('main h1').innerText()).trim() === col.name, `${tag}: the browser's Back works`);
  // A latest collection from the home page, and a coming-soon category.
  await hashTo(page, '#/');
  await page.locator('.latest .ctile').first().click();
  ok(await seen(page.locator('main h1', { hasText: latest[0] })), `${tag}: a latest collection opens its sarees`);
  await hashTo(page, '#/c/fabrics');
  ok(await seen(page.getByRole('heading', { name: 'Fabrics: new pieces coming soon' })), `${tag}: a category without sarees says "coming soon", with WhatsApp`);
  ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
}

/* ---------- The home page's list: filters, sort, pages, search, menus ---------- */
async function browsing(browser, w, mode) {
  const tag = `${w}-${mode}`;
  const phone = w < 900;
  console.log(`\n=== ${ENGINE} ${tag}: finding a saree ===`);
  const { ctx, page } = await open(browser, w, mode);
  await goto(page, '#/');
  const total = num(await page.locator('.list-head .count').innerText());
  if (!phone) {
    await page.locator('.filters-side input[data-f="cat"][value="handloom-pattu-dress-material"]').click(); await page.waitForTimeout(350);
    const n = num(await page.locator('.list-head .count').innerText());
    ok(n === 145 && page.url().includes('cat=handloom-pattu-dress-material'), `${tag}: category filter (${total} → ${n}), in the address`);
    ok(await page.locator('.filters-side input[data-f="cat"][value="fabrics"]').isDisabled(), `${tag}: a coming-soon category can't be ticked (0)`);
    await page.locator('.applied [data-act="clear"]').click(); await page.waitForTimeout(300);
    await page.selectOption('[data-sort]', 'price-asc'); await page.waitForTimeout(300);
    const prices = await page.locator('main .grid .card .price').allInnerTexts();
    ok(num(prices[0]) <= num(prices[1]) && num(prices[1]) <= num(prices[prices.length - 1]), `${tag}: sort by price, low to high (${prices[0]} …)`);
    await page.locator('.pager a', { hasText: '2' }).first().click(); await page.waitForTimeout(400);
    ok(page.url().includes('page=2') && /Showing 25–48/.test(await page.locator('.pager-note').innerText()), `${tag}: page 2 shows 25–48`);
    await page.locator('.nav li', { hasText: 'Pattu sarees' }).first().hover();
    ok(await seen(page.locator('.nav .mega').first()), `${tag}: a category shows its collections on hover`);
  } else {
    await page.locator('[data-act="filters"]').click();
    ok(await seen(page.locator('.sheet')), `${tag}: Filter opens a sheet`);
    await page.locator('.sheet [data-fg="craft"]').click();
    await page.locator('.sheet input[data-f="craft"][value="embroidery"]').click(); await page.waitForTimeout(450);
    ok(await seen(page.locator('.sheet')) && page.url().includes('craft=embroidery'), `${tag}: ticking a craft keeps the sheet open`);
    await page.locator('.sheet .df .btn-primary').click();
    ok(await seen(page.locator('.sheet'), 'detached'), `${tag}: "Show N sarees" closes it`);
    await page.locator('[data-act="sort"]').click();
    await page.locator('.sheet input[value="price-desc"]').click(); await page.waitForTimeout(400);
    const prices = await page.locator('main .grid .card .price').allInnerTexts();
    ok(num(prices[0]) >= num(prices[1]), `${tag}: Sort sheet: price high to low`);
    await hashTo(page, '#/');
    const before = await page.locator('main .grid .card').count();
    await page.locator('.more-wrap .btn').click(); await page.waitForTimeout(400);
    ok((await page.locator('main .grid .card').count()) === before + 24, `${tag}: "Show more sarees" adds 24`);
    await page.locator('.menu-btn').click();
    ok(await seen(page.locator('.drawer.left')), `${tag}: the menu opens`);
    await page.keyboard.press('Escape');
    ok(await seen(page.locator('.drawer.left'), 'detached'), `${tag}: Escape closes the menu`);
  }
  await page.locator('#q-h').fill('kalamkari');
  ok(await seen(page.locator('.suggest')), `${tag}: search suggests as you type`);
  await page.locator('#q-h').press('Enter'); await page.waitForTimeout(350);
  const crafts = await page.locator('main .grid .card .col').allInnerTexts();
  ok(page.url().includes('search?q=kalamkari') && crafts.length > 0 && crafts.every((x) => /kalamkari|hand painted/i.test(x)), `${tag}: search "kalamkari"`);
  await hashTo(page, '#/search?q=banarasi');
  ok(await seen(page.getByRole('heading', { name: 'Nothing found for "banarasi"' })), `${tag}: nothing found: says so`);
  ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
}

/* ---------- The saree, the bag, sign in, checkout, orders ---------- */
async function buying(browser, w, mode) {
  const tag = `${w}-${mode}`;
  console.log(`\n=== ${ENGINE} ${tag}: buying ===`);
  const { ctx, page } = await open(browser, w, mode);
  await goto(page, '#/sets');
  await page.locator('main .grid .card .nm').first().click();
  await page.locator('.buybox h1').waitFor();
  ok(/In stock: \d+ identical pieces/.test(await page.locator('.stockline').innerText()), `${tag}: saree page: a set says how many`);
  await basics(page, `${tag} saree page`);
  await page.locator('[data-qty="1"]').click();
  await page.locator('.buy-acts [data-add]').click();
  const drawer = page.locator('.drawer:not(.left)');
  ok(await seen(drawer) && /Added to your bag/.test(await drawer.innerText()) && (await page.locator('[data-bag-n]').innerText()) === '2', `${tag}: Add to bag: 2 pieces in the bag`);
  await page.keyboard.press('Escape');
  await hashTo(page, '#/all');
  await page.locator('main .grid .card').filter({ hasText: 'Add to bag' }).first().locator('.acts [data-add]').click();
  ok(await seen(drawer) && (await drawer.locator('.bline').count()) === 2, `${tag}: a card's Add to bag: 2 sarees`);
  await drawer.locator('a', { hasText: 'Checkout' }).click();
  await page.locator('#mob').waitFor();
  await page.locator('#mob').fill('9876543210'); await page.keyboard.press('Enter');
  await page.locator('.otp input').first().waitFor();
  for (let i = 0; i < 6; i += 1) await page.locator('.otp input').nth(i).fill('123456'[i]);
  await page.keyboard.press('Enter');
  await page.locator('main h2', { hasText: 'Where should we deliver?' }).waitFor();
  ok(await page.locator('input[name="addr"]').count() === 2, `${tag}: signed in: checkout with 2 saved addresses`);
  await page.locator('a', { hasText: 'Deliver here' }).click();
  await page.locator('[data-act="pay"]').waitFor();
  await page.locator('[data-act="pay"]').click();
  await page.locator('.rzp [data-act="paid"]').click();
  await page.locator('main h1', { hasText: 'Your order is placed' }).waitFor();
  const no = (await page.locator('.done-hero b').first().innerText()).trim();
  ok(/^NH\d{8}$/.test(no), `${tag}: order placed: ${no}`);
  await hashTo(page, '#/orders');
  ok((await page.locator('.ocard').first().innerText()).includes(no), `${tag}: My orders: the new order first`);
  ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
}

/* ---------- Every category and every collection ---------- */
async function everyPage(browser) {
  console.log(`\n=== ${ENGINE} every category and collection ===`);
  const { ctx, page } = await open(browser, 1440, 'light');
  await goto(page, '#/');
  const D = await data(page);
  const bad = [];
  for (const c of D.cats) {
    await hashTo(page, `#/c/${c.slug}`);
    const h1 = (await page.locator('main h1').innerText()).trim();
    const n = await page.locator('.ccols .ctile').count();
    if (h1 !== c.name || (c.soon ? !(await page.getByText('new pieces coming soon').count()) : n !== c.collections)) bad.push(`${c.slug}: ${n}`);
  }
  ok(!bad.length, `all ${D.cats.length} categories open (${D.cats.filter((c) => !c.soon).length} with all their collections, ${D.cats.filter((c) => c.soon).length} coming soon) ${bad.join(' | ')}`);
  const wrong = [];
  let sum = 0;
  for (const col of D.cols) {
    await page.evaluate((h) => { location.hash = h; }, `#/collection/${col.id}`);
    await page.waitForTimeout(40);
    const shown = num(await page.locator('.ctool .count').innerText());
    const cards = await page.locator('.cgrid .card').count();
    sum += shown;
    if ((await page.locator('main h1').innerText()).trim() !== col.name || shown !== col.count || cards !== Math.min(24, col.count)) wrong.push(`${col.name}: ${shown}/${col.count}`);
  }
  ok(!wrong.length && sum === D.total, `all ${D.cols.length} collections open with their sarees (${sum} in all) ${wrong.join(' | ')}`);
  ok(!page.errors.length, `every page: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
}

/* ---------- Choices, looks, states, other pages ---------- */
async function choices(browser) {
  console.log(`\n=== ${ENGINE} choices and states ===`);
  const one = async (opts, hash, check, label, w = 1440, extra = {}) => {
    const { ctx, page } = await open(browser, w, opts.theme || 'light', opts, extra);
    await goto(page, hash);
    ok(await check(page), label);
    ok(!page.errors.length, `${label}: no page errors ${page.errors.join(' | ')}`);
    await ctx.close();
  };
  const PATTU = '#/c/mangalagiri-handloom-pattu-sarees';
  await one({ catpage: 'b' }, '#/c/handloom-pattu-dress-material', async (p) => (await p.locator('.ccols .ctile').count()) === 8 && num(await p.locator('.cat-all .list-head .count').innerText()) === 145, '1 B: the collections, then all the category\'s sarees');
  await one({ banner: 'b' }, PATTU, async (p) => (await p.locator('.cbanner.big').count()) === 1, '2 B: the big banner');
  await one({ tile: 'b' }, PATTU, async (p) => (await p.locator('.ccols .ctile.under').count()) === 62, '3 B: names under the photos');
  await one({ order: 'b' }, PATTU, async (p) => { const t = await p.locator('.ccols .ctile .t b').allInnerTexts(); return t.length === 62 && t.every((x, i) => !i || t[i - 1].localeCompare(x, 'en', { sensitivity: 'base' }) <= 0); }, '4 B: A to Z');
  await one({ colnav: 'b' }, '#/c/pattu-lehanga-sets', async (p) => { await p.locator('.ccols .ctile').nth(1).click(); await p.waitForTimeout(250); return (await p.locator('.sibs .chip').count()) === 5 && (await p.locator('.sibs [aria-current="page"]').count()) === 1; }, '5 B: the other collections as chips');
  await one({ pdp: 'b' }, '#/sets', async (p) => { await p.locator('main .grid .card .nm').first().click(); await p.waitForTimeout(300); return (await p.locator('html').getAttribute('data-pdp')) === 'b' && (await p.locator('.buybox h1').count()) === 1; }, '6 B: the bigger saree photo');
  await one({ palette: 'c', font: 'b', corners: 'b', theme: 'dark' }, '#/', async (p) => (await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())) === '#63BDB6', 'look C, dark: the colours change');
  await one({}, '#/?state=loading', async (p) => (await p.locator('.card.sk').count()) === 8 && (await p.locator('.latest .ctile.sk').count()) === 5, 'home: loading');
  await one({}, '#/?state=error', async (p) => { await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForTimeout(300); return (await p.locator('main .grid .card').count()) > 0; }, 'home: couldn\'t load, Try again');
  await one({}, `${PATTU}?state=loading`, async (p) => (await p.locator('.ccols[aria-busy="true"] .ctile.sk').count()) === 8, 'a category: loading');
  await one({}, `${PATTU}?state=error`, async (p) => { await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForTimeout(300); return (await p.locator('.ccols .ctile').count()) === 62; }, 'a category: couldn\'t load, Try again');
  const gap = await (async () => { const { ctx, page } = await open(browser, 1440, 'light'); await goto(page, '#/'); const id = await page.evaluate(() => window.NH.collections.find((c) => c.name === 'Gap Border Embroidery Sarees').id); await ctx.close(); return id; })();
  await one({}, `#/collection/${gap}?state=soldout`, async (p) => p.getByRole('heading', { name: 'Everything in this collection has sold out' }).isVisible(), 'a collection: everything sold');
  await one({}, `#/collection/${gap}?state=loading`, async (p) => (await p.locator('.grid[aria-busy="true"] .card.sk').count()) === 8, 'a collection: loading');
  await one({}, '#/bag?state=empty', async (p) => p.getByRole('heading', { name: 'Your bag is empty' }).isVisible(), 'bag: empty');
  await one({}, '#/orders?state=empty', async (p) => p.getByRole('heading', { name: 'No orders yet' }).isVisible(), 'My orders: none yet');
  await one({}, '#/nope', async (p) => p.getByRole('heading', { name: 'We couldn\'t find that page' }).isVisible(), 'an unknown address: a helpful page');
  const rm = await open(browser, 1440, 'light', {}, { reducedMotion: 'reduce' });
  await goto(rm.page, PATTU);
  const dur = await rm.page.evaluate(() => getComputedStyle(document.querySelector('.ctile')).animationDuration);
  ok(dur.endsWith('ms') ? parseFloat(dur) < 1 : parseFloat(dur) < 0.01, `reduce motion: nothing animates (${dur})`);
  await rm.ctx.close();
  const { ctx, page } = await open(browser, 1440, 'light');
  await goto(page, '#/c/pattu-lehanga-sets');
  await page.locator('.mo-fab').click();
  await page.locator('.mo-panel [data-mo-k="tile"][data-mo-v="b"]').click();
  ok(await seen(page.locator('.ctile.under').first()), 'Design options: choice 3 B at once');
  const text = await page.evaluate(() => window.W10Opts.choicesText());
  ok(/1\. A category page: A/.test(text) && /3\. A collection's photo: B/.test(text), 'Copy my choices: the picks as text');
  const screens = await page.evaluate(() => window.W10Opts.screens().flatMap((g) => g[1].map((s) => s[0])).filter((s) => s.startsWith('site.html#')));
  const bad = [];
  for (const s of screens) { await page.goto(`${BASE}/${s}`, { waitUntil: 'domcontentloaded' }); await page.locator('main h1').first().waitFor({ timeout: 5000 }).catch(() => {}); const h = (await page.locator('main h1').first().innerText().catch(() => '')).trim(); if (!h || /couldn't find|isn't on the website/i.test(h)) bad.push(`${s} → ${h}`); }
  ok(!bad.length && screens.length >= 30, `every screen in "Go to screen" opens (${screens.length}) ${bad.join(' | ')}`);
  ok(!page.errors.length, `screens: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
  for (const [file, h1] of [['index.html', 'The website, as the client wants it'], ['kit.html', 'The parts of the shop'], ['preview.html', 'The website on a phone, a tablet and a laptop']]) {
    for (const w of [1440, 390]) {
      const o = await open(browser, w, 'light');
      await o.page.goto(`${BASE}/${file}`, { waitUntil: 'domcontentloaded' }); await o.page.waitForTimeout(1200);
      ok((await o.page.locator('h1').allInnerTexts()).map((t) => t.trim()).join('|') === h1, `${file} ${w}: opens`);
      ok(await o.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), `${file} ${w}: no sideways scrolling`);
      if (file === 'index.html' && w === 1440) ok(await o.page.locator('.cols a').count() === 76 && await o.page.locator('.cols a.fixed').count() === 2 && await o.page.locator('.catlist > div').count() === 6, 'start page: the 6 categories, 76 collections, 2 photos marked as chosen');
      if (file === 'preview.html' && w === 1440) ok(await o.page.locator('iframe').count() === 2, 'preview: phone and laptop side by side');
      ok(!o.page.errors.length, `${file} ${w}: no page errors ${o.page.errors.join(' | ')}`);
      await o.ctx.close();
    }
  }
}

(async () => {
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  const started = Date.now();
  try {
    for (const [w, mode] of [[1440, 'light'], [390, 'light'], [390, 'dark'], [820, 'light']]) await steps(browser, w, mode);
    for (const [w, mode] of [[1440, 'light'], [390, 'light']]) await browsing(browser, w, mode);
    for (const [w, mode] of [[1440, 'light'], [390, 'light']]) await buying(browser, w, mode);
    await everyPage(browser);
    await choices(browser);
  } catch (e) { fails.push(`crashed: ${e.message.split('\n')[0]}`); console.error(e); } finally { await browser.close(); }
  console.log(`\n${passed} checks passed, ${fails.length} failed, ${Math.round((Date.now() - started) / 1000)} s`);
  if (fails.length) { console.log(fails.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
})();
