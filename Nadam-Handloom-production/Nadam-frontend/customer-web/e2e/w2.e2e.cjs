/* End-to-end test of website modules W2–W4 (home, collections, lists, saree page) in a real
   browser, in the client's design (26 Oct 2026: search header, categories → collections →
   sarees, the shop's details only on the home page), against the real server on a LOCAL database with real catalogue data (a copy of the
   live data, e.g. nandam_live_20261016, or nandam_e2e). It only reads: no saree is changed.
     node e2e/w2.e2e.cjs            (both widths, light and dark; screenshots in e2e/out/)
   Env: NH_WEB (default http://127.0.0.1:5180), NH_API (default http://127.0.0.1:4300),
        NH_E2E_DB (the server's database, to find a sold-out saree; local only),
        CHROME_PATH, NH_ENGINE=webkit, NH_ROUNDS=390-light,1440-dark (as in w1.e2e.cjs),
        NH_NO_SHOTS=1 (no screenshots: in WebKit against the strict policy, each screenshot logs a
        refused <style> that Playwright injects; the website itself has none). */
const { chromium, webkit } = require('playwright-core');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.NH_WEB || 'http://127.0.0.1:5180';
const API = `${process.env.NH_API || 'http://127.0.0.1:4300'}/api/v2/shop`;
const DB = process.env.NH_E2E_DB || 'nandam_live_20261016';
const EXE = process.env.CHROME_PATH || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const PSQL = process.env.PSQL || '/opt/homebrew/opt/postgresql@18/bin/psql';
const OUT = path.join(__dirname, 'out');
const ENGINE = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
fs.mkdirSync(OUT, { recursive: true });
if (!/^nandam_(e2e|test|live_\d{8})$/.test(DB)) throw new Error('Refusing: NH_E2E_DB must be a local copy (nandam_e2e, nandam_test or nandam_live_YYYYMMDD)');

const fails = [];
const errors = [];
let passed = 0;
const ok = (cond, msg) => {
  if (cond) { passed++; console.log(`  ok   ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); }
};
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const sql = (q) => execFileSync(PSQL, ['-d', DB, '-Atc', q], { encoding: 'utf8' }).trim();
// One retry: Node's fetch can reuse a connection the server already closed ("fetch failed").
const get = async (p) => {
  try { return await (await fetch(`${API}${p}`)).json(); } catch { await sleep(500); return (await fetch(`${API}${p}`)).json(); }
};
const rs = (v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`;
const near = (a, b, d) => Math.abs(a - b) <= d;
// Waits (up to 8 s) for something to show or go; false if it never does.
const seen = (loc, state = 'visible') => loc.waitFor({ state, timeout: 8000 }).then(() => true, () => false);
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { if (await fn()) return true; if (Date.now() > end) return false; await sleep(100); } };

async function shot(page, name) {
  if (process.env.NH_NO_SHOTS) return; // proves a WebKit style warning comes from the screenshots
  // caret 'initial': Playwright otherwise adds a <style> to hide the text cursor, which the
  // strict security policy (rightly) refuses in WebKit.
  await page.screenshot({ path: path.join(OUT, `w2-${name}.png`), caret: 'initial' });
}

async function noSideScroll(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, `${label}: no sideways scrolling (${over}px)`);
}

// One h1; every picture has alt text (empty when decorative); every button and link has a name;
// every visible form control has a label.
async function a11y(page, label) {
  const r = await page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().length > 0
      || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim());
    return {
      h1: document.querySelectorAll('h1').length,
      noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(-40)),
      unnamed: [...document.querySelectorAll('button, a[href]')].filter((b) => visible(b) && !named(b)).map((b) => b.outerHTML.slice(0, 90)),
      unlabelled: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((el) => visible(el)
        && !(el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label'))).map((el) => el.outerHTML.slice(0, 80)),
    };
  });
  ok(r.h1 === 1, `${label}: one main heading (${r.h1})`);
  ok(!r.noAlt.length, `${label}: every picture has alt text ${r.noAlt.join(' ')}`);
  ok(!r.unnamed.length, `${label}: every button and link has a name ${r.unnamed.join(' | ')}`);
  ok(!r.unlabelled.length, `${label}: every form control has a label ${r.unlabelled.join(' | ')}`);
}

// Cards on screen have faded in (none left invisible after the list changed).
const shown = (page) => until(() => page.evaluate(() => [...document.querySelectorAll('.pgrid .pcard.reveal')]
  .filter((c) => { const r = c.getBoundingClientRect(); return r.top < window.innerHeight * 0.8 && r.bottom > 0; }) // well on screen
  .every((c) => Number(getComputedStyle(c).opacity) > 0.99)), 4000);
const cards = (page, scope = '.pgrid') => page.locator(`${scope} .pcard:not(.skel-card)`);
// The count beside a list: its title (home, shop, search) or a collection's toolbar.
const waitCount = (page, n) => page.waitForFunction((t) => document.querySelector('.list-head .count, .ctool .count')?.textContent.trim() === t, `${n.toLocaleString('en-IN')} ${n === 1 ? 'saree' : 'sarees'}`);
const SHORT = { 'mangalagiri-handloom-pattu-sarees': 'Pattu sarees', 'handloom-pattu-dress-material': 'Pattu dress materials', 'pattu-lehanga-sets': 'Lehanga sets', 'handloom-cotton-saree': 'Cotton sarees', 'handloom-cotton-dress-material': 'Cotton dress materials', fabrics: 'Fabrics' };
const short = (c) => SHORT[c.slug] || c.name;
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ldOf = (page, type) => page.evaluate((t) => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((x) => x['@type'] === t) || null, type);

async function run(browser, width, mode, fixtures) {
  const phone = width < 600;
  const tag = `${width}-${mode}`;
  console.log(`\n=== ${tag} ===`);
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, colorScheme: mode, locale: 'en-IN', timezoneId: 'Asia/Kolkata', hasTouch: phone });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(`${tag} page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error' || /Failed to load resource: the server responded with a status of (404|400)/.test(m.text())) return;
    // A photo the local copy still names but the photo store no longer has (S3 answers 403).
    if (/status of 403/.test(m.text()) && /amazonaws\.com\//.test(m.location()?.url || '')) return;
    errors.push(`${tag} console: ${m.text()}`);
    console.log(`  console error at ${page.url()}: ${m.text().slice(0, 160)}`);
  });
  const { home, catalog } = fixtures;

  /* ---------- Home: categories, latest collections, every saree, the shop's details ---------- */
  const all = [...catalog.categories, ...catalog.soon];
  await page.goto(BASE);
  ok((await page.locator('html').getAttribute('data-mode')) === mode, `${tag} theme follows the device (${mode})`);
  ok((await page.locator('.top-strip a[href^="https://wa.me/"]').getAttribute('href')) === `https://wa.me/${home.store.whatsapp}`, `${tag} the strip's WhatsApp number`);
  // The categories as cards (client, 27 Oct 2026): 3 in a row (2 on phones), only the photo and
  // the name, the photo shaped like a saree card; the admin app's photo.
  const cardsSec = page.locator('section[aria-labelledby="h-cats"]');
  const ccards = cardsSec.locator('a.ccard');
  await ccards.first().waitFor();
  ok(await ccards.count() === all.length, `${tag} all ${all.length} categories as cards`);
  const order = [...catalog.categories].sort((a, b) => b.count - a.count).concat(catalog.soon);
  ok(JSON.stringify(await ccards.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) === JSON.stringify(order.map((c) => `/category/${c.slug}`)), `${tag} cards: most pieces first, those without sarees last`);
  ok(JSON.stringify(await ccards.evaluateAll((as) => as.map((a) => a.textContent.trim()))) === JSON.stringify(order.map(short)), `${tag} each card shows only the name (${order.map(short).join(', ')})`);
  ok(await ccards.evaluateAll((as) => as.every((a) => a.querySelectorAll('img').length === 1 && !a.querySelector('button, .btn, .badge, small'))), `${tag} each card is only a photo and the name`);
  ok(await ccards.evaluateAll((as, imgs) => as.every((a, i) => !imgs[i] || a.querySelector('img').getAttribute('src') === imgs[i]), order.map((c) => c.image || null)), `${tag} each card shows the admin app's photo`);
  const shape = await ccards.evaluateAll((as) => as.map((a) => { const r = a.querySelector('.ph').getBoundingClientRect(); return r.height / r.width; }));
  ok(shape.every((x) => Math.abs(x - 4 / 3) < 0.01), `${tag} the photos are shaped like a saree card (3:4)`);
  const perRow = await ccards.evaluateAll((as) => as.filter((a) => a.getBoundingClientRect().top === as[0].getBoundingClientRect().top).length);
  ok(perRow === (width <= 640 ? 2 : 3), `${tag} ${width <= 640 ? 2 : 3} cards in a row (${perRow})`);
  ok((await cardsSec.locator('.block-head a.more').textContent()).includes(catalog.totals.sarees.toLocaleString('en-IN')), `${tag} "All … sarees" link (${catalog.totals.sarees})`);
  ok(await page.locator('nav.craft-strip .cs').count() === catalog.crafts.filter((k) => k.image).length, `${tag} the crafts as round photos under the cards`);
  const latest = [...catalog.collections].sort((a, b) => b.newest.localeCompare(a.newest)).slice(0, 10);
  const tiles = page.locator('section[aria-labelledby="h-latest"] a.ctile');
  ok(await tiles.count() === latest.length, `${tag} Latest collections: ${latest.length}`);
  ok((await tiles.first().getAttribute('href')) === `/category/${latest[0].category}/${latest[0].id}`, `${tag} the newest first: ${latest[0].name}`);
  ok((await tiles.first().textContent()).includes(`${latest[0].count.toLocaleString('en-IN')} piece`), `${tag} a tile shows its pieces and price`);
  ok(await tiles.locator('.badge.new').count() === latest.filter((c) => c.hasNew).length, `${tag} "New" on collections with sarees from the last days (${latest.filter((c) => c.hasNew).length})`);
  ok(await seen(page.getByRole('heading', { level: 2, name: 'All sarees' })), `${tag} then "All sarees"`);
  await waitCount(page, catalog.totals.sarees);
  await cards(page).nth(23).waitFor();
  ok(await cards(page).count() === 24, `${tag} the first 24 sarees on the home page`);
  const store = page.locator('#store');
  for (const l of home.store.addressLines) ok((await store.textContent()).includes(l), `${tag} footer: store address ${l}`);
  ok((await store.getByRole('link', { name: /Directions/ }).getAttribute('href')) === home.store.mapUrl, `${tag} footer: directions link`);
  ok((await page.locator('.ftr').getByRole('link', { name: 'WhatsApp us' }).getAttribute('href')).startsWith(`https://wa.me/${home.store.whatsapp}`), `${tag} footer: WhatsApp link`);
  ok(await page.locator('.trust').count() === 1 && await page.locator('.ftr-line').count() === 0, `${tag} the home page has the full footer`);
  const alerts = page.locator('section[aria-labelledby="h-alerts"]');
  ok(await alerts.getByRole('button', { name: 'Tell me about new arrivals' }).count() + await alerts.getByRole('link', { name: /new arrivals on WhatsApp/ }).count() === 1, `${tag} new-arrival alerts (notifications, or WhatsApp where they can't work)`);
  const shopLd = await ldOf(page, 'ClothingStore');
  ok(shopLd?.openingHours === home.store.openingHours && shopLd.address.postalCode === '522503', `${tag} store details for search engines`);
  await noSideScroll(page, `${tag} home`);
  await a11y(page, `${tag} home`);
  await shot(page, `${tag}-home`);
  await page.locator('section[aria-labelledby="h-latest"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot(page, `${tag}-home-latest`);
  await page.locator('section[aria-labelledby="h-cats"]').scrollIntoViewIfNeeded();
  await page.locator('section[aria-labelledby="h-cats"] a.ccard').first().click();
  await page.waitForURL(`**/category/${[...catalog.categories].sort((x, y) => y.count - x.count)[0].slug}`);
  ok(await seen(page.locator('.cbanner h1')), `${tag} a category card opens its page`);

  /* ---------- Footer only on the home page; one line of links elsewhere ---------- */
  await page.goto(`${BASE}/shop`);
  const line = page.locator('.ftr-line');
  await line.waitFor();
  ok(await page.locator('.ftr').count() === 0 && await page.locator('.trust').count() === 0, `${tag} other pages: no shop details footer`);
  for (const [to, name] of [['/shipping', 'Shipping'], ['/refunds', 'Cancellation and refunds'], ['/contact', 'Contact us'], ['/privacy', 'Privacy'], ['/terms', 'Terms']]) {
    ok((await line.getByRole('link', { name, exact: true }).getAttribute('href')) === to, `${tag} the line links to ${name}`);
  }

  /* ---------- Header: the category menu, the phone menu, search ---------- */
  const nav = page.getByRole('navigation', { name: 'Shop' });
  await until(async () => await nav.locator('a[href^="/category/"]').count() === all.length); // the categories arrive with the shop's data
  for (const c of all) ok(await nav.getByRole('link', { name: short(c), exact: true }).count() === 1, `${tag} menu bar: ${short(c)}`);
  ok(await nav.getByRole('link', { name: 'New in', exact: true }).count() === 1 && await nav.getByRole('link', { name: 'Sets', exact: true }).count() === 1, `${tag} menu bar: New in and Sets`);
  const pattu = catalog.categories[0];
  if (!phone) {
    await nav.getByRole('link', { name: short(pattu), exact: true }).hover();
    const mega = page.getByRole('region', { name: short(pattu) });
    ok(await seen(mega), `${tag} pointing at ${short(pattu)} opens its menu`);
    const first = catalog.collections.find((c) => c.category === pattu.slug);
    ok(await mega.getByRole('link', { name: new RegExp(`^${esc(first.name)}`) }).count() >= 1, `${tag} its menu lists its collections (${first.name})`);
    await shot(page, `${tag}-mega`);
    await mega.getByRole('link', { name: new RegExp(`^${esc(first.name)}`) }).first().click();
    await page.waitForURL(`${BASE}/category/${pattu.slug}/${first.id}`);
    ok(await seen(page.getByRole('heading', { level: 1, name: first.name })), `${tag} a collection from the menu opens it`);
    await page.mouse.move(10, 600); // away from the menu
  } else {
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await menu.waitFor();
    for (const c of all) ok(await menu.getByRole('link', { name: new RegExp(`^${esc(short(c))}`) }).count() >= 1, `${tag} phone menu lists ${short(c)}`);
    await shot(page, `${tag}-menu`);
    await menu.getByRole('link', { name: 'Visit the store' }).click();
    await page.waitForURL(`${BASE}/#store`);
    ok(await seen(menu, 'hidden'), `${tag} the menu closes after choosing`);
    await page.waitForTimeout(1500);
    ok(await page.evaluate(() => { const r = document.getElementById('store').getBoundingClientRect(); return r.top >= document.querySelector('.hdr').getBoundingClientRect().bottom - 1 && r.bottom <= window.innerHeight + 1; }), `${tag} menu "Visit the store" shows the store in the footer, clear of the header`);
  }

  const searchBox = page.getByRole('searchbox');
  await searchBox.fill('kalankari');
  const sug = page.locator('.suggest');
  await sug.locator('a[href^="/product/"]').first().waitFor();
  ok(await sug.locator('a[href^="/category/"]').count() > 0, `${tag} search suggests collections, typo spellings included`);
  ok(await sug.locator('a[href^="/shop?craft=kalamkari"]').count() === 1, `${tag} search suggests the craft`);
  await shot(page, `${tag}-search`);
  await page.keyboard.press('Escape');
  ok(await seen(sug, 'hidden'), `${tag} Escape closes the suggestions`);
  await searchBox.press('Enter');
  await page.waitForURL(`${BASE}/shop?q=kalankari`);
  const kal = await get('/products?q=kalankari&limit=1');
  await waitCount(page, kal.total);
  ok(await seen(page.getByRole('heading', { level: 1, name: 'Results for “kalankari”' })), `${tag} search results page (${kal.total})`);
  ok((await searchBox.inputValue()) === 'kalankari', `${tag} the search bar keeps the words`);

  /* ---------- All collections ---------- */
  await page.goto(`${BASE}/collections`);
  await page.locator('.ccols a.ctile').first().waitFor();
  ok(await page.locator('.ccols a.ctile').count() === catalog.collections.length, `${tag} all ${catalog.collections.length} collections`);
  const emb = catalog.crafts.find((c) => c.key === 'embroidery');
  await page.getByRole('group', { name: 'Filter by craft' }).getByRole('button', { name: new RegExp(`^${emb.name}`) }).click();
  await page.waitForURL(/craft=embroidery/);
  ok(await until(async () => await page.locator('.ccols a.ctile').count() === emb.collections), `${tag} craft chip: ${emb.collections} embroidery collections`);
  await noSideScroll(page, `${tag} collections`);
  await a11y(page, `${tag} collections`);
  await shot(page, `${tag}-collections`);

  /* ---------- A category: its collections; a collection: its sarees ---------- */
  await page.goto(`${BASE}/category/${pattu.slug}`);
  ok(await seen(page.getByRole('heading', { level: 1, name: pattu.name })), `${tag} category page: ${pattu.name}`);
  const mine = catalog.collections.filter((c) => c.category === pattu.slug);
  await page.locator('.ccols a.ctile').first().waitFor();
  ok(await page.locator('.ccols a.ctile').count() === mine.length, `${tag} all its ${mine.length} collections as photos`);
  ok((await page.locator('.ccols a.ctile').first().getAttribute('href')) === `/category/${pattu.slug}/${mine[0].id}`, `${tag} the most pieces first: ${mine[0].name}`);
  ok(await page.getByRole('heading', { level: 2, name: `${mine.length} collections` }).count() === 1, `${tag} "Choose a collection · ${mine.length} collections"`);
  ok(await cards(page).count() === 0, `${tag} the category page shows collections, not sarees`);
  ok((await page.locator('.cbanner .eyebrow').textContent()).includes(pattu.count.toLocaleString('en-IN')), `${tag} the banner: ${pattu.count} pieces`);
  ok(await page.getByRole('navigation', { name: 'Shop' }).locator('a[aria-current="page"]').textContent() === short(pattu), `${tag} the menu bar marks the category`);
  await noSideScroll(page, `${tag} category`);
  await a11y(page, `${tag} category`);
  await shot(page, `${tag}-category`);
  const col = mine.find((c) => c.sets > 0) || mine[0];
  await page.locator(`.ccols a.ctile[href$="${col.id}"]`).click();
  await page.waitForURL(`${BASE}/category/${pattu.slug}/${col.id}`);
  ok(await seen(page.getByRole('heading', { level: 1, name: col.name })), `${tag} a collection page: ${col.name}`);
  await waitCount(page, col.count);
  ok(true, `${tag} it lists its ${col.count} sarees`);
  ok(await page.locator('.crumbs').getByRole('link', { name: short(pattu) }).count() === 1, `${tag} its breadcrumb goes back to ${short(pattu)}`);
  if (col.sets > 0) {
    await page.getByRole('button', { name: 'Sets only' }).click();
    await page.waitForURL(/sets=1/);
    const setsN = (await get(`/products?collection=${col.id}&sets=1&limit=1`)).total;
    await waitCount(page, setsN);
    ok(await cards(page).locator('.badge.set').count() === Math.min(24, setsN), `${tag} Sets only: ${setsN}, each "Set of …"`);
    await page.getByRole('button', { name: 'Sets only' }).click();
    await waitCount(page, col.count);
  }
  if (!phone) {
    await page.getByRole('button', { name: 'Bigger photos, 3 in a row' }).click();
    ok(await page.locator('.pgrid.c3').count() === 1, `${tag} grid size: 3 in a row`);
    await page.reload();
    await cards(page).first().waitFor();
    ok(await page.locator('.pgrid.c3').count() === 1, `${tag} grid size remembered`);
    await page.getByRole('button', { name: 'Smaller photos, 4 in a row' }).click();
  }
  await noSideScroll(page, `${tag} collection`);
  await a11y(page, `${tag} collection`);
  await shot(page, `${tag}-collection`);
  for (const c of catalog.soon) {
    await page.goto(`${BASE}/category/${c.slug}`);
    ok(await seen(page.getByRole('heading', { level: 2, name: `${short(c)}: new pieces coming soon` })), `${tag} ${short(c)}: coming soon`);
    ok(await page.locator('.soon-box .chip').count() === c.upcoming.length, `${tag} it names the ${c.upcoming.length} collections on the way`);
    ok((await page.getByRole('link', { name: 'Ask on WhatsApp' }).getAttribute('href')).startsWith(`https://wa.me/${home.store.whatsapp}?text=`), `${tag} it asks on WhatsApp`);
  }
  if (catalog.soon.length) { await a11y(page, `${tag} coming soon`); await shot(page, `${tag}-coming-soon`); }

  /* ---------- Filters (left on computers; the bar at the bottom of phones) ---------- */
  const cat = pattu;
  await page.goto(`${BASE}/shop?category=${cat.slug}`);
  await waitCount(page, cat.count);
  const embCat = await get(`/products?category=${cat.slug}&craft=embroidery&limit=1`);
  const bothCat = await get(`/products?category=${cat.slug}&craft=embroidery&price=u25&limit=1`);
  if (!phone) {
    // The router changes the address as a transition: the box shows ticked a moment later.
    await page.locator('aside.filters').getByLabel(/^Embroidery/).click();
    await page.waitForURL(/craft=embroidery/);
    await waitCount(page, embCat.total);
    ok(await shown(page), `${tag} craft filter: ${embCat.total}, new cards show`);
    await page.locator('aside.filters').getByLabel(/^Under ₹2,500/).click();
    await waitCount(page, bothCat.total);
    ok(page.url().includes('price=u25') && await shown(page), `${tag} price filter: ${bothCat.total}, new cards show`);
    ok(await page.locator('.active-filters .chip').count() === 3, `${tag} chosen filters shown as chips, with "Clear all"`);
    await shot(page, `${tag}-filtered`);
    await page.getByRole('button', { name: /Remove filter: Under/ }).click();
    await waitCount(page, embCat.total);
    ok(!page.url().includes('price='), `${tag} removing a chip removes the filter`);
  } else {
    const opener = page.getByRole('button', { name: /^Filter/ });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await drawer.getByLabel(/^Embroidery/).click();
    await page.waitForURL(/craft=embroidery/);
    await drawer.getByLabel(/^Under ₹2,500/).click();
    await drawer.getByRole('button', { name: `Show ${bothCat.total.toLocaleString('en-IN')} sarees` }).waitFor();
    await shot(page, `${tag}-filters-sheet`);
    await drawer.getByRole('button', { name: /^Show/ }).click();
    ok(await seen(drawer, 'hidden'), `${tag} the filter sheet closes with "Show ${bothCat.total} sarees"`);
    await waitCount(page, bothCat.total);
    ok(/craft=embroidery/.test(page.url()) && /price=u25/.test(page.url()) && await shown(page), `${tag} sheet filters are in the address; new cards show`);
    if (ENGINE === 'chromium') ok(await page.evaluate(() => document.activeElement?.textContent.startsWith('Filter')), `${tag} focus returns to the Filter button`);
    await opener.click();
    await page.keyboard.press('Escape');
    ok(await seen(drawer, 'hidden'), `${tag} Escape closes the sheet`);
  }
  await page.goto(`${BASE}/shop?q=zzzqqq`);
  await page.getByRole('heading', { name: 'Nothing found for “zzzqqq”' }).waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await waitCount(page, catalog.totals.sarees);
  ok(true, `${tag} nothing found, then "Clear filters" shows everything`);
  await page.goto(`${BASE}/shop?craft=nonsense&price=bad&sort=bad&page=x&collection=nope`);
  await waitCount(page, catalog.totals.sarees);
  ok(await page.locator('.active-filters .chip').count() === 0, `${tag} junk in the address is ignored`);

  /* ---------- Add to bag from a card (a visitor's bag: kept in this browser only) ---------- */
  await page.goto(`${BASE}/shop`);
  const card0 = cards(page).first();
  await card0.waitFor();
  await card0.getByRole('button', { name: /^Add to bag/ }).click();
  const panel = page.getByRole('dialog', { name: 'Added to your bag' });
  ok(await seen(panel), `${tag} "Add to bag" on a card opens the bag with it`);
  ok((await page.locator('.hdr .bag-n').textContent()) === '1', `${tag} the bag shows 1`);
  await page.keyboard.press('Escape');
  ok(await seen(card0.getByRole('button', { name: /^In your bag/ })), `${tag} the card now says "In your bag"`);
  await page.evaluate(() => localStorage.removeItem('nh-bag-v1'));

  /* ---------- Lists: sort, grid size, load more, back ---------- */
  await page.goto(`${BASE}/shop?sort=price-asc`);
  await cards(page).nth(5).waitFor();
  const prices = await cards(page).locator('.price').allTextContents();
  const nums = prices.map((t) => Number(t.replace(/[^\d]/g, '')));
  ok(nums.every((v, i) => i === 0 || v >= nums[i - 1]), `${tag} sort: price low to high`);
  if (phone) {
    await page.getByRole('button', { name: /^Sort:/ }).click();
    await page.getByRole('dialog', { name: 'Sort by' }).getByLabel('Price: high to low').click();
  } else {
    await page.locator('#sort').selectOption('price-desc');
  }
  await page.waitForURL(/sort=price-desc/);
  await until(async () => Number((await cards(page).first().locator('.price').textContent()).replace(/[^\d]/g, '')) >= nums[nums.length - 1]);
  ok(await shown(page), `${tag} sort changed on the page: new order shows`);
  await page.goto(`${BASE}/shop`);
  await cards(page).nth(23).waitFor();
  ok(await cards(page).count() === 24, `${tag} first 24 sarees`);
  await page.getByRole('button', { name: 'Load more' }).click();
  await cards(page).nth(47).waitFor();
  ok(await cards(page).count() === 48 && page.url().includes('page=2'), `${tag} "Load more" adds 24 (page=2 in the address)`);
  await cards(page).nth(36).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const y = await page.evaluate(() => window.scrollY);
  const target = await cards(page).nth(36).locator('a.name').getAttribute('href');
  // A plain click where the link is, like a person: Playwright's own click first scrolls the
  // link into view, and with the site's smooth scrolling that moves the list before it leaves.
  const box = await cards(page).nth(36).locator('a.name').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForURL(`${BASE}${target}`);
  await page.locator('.buy h1').waitFor();
  ok(near(await page.evaluate(() => window.scrollY), 0, 2), `${tag} a saree page opens at the top`);
  await page.goBack();
  await page.waitForTimeout(1200);
  ok(await cards(page).count() === 48, `${tag} Back: all 48 still there`);
  const back = await page.evaluate(() => window.scrollY);
  ok(near(back, y, 80), `${tag} Back: the same place in the list (${y} → ${back})`);

  /* ---------- Saree page ---------- */
  const one = home.spotlight.products[0];
  const full = await get(`/products/${one.slug}`);
  const detail = full.product;
  await page.goto(`${BASE}/product/${one.slug}`);
  await page.locator('.buy h1').waitFor();
  ok((await page.locator('.buy h1').textContent()) === detail.name, `${tag} saree: name`);
  ok((await page.locator('.pricebox .price').textContent()) === rs(detail.price), `${tag} saree: price ${rs(detail.price)}, no MRP`);
  ok(!(await page.locator('.buy').textContent()).includes('16,999'), `${tag} the MRP placeholder never shows`);
  ok((await page.locator('.buy .meta').textContent()).includes(detail.sku), `${tag} saree: code ${detail.sku}`);
  // W5: "Add to bag" leads; "Order on WhatsApp" (this saree only) is under it.
  const wa = await page.locator('.buy-row a[href^="https://wa.me/"]').getAttribute('href');
  const text = decodeURIComponent(wa.split('?text=')[1]);
  ok(wa.startsWith(`https://wa.me/${home.store.whatsapp}?text=`) && text.includes(detail.sku) && text.includes(rs(detail.price)) && text.includes(`/product/${detail.slug}`), `${tag} "Order on WhatsApp" fills in the name, code, price and link`);
  ok((await page.locator('.buy .call-line a[href^="tel:"]').getAttribute('href')) === `tel:+91${home.store.phone}`, `${tag} "Questions? Call" link`);
  // "Share": the saree's name and price and the link, no shop name (client, 23 Oct 2026).
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared = d; } }); });
  await page.locator('.share button').click();
  const shared = await page.waitForFunction(() => window.__shared).then((h) => h.jsonValue());
  ok(shared.title === detail.name && shared.text === `${detail.name}, ${rs(detail.price)}` && shared.url.endsWith(`/product/${detail.slug}`)
    && !/nandam/i.test(`${shared.title} ${shared.text}`), `${tag} "Share" sends the name, price and link, no shop name ("${shared.text}")`);
  ok(await page.locator('.stockline').isVisible(), `${tag} stock line: ${(await page.locator('.stockline').textContent()).trim()}`);
  const prodLd = await ldOf(page, 'Product');
  ok(prodLd?.sku === detail.sku && prodLd.offers.price === String(detail.price) && prodLd.offers.priceCurrency === 'INR', `${tag} saree details for search engines`);
  ok((await page.locator('meta[name="description"]').getAttribute('content')).includes(detail.sku), `${tag} page description names the saree`);
  await noSideScroll(page, `${tag} saree`);
  await a11y(page, `${tag} saree`);
  await shot(page, `${tag}-saree`);
  const stage = page.locator('.gallery .stage').first();
  await stage.click();
  const lb = page.locator('.lightbox');
  await lb.waitFor();
  await page.waitForTimeout(450); // its fade-in
  ok(await lb.locator('img').isVisible(), `${tag} photo opens full screen`);
  await shot(page, `${tag}-saree-photo`);
  await page.keyboard.press('Escape');
  ok(await seen(lb, 'hidden'), `${tag} Escape closes the photo`);
  // Safari doesn't focus a button on click, so there is nothing to return to there.
  if (ENGINE === 'chromium') ok(await stage.evaluate((el) => el === document.activeElement), `${tag} focus returns to the photo`);
  const acc = page.locator('.acc details').nth(1);
  await acc.locator('summary').click();
  ok(await acc.evaluate((d) => d.open), `${tag} "Ordering and delivery" opens`);
  ok(await page.getByRole('heading', { name: 'More from this collection' }).count() === (full.more.length ? 1 : 0)
    && await page.getByRole('heading', { name: 'You may also like' }).count() === (full.similar.length ? 1 : 0), `${tag} more from this collection (${full.more.length}) and similar (${full.similar.length})`);
  if (phone) {
    await page.evaluate(() => window.scrollBy(0, document.querySelector('.buy-row').getBoundingClientRect().bottom + 120));
    await page.waitForTimeout(500);
    ok(await seen(page.locator('.buybar.on')), `${tag} the order bar stays at the bottom while scrolling`);
    await shot(page, `${tag}-saree-bar`);
  }
  const nextSlug = (await page.locator('section[aria-labelledby="h-more"] .pcard a.name, section[aria-labelledby="h-similar"] .pcard a.name').first().getAttribute('href')).split('/').pop();
  await page.goto(`${BASE}/product/${nextSlug}`);
  await page.locator('.buy h1').waitFor();
  const recent = page.locator('section[aria-labelledby="h-recent"]');
  ok(await seen(recent.locator(`a[href="/product/${one.slug}"]`).first()), `${tag} "Recently viewed" shows the saree seen before`);

  if (fixtures.soldSlug) {
    await page.goto(`${BASE}/product/${fixtures.soldSlug}`);
    await page.locator('.stockline.out').waitFor();
    ok(await seen(page.getByRole('link', { name: 'Ask for a similar saree' })), `${tag} sold-out saree: marked, and asks for a similar one`);
    await shot(page, `${tag}-saree-sold`);
  }
  await page.goto(`${BASE}/product/not-a-real-saree`);
  ok(await seen(page.getByRole('heading', { name: 'This saree isn\'t on the website now' })), `${tag} a missing saree: a helpful page`);
  await page.goto(`${BASE}/category/not-a-category`);
  ok(await seen(page.getByRole('heading', { name: 'This category isn\'t on the website now' })), `${tag} a missing category: a helpful page`);
  await page.goto(`${BASE}/category/${cat.slug}/00000000-0000-4000-8000-000000000000`);
  ok(await seen(page.getByRole('heading', { name: 'This collection isn\'t on the website now' })), `${tag} a missing collection: a helpful page`);

  /* ---------- Old addresses ---------- */
  for (const [from, to] of [['/login', '/sign-in'], ['/register', '/sign-in'], ['/forgot-password', '/sign-in'], ['/cart', '/bag'], ['/checkout', '/checkout'], ['/account/orders', '/sign-in']]) { // /checkout: the real checkout since W6
    await page.goto(`${BASE}${from}`);
    await page.waitForURL((u) => u.pathname === to);
    ok(await seen(page.locator('h1')), `${tag} old address ${from} → ${to}`);
  }
  await page.goto(`${BASE}/nope`);
  ok(await seen(page.getByRole('heading', { name: 'We couldn\'t find that page' })), `${tag} unknown address: not found page`);
  await ctx.close();
}

// Visitors who turned on "reduce motion": nothing moves or plays by itself; everything shows.
async function reduced(browser) {
  console.log('\n=== Reduce motion ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`reduce motion page error: ${e.message}`));
  await page.goto(BASE);
  await cards(page).nth(7).waitFor();
  await page.waitForTimeout(300);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.reveal')].filter((el) => {
    const s = getComputedStyle(el);
    return Number(s.opacity) < 0.99 || (s.transform !== 'none' && s.transform !== 'matrix(1, 0, 0, 1, 0, 0)');
  }).length);
  ok(hidden === 0, `reduce motion: all cards and tiles show at once (${hidden} hidden)`);
  await shot(page, 'reduce-motion-home');
  await ctx.close();
}
(async () => {
  const engine = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
  const browser = engine === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  const rounds = (process.env.NH_ROUNDS || '1440-light,390-dark,390-light,1440-dark').split(',').map((r) => r.split('-'));
  console.log(`Browser engine: ${engine}`);
  const started = Date.now();
  try {
    const fixtures = { home: await get('/home'), catalog: await get('/catalog') };
    // A saree that is listed but has nothing left in stock (read only).
    fixtures.soldSlug = sql(`select p.slug from "Product" p join "Subcategory" s on s.id = p."subcategoryId" join "Category" c on c.id = p."categoryId"
      where p."isActive" and p."deletedAt" is null and p."channelVisibility" in ('online_only', 'both') and s."isActive" and c."isActive" and s.status = 'active' and c.status = 'active'
      and s."onlinePrice" >= 500 and p.stock = 0 and exists (select 1 from "ProductImage" i where i."productId" = p.id)
      and not exists (select 1 from "Piece" x where x."productId" = p.id and x.status = 'in_stock') order by p.slug limit 1`) || null;
    // The database may be a copy older than the site being tested: use it only if the site agrees.
    if (fixtures.soldSlug && !(await get(`/products/${fixtures.soldSlug}`)).product?.soldOut) fixtures.soldSlug = null;
    for (const [w, mode] of rounds) await run(browser, Number(w), mode, fixtures);
    if (!process.env.NH_ROUNDS) await reduced(browser);
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
