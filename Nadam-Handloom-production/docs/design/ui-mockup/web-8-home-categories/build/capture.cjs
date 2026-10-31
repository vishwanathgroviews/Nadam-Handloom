/* Captures the live home page as visitors get it (read only): the top bar, header, every home
   section, the footer and the full-screen menu, plus the live data (/home, /catalog).
   Run from docs/design/ui-mockup:
     NODE_PATH=../../../Nadam-frontend/customer-web/node_modules node web-8-home-categories/build/capture.cjs */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const SITE = process.env.NH_SITE || 'https://nandamhandlooms.com';
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const OUT = path.join(__dirname, 'captured.json');

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })).newPage();
  await page.goto(SITE);
  await page.locator('.edit-grid .tile').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3500); // the entrance plays on the first visit
  for (let y = 0; y < 30000; y += 500) { // every section once, so lazy parts fill in
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const parts = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('#main');
    const wrap = main.firstElementChild;
    const sections = [...wrap.children].filter((el) => el.tagName !== 'SCRIPT').map((el) => ({ cls: el.className, label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '', html: el.outerHTML }));
    const pick = (sel) => document.querySelector(sel)?.outerHTML || null;
    return {
      htmlAttrs: Object.fromEntries([...document.documentElement.attributes].map((a) => [a.name, a.value])),
      layoutClass: main.parentElement.className,
      announce: pick('.announce'),
      header: pick('header.hdr'),
      mainAttrs: Object.fromEntries([...main.attributes].map((a) => [a.name, a.value])),
      sections,
      footer: pick('footer'),
      fab: pick('.wa-fab'),
      css: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
      // The wrappers from #root down to <main>, and what sits beside <main>.
      skeleton: (() => { const out = []; let el = main; while (el && el.id !== 'root') { out.unshift({ tag: el.tagName.toLowerCase(), cls: el.className, id: el.id }); el = el.parentElement; } return out; })(),
      siblings: [...main.parentElement.children].map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
      bodyFirst: [...document.body.children].map((el) => `${el.tagName.toLowerCase()}#${el.id}.${el.className}`),
    };
  });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.waitForTimeout(900);
  parts.menu = await page.evaluate(() => document.querySelector('[role="dialog"]')?.outerHTML || null);
  const home = await (await fetch(`${SITE}/api/v2/shop/home`)).json();
  const catalog = await (await fetch(`${SITE}/api/v2/shop/catalog`)).json();
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), site: SITE, parts, home, catalog }, null, 1));
  console.log(`captured ${parts.sections.length} sections:`, parts.sections.map((s) => `${s.cls.split(' ')[0] || '?'}(${s.label})`).join(', '));
  console.log('layout class:', parts.layoutClass, '| html:', JSON.stringify(parts.htmlAttrs), '| menu:', !!parts.menu, '| announce:', !!parts.announce);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
