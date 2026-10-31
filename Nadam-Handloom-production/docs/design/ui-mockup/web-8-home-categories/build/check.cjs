/* Real-browser check of the home page mock-up (no carousel, categories first).
   With the mock-up folder served (python3 -m http.server 8765 --bind 127.0.0.1 in docs/design/ui-mockup):
     NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-8-home-categories/build/check.cjs
   NH_ENGINE=webkit WEBKIT_PATH=...  the same in Safari's engine.  SHOTS=1  also saves the "after"
   pictures for the start page (img/after-*.jpg). */
const { chromium, webkit } = require('playwright-core');
const path = require('node:path');

const BASE = process.env.NH_MOCK || 'http://127.0.0.1:8765/web-8-home-categories';
const ENGINE = process.env.NH_ENGINE === 'webkit' ? 'webkit' : 'chromium';
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const KEY = 'w8mock.opts.v1';
const fails = [];
let passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log(`  ok   ${m}`); } else { fails.push(m); console.log(`  FAIL ${m}`); } };
const seen = (loc, state = 'visible', timeout = 6000) => loc.waitFor({ state, timeout }).then(() => true, () => false);

async function context(browser, w, mode, opts, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, colorScheme: mode, hasTouch: w < 600, ...extra });
  await ctx.addInitScript(([k, o]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(o)); sessionStorage.setItem('seeded', '1'); } }, [KEY, opts]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  return { ctx, page };
}

async function a11y(page, tag) {
  const r = await page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().length > 0;
    return {
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
      noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      unnamed: [...document.querySelectorAll('button, a[href]')].filter((b) => visible(b) && !named(b)).map((b) => b.outerHTML.slice(0, 80)),
      ids: (() => { const all = [...document.querySelectorAll('[id]')].map((e) => e.id); return all.filter((x, i) => all.indexOf(x) !== i); })(),
    };
  });
  ok(r.h1.length === 1, `${tag}: one main heading (${r.h1.join(' | ')})`);
  ok(!r.noAlt, `${tag}: every picture has alt text`);
  ok(!r.unnamed.length, `${tag}: every button and link has a name ${r.unnamed.join(' | ')}`);
  ok(!r.ids.length, `${tag}: no repeated ids ${r.ids.join(' ')}`);
}

async function home(browser, top, w, mode) {
  const tag = `${ENGINE} ${top.toUpperCase()} ${w}-${mode}`;
  console.log(`\n=== ${tag} ===`);
  const { ctx, page } = await context(browser, w, mode, { top, theme: mode, entrance: 'a', after: 'a' });
  await page.goto(`${BASE}/site.html`);
  await page.locator('#h-shop').waitFor();
  await page.waitForTimeout(1200);
  if (process.env.SHOTS && mode === 'light') { // the start page's "after" pictures: the first screen, without the mock-up controls
    await page.addStyleTag({ content: '.mo-fab, .mock-strip { display: none !important; }' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, '..', 'img', `after-${top}-${w < 600 ? 'phone' : 'laptop'}.jpg`), type: 'jpeg', quality: 78 });
    await page.evaluate(() => document.head.lastElementChild.remove());
  }
  ok(await page.locator('.lux-hero, .hero-carousel, .intro').count() === 0, `${tag}: no carousel, no entrance`);
  ok(await page.locator('#h-collections').count() === 0, `${tag}: the old four-tile block is gone`);
  const hdr = await page.locator('header.hdr').evaluate((h) => ({ bg: getComputedStyle(h).backgroundColor, pos: getComputedStyle(h).position }));
  ok(hdr.pos === 'sticky' && !/rgba\(0, 0, 0, 0\)|transparent/.test(hdr.bg), `${tag}: the header is solid and stays at the top (${hdr.pos})`);
  const first = await page.evaluate(() => { const h = document.querySelector('#h-shop').getBoundingClientRect(); return { top: Math.round(h.top) }; });
  ok(first.top < 320, `${tag}: "Shop by category" right under the header (${first.top}px from the top)`);
  const names = await page.evaluate((t) => [...document.querySelectorAll(t === 'a' ? '.hc-tile .cap b' : t === 'b' ? '.hc-circles.cats .hc-circle b' : '.hc-band h2')].map((b) => b.textContent.trim()), top);
  ok(names.join('|') === 'Mangalagiri pattu sarees|Pattu dress materials|Pattu lehanga sets|Handloom cotton sarees', `${tag}: the four categories, largest first`);
  if (top !== 'c') {
    const inView = await page.evaluate((t) => { const el = document.querySelector(t === 'a' ? '.hc-tile' : '.hc-circles.cats .hc-circle'); const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight * 0.75; }, top);
    ok(inView, `${tag}: the first category is on the first screen`);
  } else {
    ok(await page.evaluate(() => document.querySelector('.hc-band').getBoundingClientRect().top < window.innerHeight), `${tag}: the first category band starts on the first screen`);
  }
  const side = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(side <= 1, `${tag}: no sideways scrolling (${side}px)`);
  // Photos of the new part load (scrolled into view first: they load lazily).
  await page.locator('.hc').evaluate((el) => el.scrollIntoView());
  for (let y = 0; y < 2400; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  const broken = await page.evaluate(() => [...document.querySelectorAll('.hc img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
  ok(!broken.length, `${tag}: every photo of the new part loads ${broken.join(' ')}`);
  const order = await page.evaluate(() => [...document.querySelectorAll('main > div > section, main > div > div.statement')].map((s) => s.getAttribute('aria-labelledby') || s.getAttribute('aria-label') || s.className));
  ok(order[0] === 'h-shop' && order[1] === 'Our story' && order[2] === 'h-new' && order.includes('h-store'), `${tag}: then today's home page (${order.slice(1, 5).join(', ')}…)`);
  await a11y(page, tag);

  // A category opens its page on the website: the mock-up says so and stays.
  await page.evaluate(() => window.scrollTo(0, 0));
  const url = page.url();
  await page.locator(top === 'a' ? '.hc-tile' : top === 'b' ? '.hc-circles.cats .hc-circle' : '.hc-lead').first().click();
  ok(await seen(page.locator('.toast').filter({ hasText: 'that category' })) && page.url() === url, `${tag}: a category says where it goes`);
  // The menu: opens, shows the new number once, Escape closes and gives focus back.
  await page.locator('.hdr .menu-btn').click();
  const menu = page.locator('.fullmenu');
  ok(await seen(menu), `${tag}: the menu opens`);
  const contact = (await menu.locator('.meta').innerText()).replace(/\s+/g, ' ');
  ok(/\+91 73823 88565/.test(contact) && (contact.match(/73823 88565/g) || []).length === 1 && !/73829|94941/.test(contact), `${tag}: the menu shows the new number once`);
  await page.keyboard.press('Escape');
  ok(await seen(menu, 'detached') && await page.evaluate(() => document.activeElement?.classList.contains('menu-btn')), `${tag}: Escape closes the menu, focus back on Menu`);
  ok(!(await page.content()).match(/7382968566|73829 68566|9494170180|94941 70180/), `${tag}: no old shop number anywhere`);
  if (top === 'c' && w >= 900) {
    const rail = page.locator('.hc-band .rail').first();
    const before = await rail.evaluate((r) => r.scrollLeft);
    await page.locator('.hc-band .rail-nav button').nth(1).click();
    await page.waitForTimeout(900);
    ok((await rail.evaluate((r) => r.scrollLeft)) > before, `${tag}: the arrows slide a category's collections`);
  }
  ok(!page.errors.length, `${tag}: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();
}

async function extras(browser) {
  console.log(`\n=== ${ENGINE} states, options, other pages ===`);
  let { ctx, page } = await context(browser, 1440, 'light', { top: 'a', theme: 'light', entrance: 'a', after: 'b' });
  await page.goto(`${BASE}/site.html?state=loading`);
  ok(await page.locator('.hc-tiles[aria-busy="true"] .skel').count() === 4, 'loading: four placeholder tiles');
  await page.goto(`${BASE}/site.html?state=error`);
  ok(await seen(page.getByRole('alert').filter({ hasText: 'We couldn\'t load the categories' })), 'couldn\'t load: says so');
  await page.getByRole('button', { name: 'Try again' }).click();
  ok(await seen(page.locator('.hc-tile').first()) && !page.url().includes('state='), 'Try again: the categories come');
  const order = await page.evaluate(() => [...document.querySelectorAll('main > div > section')].map((s) => s.getAttribute('aria-labelledby') || s.getAttribute('aria-label')));
  ok(order[1] === 'h-new' && order[2] === 'Our story', `after the categories B: New this week first (${order.slice(1, 3).join(', ')})`);
  await page.locator('.ftr-theme button', { hasText: 'Dark' }).click();
  ok((await page.locator('html').getAttribute('data-mode')) === 'dark', 'the footer\'s Dark switches the theme');
  // The Design options panel.
  await page.locator('.mo-fab').click();
  await page.locator('.mo-panel [data-mo-k="top"][data-mo-v="b"]').click();
  ok(await seen(page.locator('.hc-b')), 'Design options: top B shows at once');
  const text = await page.evaluate(() => window.W8Opts.choicesText());
  ok(/1\. Top of the home page \(no carousel\): B Round photos/.test(text) && /3\. Right after the categories: B/.test(text), 'Copy my choices: the picks as text');
  ok(!page.errors.length, `options: no page errors ${page.errors.join(' | ')}`);
  await ctx.close();

  // The entrance kept (B): it plays once, then goes.
  ({ ctx, page } = await context(browser, 1440, 'light', { top: 'a', entrance: 'b' }));
  await page.goto(`${BASE}/site.html`);
  ok(await seen(page.locator('.intro'), 'attached', 1500), 'entrance kept: the logo plays');
  ok(await seen(page.locator('.intro'), 'detached', 4500), '... and goes after about 3 seconds');
  await ctx.close();

  // Reduce motion: everything shows at once, nothing moves.
  ({ ctx, page } = await context(browser, 1440, 'light', { top: 'b' }, { reducedMotion: 'reduce' }));
  await page.goto(`${BASE}/site.html`);
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => [...document.querySelectorAll('.hc .reveal')].every((el) => el.classList.contains('in'))), 'reduce motion: the new part shows at once');
  await ctx.close();

  for (const [file, h1] of [['index.html', 'Categories first, no carousel'], ['kit.html', 'The new top of the home page'], ['preview.html', 'The home page on a phone, a tablet and a laptop']]) {
    ({ ctx, page } = await context(browser, 1440, 'light', { top: 'a' }));
    await page.goto(`${BASE}/${file}`);
    await page.waitForTimeout(900);
    ok((await page.locator('h1').allTextContents()).map((t) => t.trim()).join('|') === h1, `${file}: opens ("${h1}")`);
    if (file === 'preview.html') ok(await page.locator('iframe').count() === 2, 'preview: phone and laptop side by side');
    if (file === 'index.html') ok(await page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)), 'start page: before and after pictures load');
    const side = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(side <= 1, `${file}: no sideways scrolling`);
    ok(!page.errors.length, `${file}: no page errors ${page.errors.join(' | ')}`);
    await ctx.close();
  }
  ({ ctx, page } = await context(browser, 390, 'light', { top: 'a' }));
  await page.goto(`${BASE}/index.html`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), 'start page on a phone: no sideways scrolling');
  await ctx.close();
}

(async () => {
  const browser = ENGINE === 'webkit' ? await webkit.launch(process.env.WEBKIT_PATH ? { executablePath: process.env.WEBKIT_PATH } : {}) : await chromium.launch({ executablePath: EXE });
  const started = Date.now();
  try {
    for (const top of ['a', 'b', 'c']) for (const [w, mode] of [[1440, 'light'], [390, 'light'], [390, 'dark'], [820, 'dark']]) await home(browser, top, w, mode);
    await extras(browser);
  } catch (e) {
    fails.push(`crashed: ${e.message.split('\n')[0]}`); console.error(e);
  } finally { await browser.close(); }
  console.log(`\n${passed} checks passed, ${fails.length} failed, ${Math.round((Date.now() - started) / 1000)} s`);
  if (fails.length) { console.log(fails.map((f) => ` - ${f}`).join('\n')); process.exit(1); }
})();
