/* Real-browser check of the home page mock-up (27 Oct 2026: the 6 categories as cards, 3 in a row,
   like the saree cards). Serve docs/design/ui-mockup on 8765, then:
     NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-11-home-category-cards/build/check-home.cjs
   SHOTS=1 also makes the start page pictures (img/look-*.jpg).
   NH_ENGINE=webkit WEBKIT_PATH=… for Safari's engine. */
const { chromium, webkit } = require('playwright-core');
const path = require('node:path');

const BASE = process.env.NH_MOCK || 'http://127.0.0.1:8765/web-11-home-category-cards';
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const IMG = path.join(__dirname, '..', 'img');
const CARD = '.ccards > :not(.sk)';
let passed = 0;
const fails = [];
const ok = (c, m) => { if (c) { passed += 1; console.log(`  ok   ${m}`); } else { fails.push(m); console.log(`  FAIL ${m}`); } };

async function page(browser, width, mode, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: mode, reducedMotion: 'reduce', isMobile: width < 600 && browser.browserType().name() === 'chromium', hasTouch: width < 600 });
  // Choices start clean for each round, then the round's own.
  await ctx.addInitScript((o) => { try { localStorage.setItem('w11mock.opts.v1', JSON.stringify(o)); } catch (e) { /* none */ } }, opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, p, errors };
}
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const layout = (p) => p.evaluate((CARD) => {
  const cards = [...document.querySelectorAll(CARD)];
  const tops = [...new Set(cards.map((c) => c.offsetTop))]; // offsetTop: not moved by the fade-in
  const cols = getComputedStyle(document.querySelector('.ccards')).gridTemplateColumns.split(' ').length;
  const imgs = cards.map((c) => c.querySelector('img'));
  const shape = (el) => { if (!el) return 0; const r = el.getBoundingClientRect(); return r.height / r.width; };
  return {
    n: cards.length, cols, rows: tops.length,
    // Only the photo and the name: one picture, the name as the only words, nothing else on the card.
    only: cards.filter((c) => c.tagName === 'A' && /^#\/c\//.test(c.getAttribute('href')) && c.querySelectorAll('img').length === 1 && !c.querySelector('.btn, button, .badge, .price, small, .col')).length,
    texts: cards.map((c) => c.textContent.trim()),
    loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length, srcs: imgs.map((i) => i.getAttribute('src')),
    ratio: shape(cards[0].querySelector('.ph')), sareeRatio: shape(document.querySelector('.grid .card .ph')),
    crafts: document.querySelectorAll('.craft-strip .cs').length, latest: document.querySelectorAll('.latest a.ctile').length,
    allSarees: !!document.querySelector('.list-head h1'), h1: document.querySelectorAll('h1').length,
    firstCardTop: cards[0].offsetTop, secBottom: Math.round(document.querySelector('.cat-sec').getBoundingClientRect().bottom + window.scrollY),
  };
}, CARD);

async function round(browser, width, mode) {
  const tag = `${width}-${mode}`;
  console.log(`\n=== ${tag} ===`);
  const phone = width < 641;
  for (const [style, catcols] of [['a', 'a'], ['a', 'b'], ['b', 'a']]) {
    const { ctx, p, errors } = await page(browser, width, mode, { catcard: style, catcols, theme: mode });
    await p.goto(`${BASE}/site.html#/`);
    await p.locator(CARD).first().waitFor();
    await p.waitForFunction(() => [...document.querySelectorAll('.ccards img')].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
    const L = await layout(p);
    const want = phone ? 2 : catcols === 'b' && width > 1100 ? 6 : 3;
    const t = `${tag} cards ${style.toUpperCase()}, laptop ${catcols.toUpperCase()}`;
    ok(L.n === 6, `${t}: all 6 categories as cards (${L.n})`);
    ok(L.cols === want, `${t}: ${want} in a row (${L.cols})`);
    ok(L.rows === 6 / want, `${t}: ${6 / want} rows (${L.rows})`);
    ok(L.only === 6, `${t}: each card is only the photo and the name, and the whole card is the link (${L.only}/6)`);
    ok(L.texts.join('|') === 'Pattu sarees|Pattu dress materials|Lehanga sets|Cotton sarees|Cotton dress materials|Fabrics', `${t}: the words on the cards are just the names (${L.texts.join(', ')})`);
    ok(L.loaded === 6, `${t}: every card photo loads (${L.loaded}/6)`);
    if (style === 'a') {
      ok(Math.abs(L.ratio - L.sareeRatio) < 0.01 && Math.abs(L.ratio - 4 / 3) < 0.01, `${t}: the same tall photo as the saree cards (${L.ratio.toFixed(3)} vs ${L.sareeRatio.toFixed(3)})`);
    } else ok(L.ratio < 1, `${t}: a wide photo (${L.ratio.toFixed(2)})`);
    ok(L.latest >= 6 && L.allSarees, `${t}: the latest collections and every saree still follow`);
    ok(L.crafts >= 6, `${t}: the crafts row under the cards (${L.crafts})`);
    ok(L.h1 === 1, `${t}: one main heading (${L.h1})`);
    ok((await sideways(p)) <= 1, `${t}: no sideways scrolling`);
    if (style === 'a' && catcols === 'a') {
      ok(L.firstCardTop < (phone ? 400 : 360), `${t}: the cards start near the top of the page (${L.firstCardTop}px)`);
      await p.locator(`${CARD} .ph`).first().click();
      await p.waitForURL(/#\/c\/mangalagiri-handloom-pattu-sarees$/);
      ok(await p.locator('h1', { hasText: 'Mangalagiri Handloom Pattu Sarees' }).waitFor().then(() => true, () => false), `${t}: the photo opens the category page`);
      ok(await p.locator('.ccols a.ctile').count() >= 20, `${t}: the category page lists its subcategories (${await p.locator('.ccols a.ctile').count()})`);
      await p.goBack();
      await p.locator(CARD).first().waitFor();
      await p.locator(`${CARD} .nm`).nth(1).click();
      await p.waitForURL(/#\/c\/handloom-pattu-dress-material$/);
      ok(true, `${t}: the name opens the category page too`);
      await p.goBack();
      await p.locator(CARD).nth(4).waitFor();
      await p.locator(CARD).nth(4).click();
      await p.waitForURL(/#\/c\/handloom-cotton-dress-material$/);
      ok(await p.getByText('new pieces coming soon').first().waitFor().then(() => true, () => false), `${t}: a category without sarees opens its coming-soon page`);
    }
    const shot = process.env.SHOTS && mode === 'light' && (width === 1440 || width === 390) && !(phone && catcols === 'b');
    if (shot) {
      await p.goto(`${BASE}/site.html#/`);
      await p.locator(CARD).first().waitFor();
      await p.waitForFunction(() => [...document.querySelectorAll('.ccards img')].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
      await p.addStyleTag({ content: '.mo-fab,.wa-fab,.mob-bar{display:none!important}' }); // floating bits would sit mid-picture
      await p.mouse.move(1, 1); // no hover colour left from the clicks
      const { secBottom } = await layout(p);
      const name = `look-${style}${catcols === 'b' ? '6' : ''}-${phone ? 'phone' : 'laptop'}.jpg`;
      await p.screenshot({ path: path.join(IMG, name), type: 'jpeg', quality: 76, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(secBottom + 16, phone ? 1500 : 1900) } });
    }
    ok(!errors.length, `${t}: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  // Choice 4 B: the newest saree's photo (the 2 coming soon keep the admin app photo).
  {
    const { ctx, p, errors } = await page(browser, width, mode, { catphoto: 'b', theme: mode });
    await p.goto(`${BASE}/site.html#/`);
    await p.locator(CARD).first().waitFor();
    const L = await layout(p);
    ok(L.srcs.slice(0, 4).every((s) => /\/products\//.test(s)) && L.srcs.slice(4).every((s) => /img\/c\/admin-/.test(s)), `${tag} photos B: the newest saree on 4 cards, the admin photo on the 2 coming soon`);
    ok(!errors.length, `${tag} photos B: no page errors ${errors.join(' | ')}`);
    await ctx.close();
  }
  // No crafts row (choice 3 B); loading and error states.
  const { ctx, p, errors } = await page(browser, width, mode, { crafts: 'b', theme: mode });
  await p.goto(`${BASE}/site.html#/`);
  await p.locator(CARD).first().waitFor();
  const L = await layout(p);
  ok(L.srcs.every((s) => /img\/c\/admin-/.test(s)), `${tag} photos A: every card shows the admin app photo`);
  ok(await p.locator('.craft-strip').count() === 0, `${tag} choice 3 B: no crafts row`);
  await p.goto(`${BASE}/site.html#/?state=loading`);
  await p.locator('.ccards .sk').first().waitFor();
  ok(await p.locator('.ccards .sk').count() === 6, `${tag} loading: 6 card placeholders`);
  await p.goto(`${BASE}/site.html#/?state=error`);
  await p.getByText('We couldn\'t load the sarees').waitFor();
  ok(await p.locator('.ccards').count() === 0, `${tag} couldn't load: the error message, no cards`);
  ok(!errors.length, `${tag} states: no page errors ${errors.join(' | ')}`);
  await ctx.close();
}

(async () => {
  const engine = process.env.NH_ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(process.env.NH_ENGINE === 'webkit' ? (process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : { executablePath: EXE });
  try {
    for (const [w, m] of [[1440, 'light'], [390, 'light'], [390, 'dark'], [820, 'light'], [1440, 'dark']]) await round(browser, w, m);
    console.log('\n=== mock-up pages ===');
    for (const pg of ['index.html', 'kit.html', 'preview.html']) {
      for (const w of [1440, 390]) {
        const { ctx, p, errors } = await page(browser, w, 'light');
        await p.goto(`${BASE}/${pg}`, { waitUntil: 'domcontentloaded' }); // preview.html's frames load every saree photo
        await p.waitForTimeout(1500);
        ok((await sideways(p)) <= 1 && !errors.length, `${pg} at ${w}: opens, no sideways scrolling, no errors ${errors.join(' | ')}`);
        if (pg === 'kit.html') ok(await p.locator(CARD).count() === 6, `kit.html at ${w}: the category cards are in the kit`);
        if (pg === 'index.html') ok(await p.evaluate(() => [...document.images].filter((i) => /look-/.test(i.src)).every((i) => i.complete && i.naturalWidth > 0)), `index.html at ${w}: every picture of the looks loads`);
        await ctx.close();
      }
    }
    // Design options: the new choices are in the panel.
    const { ctx, p } = await page(browser, 1440, 'light');
    await p.goto(`${BASE}/site.html#/`);
    await p.locator('.mo-fab').click();
    const panel = await p.locator('.mo-panel').innerText();
    ok(/1\. The category cards/.test(panel) && /2\. On laptops/.test(panel) && /3\. Under the cards/.test(panel) && /4\. The card photos/.test(panel), 'Design options lists the 4 choices');
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
})();
