/* "Before" pictures of the live home page's first screen (laptop and phone), for the start page. */
const { chromium } = require('playwright-core');
const path = require('node:path');
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  for (const [w, h, name] of [[1440, 900, 'before-laptop'], [390, 844, 'before-phone']]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'light', hasTouch: w < 600 })).newPage();
    await page.goto('https://nandamhandlooms.com/');
    await page.locator('.lux-hero').waitFor();
    await page.waitForTimeout(4500); // after the entrance
    await page.screenshot({ path: path.join(__dirname, '..', 'img', `${name}.jpg`), type: 'jpeg', quality: 78 });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
