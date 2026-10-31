// The website's shop (W2 home, W3 collections and lists, W4 saree page). Public: no sign-in.
// Counts, crafts and the home page are worked out from one summary of every visible saree,
// kept for a minute, so a busy moment never weighs on the server.
import { SHOP_CATALOG, PRICE_BANDS, CRAFTS, EDITS, STORE } from '../../config/constants.js';
import * as Q from '../../models/shopCatalog.model.js';
import { visibleWhere, listedWhere } from './visibility.js';
import { shopDetails } from '../settings.service.js';
import { notFound } from '../../utils/errors.js';

const DAY = 86400_000;

/* ---------- Text ---------- */
// "MANGALAGIRI HANDLOOM PATTU SAREES" → "Mangalagiri Handloom Pattu Sarees"; spaces tidied.
export function niceName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim();
  if (s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

// A collection's text, as the shop writes it: either a paragraph, or spec lines
// ("Material:Pattu by cotton / Kanchi gap border / Contrast blouse"). Returns a clean
// paragraph (no emoji, no shouted lines, about 240 characters) and the spec lines as points.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
export function readText(text) {
  const lines = String(text || '').replace(EMOJI, '').split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').replace(/^[\s|•*-]+|[\s|•*-]+$/g, '').replace(/\s*:\s*/, ': ').trim())
    .filter(Boolean);
  const isSpec = lines.length >= 3 && lines.filter((l) => l.length <= 60).length >= lines.length * 0.7;
  if (isSpec) {
    const points = lines.filter((l) => !/^[A-Za-z ]{1,20}:$/.test(l) && l !== l.toUpperCase()).map((l) => l.replace(/:$/, '').slice(0, 80)).slice(0, 10);
    return { paragraph: '', points };
  }
  const s = lines.filter((l) => l.length > 15 && l !== l.toUpperCase()).join(' ');
  if (s.length <= 240) return { paragraph: s, points: [] };
  const cut = s.slice(0, 240);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
  return { paragraph: end > 80 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`, points: [] };
}
export const cleanDescription = (text) => readText(text).paragraph;

// Curated words for the main category (from the approved mock-up).
const CATEGORY_TEXT = {
  'mangalagiri-handloom-pattu-sarees': 'Authentic Mangalagiri handloom pattu sarees: rich colours, traditional borders and a royal drape for festivals, weddings, family functions and every celebration.',
};

export const craftOf = (collectionName) => CRAFTS.find((c) => c.match.test(collectionName || ''))?.key ?? null;
export const craftName = (key) => CRAFTS.find((c) => c.key === key)?.name ?? null;
const bandOf = (price) => PRICE_BANDS.find((b) => price >= b.min && price <= b.max)?.key ?? null;
const available = (p) => p.stock + (p._count?.pieces ?? 0);
// Collections the shop made only to try the app ("Test1") are never named on the website.
const TRIAL_NAME = /^\s*test(?:\d|\b)/i;

/* ---------- Cards ---------- */
export function presentCard(p, now = Date.now()) {
  const img = p.images?.[0];
  const name = niceName(p.name);
  const collection = niceName(p.subcategory?.name);
  return {
    slug: p.slug,
    sku: p.sku,
    name,
    collection: { id: p.subcategory?.id ?? p.subcategoryId, name: collection },
    category: p.category?.slug ?? null,
    craft: craftOf(p.subcategory?.name),
    price: Math.round(Number(p.subcategory?.onlinePrice) || 0),
    available: available(p),
    photo: img ? { url: img.url, alt: img.altText || `${name}, ${collection}` } : null,
    isNew: now - new Date(p.createdAt).getTime() < SHOP_CATALOG.NEW_DAYS * DAY,
    addedAt: new Date(p.createdAt).toISOString(),
  };
}

/* ---------- The summary (cached) ---------- */
let cached = { at: 0, value: null, pending: null };
export const forgetCatalog = () => { cached = { at: 0, value: null, pending: null }; };

async function buildSummary() {
  const [products, categories, collections, photos] = await Promise.all([
    Q.visibleSummary(visibleWhere()),
    Q.activeCategories(),
    Q.activeCollections(),
    Q.newestPerCollection(visibleWhere()),
  ]);
  const photoOf = new Map(photos.map((p) => [p.subcategoryId, p.images[0]?.url ?? null]));
  const byCollection = new Map();
  const setIds = [];
  const newSince = Date.now() - SHOP_CATALOG.NEW_DAYS * DAY;
  let newSarees = 0;
  for (const p of products) {
    const c = byCollection.get(p.subcategoryId) || { count: 0, sets: 0, newest: 0 };
    c.count += 1;
    const a = available(p);
    if (a > 1) { c.sets += 1; setIds.push(p.id); }
    c.newest = Math.max(c.newest, new Date(p.createdAt).getTime());
    if (new Date(p.createdAt).getTime() > newSince) newSarees += 1;
    byCollection.set(p.subcategoryId, c);
  }
  const cats = new Map(categories.map((c) => [c.id, c]));
  const cols = collections
    .filter((s) => byCollection.has(s.id) && cats.has(s.categoryId))
    .map((s) => {
      const st = byCollection.get(s.id);
      const price = Math.round(Number(s.onlinePrice));
      return {
        id: s.id,
        name: niceName(s.name),
        category: cats.get(s.categoryId).slug,
        craft: craftOf(s.name),
        price,
        band: bandOf(price),
        count: st.count,
        sets: st.sets,
        newest: st.newest,
        image: s.imageUrl || photoOf.get(s.id) || null,
        description: cleanDescription(s.description),
      };
    });
  const shownCats = categories
    .map((c) => {
      const mine = cols.filter((x) => x.category === c.slug);
      return {
        slug: c.slug,
        name: niceName(c.name),
        description: CATEGORY_TEXT[c.slug] || cleanDescription(c.description),
        image: c.imageUrl || mine.sort((a, b) => b.newest - a.newest)[0]?.image || null,
        count: mine.reduce((n, x) => n + x.count, 0),
        collections: mine.length,
      };
    })
    .filter((c) => c.count > 0);
  // Active categories with nothing on the website yet: "Coming soon", with the collections
  // the shop has already made for them (client, 26 Oct 2026).
  const shown = new Set(shownCats.map((c) => c.slug));
  const soon = categories
    .filter((c) => !shown.has(c.slug))
    .map((c) => ({
      slug: c.slug,
      name: niceName(c.name),
      description: CATEGORY_TEXT[c.slug] || cleanDescription(c.description),
      image: c.imageUrl || null,
      upcoming: [...new Set(collections.filter((s) => s.categoryId === c.id && !TRIAL_NAME.test(s.name)).map((s) => niceName(s.name)))].slice(0, 12),
    }));
  const crafts = CRAFTS.map((k) => {
    const mine = cols.filter((x) => x.craft === k.key);
    return { key: k.key, name: k.name, count: mine.reduce((n, x) => n + x.count, 0), collections: mine.length, image: mine.sort((a, b) => b.count - a.count)[0]?.image || null };
  }).filter((k) => k.count > 0);
  return {
    builtAt: new Date().toISOString(),
    totals: { sarees: products.length, collections: cols.length, sets: setIds.length, newSarees },
    categories: shownCats,
    soon,
    collections: cols.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    crafts,
    setIds,
  };
}

export async function summary() {
  if (cached.value && Date.now() - cached.at < SHOP_CATALOG.CACHE_SECONDS * 1000) return cached.value;
  // One rebuild at a time, even when many visitors arrive together.
  cached.pending ??= buildSummary().then((value) => { cached = { at: Date.now(), value, pending: null }; return value; }, (err) => { cached.pending = null; throw err; });
  return cached.pending;
}

// newest: when its newest saree came in; hasNew: that was in the last NEW_DAYS days.
const publicCollection = ({ newest, ...c }) => ({ ...c, newest: new Date(newest).toISOString(), hasNew: Date.now() - newest < SHOP_CATALOG.NEW_DAYS * DAY });

// GET /shop/catalog: categories, collections, crafts and price bands (menu, filters, collections page).
export async function catalog() {
  const s = await summary();
  return {
    totals: s.totals,
    categories: s.categories,
    soon: s.soon,
    collections: s.collections.map(publicCollection),
    crafts: s.crafts,
    priceBands: PRICE_BANDS.map(({ key, label }) => ({ key, label })),
  };
}

/* ---------- Home ---------- */
const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }];

export async function home() {
  const s = await summary();
  const now = Date.now();
  // The spotlight: the largest pure pattu collection (our richest weave), else the largest of its craft.
  const bySize = (a, b) => b.count - a.count;
  const spotCol = [...s.collections].filter((c) => /pure pattu/i.test(c.name)).sort(bySize)[0]
    || [...s.collections].filter((c) => c.craft === 'pure').sort(bySize)[0] || s.collections[0] || null;
  const [newest, spot, sets] = await Promise.all([
    Q.cards({ where: visibleWhere(), orderBy: NEWEST_FIRST, take: SHOP_CATALOG.NEWEST }),
    spotCol ? Q.cards({ where: { AND: [visibleWhere(), { subcategoryId: spotCol.id }] }, orderBy: NEWEST_FIRST, take: SHOP_CATALOG.SPOTLIGHT }) : [],
    s.setIds.length ? Q.cards({ where: { AND: [visibleWhere(), { id: { in: s.setIds } }] }, orderBy: NEWEST_FIRST, take: SHOP_CATALOG.SETS }) : [],
  ]);
  const shop = await shopDetails();
  const editCount = (e) => (e.sets ? s.totals.sets : s.collections.filter((c) => e.crafts.includes(c.craft)).reduce((n, c) => n + c.count, 0));
  return {
    totals: s.totals,
    categories: s.categories,
    crafts: s.crafts,
    edits: EDITS.map((e) => ({ key: e.key, crafts: e.crafts || [], sets: !!e.sets, count: editCount(e) })).filter((e) => e.count > 0),
    newest: newest.map((p) => presentCard(p, now)),
    spotlight: spotCol ? { collection: publicCollection(spotCol), products: spot.map((p) => presentCard(p, now)) } : null,
    sets: sets.map((p) => presentCard(p, now)),
    store: { name: shop.name, phone: shop.mobile, ...STORE },
  };
}

/* ---------- Lists ---------- */
const SORTS = {
  new: NEWEST_FIRST,
  'price-asc': [{ subcategory: { onlinePrice: 'asc' } }, { createdAt: 'desc' }, { id: 'desc' }],
  'price-desc': [{ subcategory: { onlinePrice: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
};

// The collection-level filters (category, collection, craft, price band), except `skip`.
function collectionMatches(c, f, skip) {
  if (skip !== 'category' && f.category && c.category !== f.category) return false;
  if (skip !== 'collection' && f.collection && c.id !== f.collection) return false;
  if (skip !== 'craft' && f.crafts?.length && !f.crafts.includes(c.craft)) return false;
  if (skip !== 'price' && f.price && c.band !== f.price) return false;
  return true;
}

// A search word that names a craft ("kalamkari", "embroidered", "print", or a spelling the
// collections use, like "kalankari") also finds every collection of that craft.
function craftsForWord(w) {
  const low = w.toLowerCase();
  return CRAFTS.filter((c) => c.match.test(low)
    || (low.length >= 4 && (c.key.startsWith(low) || c.name.toLowerCase().split(/[^a-z]+/).some((n) => n.length >= 4 && n.startsWith(low)))));
}

function searchWhere(q, s) {
  const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
  return {
    AND: words.map((w) => {
      const crafts = craftsForWord(w).map((c) => c.key);
      const ids = crafts.length ? s.collections.filter((c) => crafts.includes(c.craft)).map((c) => c.id) : [];
      return {
        OR: [
          { name: { contains: w, mode: 'insensitive' } },
          { sku: { contains: w, mode: 'insensitive' } },
          { subcategory: { is: { name: { contains: w, mode: 'insensitive' } } } },
          { category: { is: { name: { contains: w, mode: 'insensitive' } } } },
          ...(ids.length ? [{ subcategoryId: { in: ids } }] : []),
        ],
      };
    }),
  };
}

// GET /shop/products: one page of sarees, the total, and the counts beside each filter.
export async function list(f) {
  const s = await summary();
  const productLevel = [visibleWhere()];
  if (f.sets) productLevel.push({ id: { in: s.setIds } });
  if (f.q) productLevel.push(searchWhere(f.q, s));
  const base = { AND: productLevel };
  // Per-collection counts under the product-level filters (search, sets).
  const counts = f.sets || f.q
    ? new Map((await Q.groupByCollection(base)).map((g) => [g.subcategoryId, g._count._all]))
    : new Map(s.collections.map((c) => [c.id, c.count]));
  const countOf = (c) => counts.get(c.id) || 0;
  const ids = s.collections.filter((c) => collectionMatches(c, f)).map((c) => c.id);
  const where = { AND: [...productLevel, { subcategoryId: { in: ids } }] };
  const [rows, total] = await Promise.all([
    Q.cards({ where, orderBy: SORTS[f.sort] || SORTS.new, skip: f.offset, take: f.limit }),
    Q.count(where),
  ]);
  const facet = (skip, keyOf) => {
    const m = new Map();
    for (const c of s.collections) if (collectionMatches(c, f, skip)) m.set(keyOf(c), (m.get(keyOf(c)) || 0) + countOf(c));
    return m;
  };
  const byCat = facet('category', (c) => c.category);
  const byCraft = facet('craft', (c) => c.craft);
  const byBand = facet('price', (c) => c.band);
  const byCol = facet('collection', (c) => c.id);
  const now = Date.now();
  return {
    items: rows.map((p) => presentCard(p, now)),
    total,
    offset: f.offset,
    limit: f.limit,
    nextOffset: f.offset + rows.length < total ? f.offset + rows.length : null,
    facets: {
      category: s.categories.map((c) => ({ key: c.slug, label: c.name, count: byCat.get(c.slug) || 0 })),
      craft: s.crafts.map((c) => ({ key: c.key, label: c.name, count: byCraft.get(c.key) || 0 })),
      price: PRICE_BANDS.map((b) => ({ key: b.key, label: b.label, count: byBand.get(b.key) || 0 })),
      collection: s.collections
        .filter((c) => collectionMatches(c, f, 'collection'))
        .map((c) => ({ key: c.id, label: c.name, count: byCol.get(c.id) || 0 }))
        .filter((c) => c.count > 0),
    },
  };
}

/* ---------- Saree page ---------- */
const ATTRS = [['technique', 'Technique'], ['borderStyle', 'Border'], ['purity', 'Purity'], ['zariTier', 'Zari'], ['blouseType', 'Blouse'], ['pattern', 'Pattern'], ['color', 'Colour'], ['fabric', 'Fabric']];

export async function product(slug) {
  const p = await Q.findBySlug(slug);
  // Hidden, switched off, deleted, a wrong price or no photo: as if it didn't exist.
  const listed = p && (await Q.count({ AND: [listedWhere(), { id: p.id }] })) === 1;
  if (!listed) throw notFound('PRODUCT_NOT_FOUND', 'This saree is not on the website.');
  const now = Date.now();
  const card = presentCard(p, now);
  const crafts = card.craft ? [card.craft] : [];
  const [more, similar] = await Promise.all([
    Q.cards({ where: { AND: [visibleWhere(), { subcategoryId: p.subcategoryId }, { NOT: { id: p.id } }] }, orderBy: NEWEST_FIRST, take: SHOP_CATALOG.MORE_FROM_COLLECTION }),
    crafts.length
      ? (async () => {
        const s = await summary();
        const ids = s.collections.filter((c) => crafts.includes(c.craft) && c.id !== p.subcategoryId).map((c) => c.id);
        return ids.length ? Q.cards({ where: { AND: [visibleWhere(), { subcategoryId: { in: ids } }] }, orderBy: NEWEST_FIRST, take: SHOP_CATALOG.SIMILAR }) : [];
      })()
      : [],
  ]);
  const text = readText(p.subcategory.description);
  return {
    product: {
      ...card,
      soldOut: card.available < 1,
      craftName: craftName(card.craft),
      category: { slug: p.category.slug, name: niceName(p.category.name) },
      description: text.paragraph || CATEGORY_TEXT[p.category.slug] || cleanDescription(p.category.description),
      highlights: text.points,
      photos: p.images.map((i) => ({ url: i.url, alt: i.altText || card.photo?.alt || card.name })),
      details: [
        ...ATTRS.filter(([k]) => p[k]).map(([k, label]) => ({ label, value: String(p[k]) })),
        ...(p.occasion?.length ? [{ label: 'Occasion', value: p.occasion.join(', ') }] : []),
      ],
    },
    more: more.map((x) => presentCard(x, now)),
    similar: similar.map((x) => presentCard(x, now)),
  };
}
