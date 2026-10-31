// Saree pages for link previews (23 Oct 2026). WhatsApp, Facebook, iMessage and the like read
// only a page's <head> and don't run the website's code, so every saree link showed the
// general loom photo. nginx sends /product/<slug> here: the website's own index.html comes back
// with that saree's name, price, code and first photo in the head. People get the same page as
// before (the website then takes over); a saree that isn't on the website keeps the general head.
import { readFile, stat } from 'node:fs/promises';
import { env } from '../../config/env.js';
import * as Q from '../../models/shopCatalog.model.js';
import { listedWhere } from './visibility.js';
import { presentCard } from './catalog.service.js';
import { unavailable } from '../../utils/errors.js';

// The head lines this page replaces (the rest of index.html is left exactly as built).
const REPLACED = ['description', 'og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rs = (n) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

// The website's index.html, read again whenever the website is updated.
let built = { at: 0, html: null };
async function indexHtml() {
  if (!env.SHOP_WEB_INDEX) throw unavailable('NO_WEBSITE_PAGE', 'SHOP_WEB_INDEX is not set.');
  try {
    const { mtimeMs } = await stat(env.SHOP_WEB_INDEX);
    if (built.html === null || built.at !== mtimeMs) built = { at: mtimeMs, html: await readFile(env.SHOP_WEB_INDEX, 'utf8') };
    return built.html;
  } catch (err) {
    // Mid-update of the website, or a wrong path: nginx serves the plain page meanwhile.
    throw unavailable('NO_WEBSITE_PAGE', `The website page can't be read (${err.code || err.message}).`);
  }
}

// A saree that is on the website: what its link preview shows. Null otherwise.
async function previewOf(slug) {
  if (!slug || slug.length > 200) return null;
  const p = await Q.findBySlug(slug);
  const listed = p && (await Q.count({ AND: [listedWhere(), { id: p.id }] })) === 1;
  return listed ? presentCard(p) : null;
}

// index.html with the saree's own title and preview lines in place of the general ones.
export function withPreview(html, s, origin) {
  const photo = s.photo?.url ? (s.photo.url.startsWith('/') ? `${origin}${s.photo.url}` : s.photo.url) : null;
  const lines = [
    `<title>${esc(s.name)} · Nandam Handlooms</title>`,
    `<meta name="description" content="${esc(`${s.name} (${s.sku}), ${rs(s.price)}.`)}" />`,
    '<meta property="og:type" content="product" />',
    `<meta property="og:title" content="${esc(s.name)}" />`,
    `<meta property="og:description" content="${esc(`${rs(s.price)} · Code ${s.sku}${s.available < 1 ? ' · Sold out' : ''}`)}" />`,
    `<meta property="og:url" content="${esc(`${origin}/product/${s.slug}`)}" />`,
    ...(photo ? [`<meta property="og:image" content="${esc(photo)}" />`, `<meta property="og:image:alt" content="${esc(s.photo.alt || s.name)}" />`] : []),
  ].join('\n    ');
  let out = html;
  for (const key of photo ? REPLACED : REPLACED.filter((k) => !k.startsWith('og:image'))) {
    out = out.replace(new RegExp(`[ \\t]*<meta (?:name|property)="${key.replace(/[.:]/g, '\\$&')}"[^>]*>\\n?`, 'g'), '');
  }
  return /<title>[^<]*<\/title>/.test(out) ? out.replace(/<title>[^<]*<\/title>/, lines) : out.replace('</head>', `    ${lines}\n  </head>`);
}

export async function productPage(slug, origin) {
  const html = await indexHtml();
  const s = await previewOf(slug);
  return s ? withPreview(html, s, origin) : html;
}
