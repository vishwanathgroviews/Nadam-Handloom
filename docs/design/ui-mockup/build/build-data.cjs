// Builds assets/data.js and img/ for the UI mock-up from the real catalogue.
//
// Inputs (fetched from the live public API on 2026-10-08, kept next to this script):
//   products-raw.json     GET /api/v1/catalog/products?pageSize=48 (all pages), as the storefront sees them
//   collections-raw.json  GET /api/v1/catalog/categories/:slug/subcategories (all categories)
// Photos come from the S3 backup taken on 2026-10-07; anything newer is fetched from the public bucket.
//
// Run from frontend/customer-web so that `sharp` resolves:
//   NODE_PATH=./node_modules node ../../docs/design/ui-mockup/build/build-data.cjs
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME;
const BACKUP = `${HOME}/Documents/Nandam-Handlooms/s3-backup-2026-10-07-before-image-compression/`;
const BUILD = __dirname + '/';
const OUT = path.resolve(__dirname, '..') + '/';
const PER_COLLECTION = 6;
const PRODUCT_W = 640, PRODUCT_H = 853, PRODUCT_CAP_KB = 60;

const products = JSON.parse(fs.readFileSync(`${BUILD}products-raw.json`, 'utf8'));
const collectionsRaw = JSON.parse(fs.readFileSync(`${BUILD}collections-raw.json`, 'utf8'));

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// The saree's own colour, read from its photo: the busiest hue among the
// pixels that are neither the white backdrop nor shadow.
const readColour = async (file) => {
  const { data } = await sharp(file).resize(48, 64, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = Array.from({ length: 36 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let neutral = { n: 0, l: 0 }, counted = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l > 0.93 || l < 0.06) continue;
    counted++;
    if (s < 0.2) { neutral.n++; neutral.l += l; continue; }
    const bin = bins[Math.floor(h / 10) % 36];
    const w = s * (1 - Math.abs(l - 0.5));
    bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
  }
  const total = bins.reduce((t, x) => t + x.w, 0);
  if (total < 40 || !counted) {
    const l = neutral.n ? neutral.l / neutral.n : 0.8;
    const v = Math.round(l * 255);
    return { h: 0, s: 0, l, hex: hex(v, v, Math.max(0, v - 6)), hex2: null, family: 'Ivory & grey' };
  }
  const score = bins.map((_, i) => bins[i].w + 0.6 * (bins[(i + 1) % 36].w + bins[(i + 35) % 36].w));
  const top = score.indexOf(Math.max(...score));
  const mix = (center) => {
    let w = 0, r = 0, g = 0, b = 0;
    for (const k of [35, 0, 1]) { const x = bins[(center + k) % 36]; w += x.w; r += x.r; g += x.g; b += x.b; }
    return [r / w, g / w, b / w];
  };
  const [r, g, b] = mix(top);
  const [h, s, l] = rgbToHsl(r, g, b);
  let second = -1;
  for (let i = 0; i < 36; i++) {
    const dist = Math.min(Math.abs(i - top), 36 - Math.abs(i - top));
    if (dist >= 5 && score[i] > total * 0.12 && (second < 0 || score[i] > score[second])) second = i;
  }
  const hex2 = second >= 0 ? hex(...mix(second)) : null;
  const family =
    l < 0.3 && h >= 15 && h < 50 ? 'Brown' :
    h < 15 || h >= 345 ? 'Red' :
    h < 42 ? 'Orange' :
    h < 68 ? 'Yellow' :
    h < 165 ? 'Green' :
    h < 200 ? 'Teal' :
    h < 255 ? 'Blue' :
    h < 295 ? 'Purple' : 'Pink';
  return { h: Math.round(h), s: +s.toFixed(2), l: +l.toFixed(2), hex: hex(r, g, b), hex2, family };
};

// Display-only tidying of the shop's names: title case, the "— Border" suffix
// dropped, and the one spelling slip fixed. The database is not changed.
const tidy = (name) =>
  name.replace(/\s+—\s+Border$/i, '').replace(/\s+/g, ' ').trim()
    .replace(/embroidry/gi, 'Embroidery')
    .replace(/\b([a-z])([a-z]*)/g, (m, a, rest) => (/^(by|and|of|k)$/.test(m) ? m : a.toUpperCase() + rest));

const borderOf = (text) =>
  /300/.test(text) ? '300 Kanchi' : /250\/50/.test(text) ? '250/50' : /150/.test(text) ? '150/50' : /100\/50/.test(text) ? '100/50' :
  /50\/50/.test(text) ? '50/50' : /gap/i.test(text) ? 'Gap' : /scallop/i.test(text) ? 'Scallop' : /rangoli|rainbow/i.test(text) ? 'Rangoli' : 'Kanchi';

const workOf = (name) =>
  /hand ?paint/i.test(name) ? 'Hand painted' : /applique/i.test(name) ? 'Applique' : /chikankari/i.test(name) ? 'Chikankari' :
  /digital/i.test(name) ? 'Digital print' : /bandini|baguru|screen|dye|embossing/i.test(name) ? 'Screen print' :
  /check/i.test(name) ? 'Checks' : /zute|zari line/i.test(name) ? 'Lines' : /plain|bramini/i.test(name) ? 'Plain' : /embroid/i.test(name) ? 'Embroidery' : 'Plain';

// The shop writes each collection's description as short lines:
// Material / loom / "Model:" / border / body / blouse / pallu.
const parseSpec = (description) => {
  const lines = (description || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const spec = {};
  let afterModel = false; const model = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^material\s*:?/i.test(line)) { const v = line.replace(/^material\s*:?\s*/i, ''); spec.Material = v || lines[++i] || ''; continue; }
    if (/loom/i.test(line) && !afterModel) { spec.Loom = /power/i.test(line) ? 'Powerloom' : 'Pure handloom'; continue; }
    if (/^model\s*:?/i.test(line)) { afterModel = true; const v = line.replace(/^model\s*:?\s*/i, ''); if (v) model.push(v); continue; }
    if (afterModel) model.push(line);
  }
  for (const line of model) {
    if (/blouse/i.test(line)) spec.Blouse = line.replace(/\s*blouse\s*$/i, '').replace(/\s*\/\s*/g, ' or ');
    else if (/pallu/i.test(line)) spec.Pallu = line.replace(/\s*pallu\s*$/i, '').replace(/\s*\/\s*/g, ' or ');
    else if (/border/i.test(line) && !spec.Border) spec.Border = line.replace(/\s*border\s*$/i, '');
    else if (!spec.Body) spec.Body = line.replace(/\s*sarees?\s*$/i, '');
  }
  if (!spec.Material && !afterModel && description) spec.About = lines.join(' ');
  for (const k of Object.keys(spec)) spec[k] = String(spec[k]).trim().replace(/^./, (c) => c.toUpperCase()).replace(/embroidry/gi, 'Embroidery');
  return spec;
};

const fetchTo = async (url, file) => {
  if (fs.existsSync(file)) return true;
  const res = await fetch(url);
  if (!res.ok) return false;
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return true;
};

const jpegUnder = async (input, resize, capKb, qualities = [74, 66, 58, 50, 44, 38]) => {
  let buf;
  for (const q of qualities) {
    buf = await sharp(input).rotate().resize(resize).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (buf.length <= capKb * 1024) break;
  }
  return buf;
};

(async () => {
  fs.mkdirSync(`${OUT}img/p`, { recursive: true });
  fs.mkdirSync(`${OUT}img/c`, { recursive: true });
  fs.mkdirSync(`${OUT}img/site`, { recursive: true });
  fs.mkdirSync(`${OUT}assets`, { recursive: true });
  const CACHE = `${BUILD}cache/`;
  fs.mkdirSync(CACHE, { recursive: true });

  // 1. colour of every saree whose photo we hold
  const rows = [];
  let fetched = 0;
  for (const p of products) {
    const key = p.images?.[0]?.storageKey;
    if (!key) continue;
    let file = BACKUP + key;
    if (!fs.existsSync(file)) {
      file = `${CACHE}${path.basename(key)}`;
      if (!fs.existsSync(file)) {
        if (!(await fetchTo(p.images[0].url, file))) continue;
        fetched++;
      }
    }
    rows.push({ p, file, colour: await readColour(file) });
  }
  console.log('photos fetched from the live bucket:', fetched);

  // 2. collections actually in use (have at least one saree in stock online)
  const byId = Object.fromEntries(collectionsRaw.map((c) => [c.id, c]));
  const totals = {};
  for (const p of products) totals[p.subcategoryId] = (totals[p.subcategoryId] || 0) + 1;
  const collections = Object.keys(totals).map((id) => {
    const c = byId[id];
    const text = `${c.name} ${c.description || ''}`;
    return {
      id, raw: c.name, name: tidy(c.name), price: Number(c.onlinePrice), mrp: Number(c.mrp), total: totals[id],
      border: borderOf(text), work: workOf(c.name), spec: parseSpec(c.description), imageUrl: c.imageUrl || null,
    };
  }).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  const cIndex = Object.fromEntries(collections.map((c, i) => [c.id, i]));

  // 3. pick sarees: per collection, the ones furthest apart in hue
  const chosen = [];
  for (const c of collections) {
    const pool = rows.filter((r) => r.p.subcategoryId === c.id).sort((a, b) => a.colour.h - b.colour.h);
    if (!pool.length) continue;
    const take = Math.min(PER_COLLECTION, pool.length);
    const picked = new Set();
    for (let i = 0; i < take; i++) picked.add(Math.round((i + 0.5) * pool.length / take - 0.5));
    for (const i of picked) chosen.push(pool[Math.min(i, pool.length - 1)]);
  }

  // 4. product pictures
  const out = [];
  for (const { p, file, colour } of chosen) {
    const name = `${p.sku.toLowerCase()}.jpg`;
    fs.writeFileSync(`${OUT}img/p/${name}`, await jpegUnder(file, { width: PRODUCT_W, height: PRODUCT_H, fit: 'cover' }, PRODUCT_CAP_KB));
    out.push({
      id: p.sku, slug: p.slug, name: tidy(p.name), c: cIndex[p.subcategoryId], img: `img/p/${name}`,
      h: colour.h, s: colour.s, l: colour.l, hex: colour.hex, hex2: colour.hex2, fam: colour.family,
      at: p.createdAt.slice(0, 10), stock: p.availableCount ?? 1, uuid: p.id,
    });
  }
  for (const c of collections) c.inMock = out.filter((x) => x.c === cIndex[c.id]).length;

  // 5. collection pictures: the shop's own upload when there is one, else the first chosen saree
  for (const c of collections) {
    const name = `${cIndex[c.id]}.jpg`;
    let src = null;
    if (c.imageUrl) {
      const key = c.imageUrl.replace(/^https?:\/\/[^/]+\//, '');
      src = BACKUP + key;
      if (!fs.existsSync(src)) { src = `${CACHE}${path.basename(key)}`; if (!(await fetchTo(c.imageUrl, src))) src = null; }
    }
    c.ownPhoto = !!src;
    if (!src) { const first = chosen.find((r) => r.p.subcategoryId === c.id); src = first ? first.file : null; }
    if (src) { fs.writeFileSync(`${OUT}img/c/${name}`, await jpegUnder(src, { width: 640, height: 800, fit: 'cover' }, 60)); c.img = `img/c/${name}`; }
  }

  // 6. the shop's own site photographs
  const site = [
    ['site/hero/hero-pattu-zari-border.jpg', 'hero-zari-border.jpg', 1920, 230],
    ['site/hero/hero-bridal-brocade.jpg', 'hero-brocade.jpg', 1920, 230],
    ['site/hero/hero-cotton-checks.jpg', 'hero-cotton-checks.jpg', 1600, 190],
    ['site/hero/hero-kalamkari-border.jpg', 'hero-kalamkari.jpg', 1600, 190],
    ['site/hero/hero-craft-story.jpg', 'hero-craft-story.jpg', 1600, 190],
    ['site/brand/handloom_banner.jpg', 'loom.jpg', 1024, 170],
    ['site/craft/texture-gold-border-1.jpg', 'gold-border.jpg', 1100, 120],
    ['site/craft/texture-silver-border-1.jpg', 'silver-border.jpg', 1100, 120],
    ['site/craft/texture-mint-border.jpg', 'mint-border.jpg', 1100, 120],
    ['site/craft/texture-mint-embroidery.jpg', 'mint-embroidery.jpg', 1100, 120],
    ['site/categories/handloom-pattu-saree.jpg', 'cat-pattu-saree.jpg', 900, 110],
  ];
  for (const [src, name, width, cap] of site) {
    if (!fs.existsSync(BACKUP + src)) { console.log('missing site photo', src); continue; }
    fs.writeFileSync(`${OUT}img/site/${name}`, await jpegUnder(BACKUP + src, { width, withoutEnlargement: true }, cap));
  }
  fs.writeFileSync(`${OUT}img/site/logo.png`, await sharp(BACKUP + 'site/brand/logo.png').resize(256, 256).png({ compressionLevel: 9, palette: true }).toBuffer());

  const data = {
    built: new Date().toISOString().slice(0, 10),
    totals: { sarees: products.length, collections: collections.length, low: Math.min(...collections.map((c) => c.price)), high: Math.max(...collections.map((c) => c.price)), shown: out.length },
    collections: collections.map(({ id, raw, mrp, imageUrl, ...rest }) => rest),
    products: out.sort((a, b) => a.h - b.h || a.l - b.l),
  };
  fs.writeFileSync(`${OUT}assets/data.js`, `// Generated by build/build-data.cjs on ${data.built} from the live catalogue. Do not edit by hand.\nwindow.NH_DATA = ${JSON.stringify(data)};\n`);

  const files = fs.readdirSync(`${OUT}img/p`).map((f) => fs.statSync(`${OUT}img/p/${f}`).size);
  const fam = {}; for (const x of out) fam[x.fam] = (fam[x.fam] || 0) + 1;
  console.log('sarees with a usable photo:', rows.length, '| chosen for the mock:', out.length, '| collections:', collections.length, '| with own photo:', collections.filter((c) => c.ownPhoto).length);
  console.log('product pictures:', files.length, '| total', (files.reduce((a, b) => a + b, 0) / 1048576).toFixed(1), 'MB | biggest', Math.round(Math.max(...files) / 1024), 'KB');
  console.log('colour families:', JSON.stringify(fam));
  for (const c of collections) console.log(' ', String(c.price).padStart(5), c.name.padEnd(44), '|', c.border.padEnd(10), '|', c.work.padEnd(13), '|', c.ownPhoto ? 'own photo' : 'saree photo', '|', JSON.stringify(c.spec).slice(0, 120));
  console.log('data.js', Math.round(fs.statSync(`${OUT}assets/data.js`).size / 1024), 'KB');
})();
