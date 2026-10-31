// Saree pages with their own link preview (23 Oct 2026): what WhatsApp, Facebook and the like
// read from https://nandamhandlooms.com/product/<slug> (nginx sends it to this route).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { forgetCache } from '../../../src/services/settings.service.js';
import { withPreview } from '../../../src/services/shop/page.service.js';
import { api, prisma, SHOP } from '../../support/shop.js';

const FILE = process.env.SHOP_WEB_INDEX; // tmp/test-web/index.html (vitest.config.js)
const BUILT = fs.readFileSync('tests/support/web-index.html', 'utf8'); // the website's real built page
const T = String(crypto.randomInt(10_000_000, 99_999_999));
const page = (slug) => api().get(`${SHOP}/pages/product/${slug}`);
const metas = (html, key) => [...html.matchAll(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`, 'g'))].map((m) => m[1]);
const head = (html) => html.slice(0, html.indexOf('</head>'));
let cat;
const p = {};

async function saree(key, sub, { pieces = ['in_stock'], channel = 'both', photo = `https://example.test/${T}-${key}.jpg`, name = sub.name } = {}) {
  p[key] = await prisma.product.create({
    data: {
      slug: `page-${T}-${key}`, sku: `NH-P${T}-${key}`.toUpperCase(), name, categoryId: cat.id, subcategoryId: sub.id, channelVisibility: channel, isActive: true, trackingMode: 'serialized',
      ...(photo ? { images: { create: [{ url: photo, sortOrder: 0 }, { url: `https://example.test/${T}-${key}-2.jpg`, sortOrder: 1 }] } } : {}),
      pieces: { create: pieces.map((status, i) => ({ barcode: `P${T}${key}${i}`.toUpperCase(), status })) },
    },
  });
}

beforeAll(async () => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, BUILT);
  cat = await prisma.category.create({ data: { name: `PAGE TEST ${T}`, slug: `page-test-${T}`, description: 'Test sarees for link previews.', sortOrder: 999 } });
  const sub = (name, price, extra = {}) => prisma.subcategory.create({ data: { categoryId: cat.id, name, description: 'Test.', onlinePrice: price, storePrice: price, mrp: 16999, ...extra } });
  const shown = await sub(`Gap border Embroidery ${T}`, 2000);
  const hidden = await sub(`Hidden page ${T}`, 3000, { isActive: false });
  await saree('one', shown);
  await saree('sold', shown, { pieces: ['sold_online'] });
  await saree('odd', shown, { name: `Silk "Gold" <Zari> & Co ${T}` });
  await saree('local', shown, { photo: `/images/${T}-local.jpg` });
  await saree('store', shown, { channel: 'store_only' });
  await saree('nophoto', shown, { photo: null });
  await saree('hidden', hidden);
});
afterAll(() => fs.rmSync(path.dirname(FILE), { recursive: true, force: true }));

describe('a saree link shows that saree', () => {
  it('its name, price, code and first photo in the head; the rest of the page as built', async () => {
    const r = await page(p.one.slug);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^text\/html/);
    expect(r.headers['cache-control']).toBe('no-cache');
    const html = r.text;
    const name = `Gap border Embroidery ${T}`;
    expect(metas(html, 'og:title')).toEqual([name]);
    expect(metas(html, 'og:description')).toEqual([`₹2,000 · Code ${p.one.sku}`]);
    expect(metas(html, 'og:image')).toEqual([`https://example.test/${T}-one.jpg`]); // the general loom photo is gone
    expect(metas(html, 'og:image:alt')).toHaveLength(1);
    expect(metas(html, 'og:url')).toEqual([`http://shop.test/product/${p.one.slug}`]);
    expect(metas(html, 'og:type')).toEqual(['product']);
    expect(metas(html, 'description')).toEqual([`${name} (${p.one.sku}), ₹2,000.`]);
    expect(html).toContain(`<title>${name} · Nandam Handlooms</title>`);
    expect(html.match(/<title>/g)).toHaveLength(1);
    // Untouched: the site name, the large-picture card, the website's code and everything after the head.
    expect(metas(html, 'og:site_name')).toEqual(['Nandam Handlooms']);
    expect(metas(html, 'twitter:card')).toEqual(['summary_large_image']);
    expect(html.slice(html.indexOf('</head>'))).toBe(BUILT.slice(BUILT.indexOf('</head>')));
    for (const line of BUILT.split('\n').filter((l) => /<script|<link|charset|viewport/.test(l))) expect(html).toContain(line);
  });

  it('a sold-out saree still opens, and says so', async () => {
    const r = await page(p.sold.slug);
    expect(metas(r.text, 'og:description')).toEqual([`₹2,000 · Code ${p.sold.sku} · Sold out`]);
  });

  it('a name with quotes and < > & cannot break the page', async () => {
    const h = head((await page(p.odd.slug)).text);
    expect(metas(h, 'og:title')).toEqual([`Silk &quot;Gold&quot; &lt;Zari&gt; &amp; Co ${T}`]);
    expect(h).toContain(`<title>Silk &quot;Gold&quot; &lt;Zari&gt; &amp; Co ${T} · Nandam Handlooms</title>`);
    expect(h).not.toContain('<Zari>');
  });

  it('a photo kept on the website itself gets the full address', async () => {
    expect(metas((await page(p.local.slug)).text, 'og:image')).toEqual([`http://shop.test/images/${T}-local.jpg`]);
  });

  it('answers HEAD too (some link checkers ask that first)', async () => {
    const r = await api().head(`${SHOP}/pages/product/${p.one.slug}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^text\/html/);
  });
});

describe('anything not on the website keeps the general page', () => {
  it.each([['store only', 'store'], ['no photo', 'nophoto'], ['hidden subcategory', 'hidden']])('%s', async (_, key) => {
    const r = await page(p[key].slug);
    expect(r.status).toBe(200);
    expect(r.text).toBe(BUILT);
  });

  it('an unknown or silly address', async () => {
    for (const slug of ['no-such-saree', 'x'.repeat(300), encodeURIComponent('"><script>alert(1)</script>')]) {
      const r = await page(slug);
      expect(r.status).toBe(200);
      expect(r.text).toBe(BUILT);
    }
  });
});

describe('the website page itself', () => {
  afterEach(async () => {
    fs.writeFileSync(FILE, BUILT);
    await prisma.appConfig.upsert({ where: { id: 'default' }, update: { webMaintenanceEnabled: false, webMaintenanceMessage: '' }, create: { id: 'default', webMaintenanceEnabled: false, webMaintenanceMessage: '' } });
    forgetCache();
  });

  it('a new website build is picked up straight away', async () => {
    const next = BUILT.replace(/index-[\w-]+\.js/, 'index-NEWBUILD.js');
    fs.writeFileSync(FILE, next);
    fs.utimesSync(FILE, new Date(), new Date(Date.now() + 5000)); // a later time, even on a coarse clock
    const r = await page(p.one.slug);
    expect(r.text).toContain('index-NEWBUILD.js');
  });

  it('no page file: 503, so nginx serves the plain page itself', async () => {
    fs.rmSync(FILE);
    const r = await page(p.one.slug);
    expect(r.status).toBe(503);
  });

  it('still works while the owner has the website switched off (the page shows that itself)', async () => {
    await prisma.appConfig.upsert({ where: { id: 'default' }, update: { webMaintenanceEnabled: true, webMaintenanceMessage: 'Back soon' }, create: { id: 'default', webMaintenanceEnabled: true, webMaintenanceMessage: 'Back soon' } });
    forgetCache();
    const r = await page(p.one.slug);
    expect(r.status).toBe(200);
    expect(metas(r.text, 'og:title')).toEqual([`Gap border Embroidery ${T}`]);
  });
});

describe('withPreview', () => {
  const s = { slug: 'a', sku: 'NH-1', name: 'A saree', price: 2700, available: 1, photo: { url: 'https://x.test/a.jpg', alt: '' } };
  it('a page without a <title> gets the lines before </head>', () => {
    const out = withPreview('<html><head><meta property="og:image" content="old.jpg" /></head><body></body></html>', s, 'https://shop.test');
    expect(out).toMatch(/<meta property="og:image" content="https:\/\/x.test\/a.jpg" \/>\n {4}<meta property="og:image:alt" content="A saree" \/>\n {2}<\/head>/);
    expect(out).not.toContain('old.jpg');
    expect(metas(out, 'og:image:alt')).toEqual(['A saree']);
  });
});
