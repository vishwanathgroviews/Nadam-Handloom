// Website W5: the bag (docs/modules/web-03-cart.md). A visitor's bag lives in their browser and
// is only checked here (nothing kept); a signed-in customer's bag is also kept, one BagItem row
// per saree. Every answer is the whole bag checked against today's stock and website prices,
// with the same "on the website" rule as every list (visibility.js). Nothing is held: stock is
// held only while paying (W6), and what the customer's own checkout holds still counts as theirs.
import { prisma } from '../../config/database.js';
import * as Bag from '../../models/bag.model.js';
import { listedWhere } from './visibility.js';
import { presentCard, craftName, niceName } from './catalog.service.js';
import { BAG } from '../../config/constants.js';
import { conflict, notFound } from '../../utils/errors.js';

const notOnWebsite = () => notFound('NOT_ON_WEBSITE', 'This saree is no longer on the website.');
const soldOut = (slug) => conflict('SOLD_OUT', 'This saree has just sold out.', { slug });
const bagFull = () => conflict('BAG_FULL', `Your bag is full (${BAG.MAX_LINES} sarees). Remove one to add another.`, { maxLines: BAG.MAX_LINES });

// The same saree sent twice (two tabs, an old bag): one line with the larger number.
export function joinRepeats(items) {
  const by = new Map();
  for (const it of items) {
    const had = by.get(it.slug);
    if (!had || it.quantity > had.quantity) by.set(it.slug, { ...it, priceSeen: it.priceSeen ?? had?.priceSeen });
  }
  return [...by.values()];
}

// One line. state: ok | fewer (fewer pieces left than asked: the number is lowered) |
// sold_out (still on the website, nothing in stock) | unavailable (no longer on the website).
// `mine`: pieces the customer's own unpaid checkout holds (they count as theirs).
export function presentLine(p, { listed, asked, priceSeen, mine = 0 }) {
  const card = presentCard(p);
  const available = card.available + mine;
  let state = 'ok';
  if (!listed) state = 'unavailable';
  else if (available < 1) state = 'sold_out';
  else if (asked > available) state = 'fewer';
  const quantity = state === 'ok' ? asked : state === 'fewer' ? available : 0;
  const seen = priceSeen == null ? null : Math.round(Number(priceSeen));
  return {
    slug: card.slug,
    sku: card.sku,
    name: card.name,
    collection: card.collection,
    category: { slug: p.category.slug, name: niceName(p.category.name) },
    craftName: craftName(card.craft),
    photo: card.photo,
    price: card.price,
    priceWas: quantity > 0 && seen != null && seen !== card.price ? seen : null,
    available: listed ? available : 0,
    asked,
    quantity,
    lineTotal: quantity * card.price,
    state,
  };
}

// The whole answer: lines, totals, and how many changed (for the note at the top).
export function present(lines, extra = {}) {
  const buyable = lines.filter((l) => l.quantity > 0);
  return {
    items: lines,
    totals: {
      lines: lines.filter((l) => l.state !== 'not_found').length,
      buyableLines: buyable.length,
      pieces: buyable.reduce((n, l) => n + l.quantity, 0),
      amount: buyable.reduce((n, l) => n + l.lineTotal, 0),
    },
    changes: {
      soldOut: lines.filter((l) => l.state === 'sold_out').length,
      unavailable: lines.filter((l) => l.state === 'unavailable').length,
      fewer: lines.filter((l) => l.state === 'fewer').length,
      priceChanged: lines.filter((l) => l.priceWas != null).length,
      notFound: lines.filter((l) => l.state === 'not_found').length,
    },
    maxLines: BAG.MAX_LINES,
    checkedAt: new Date().toISOString(),
    ...extra,
  };
}

/* ---------- A visitor's bag (sent by the browser, nothing kept) ---------- */
export async function check({ items }) {
  const wanted = joinRepeats(items);
  const products = await Bag.productsBySlugs(wanted.map((i) => i.slug));
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const listed = await Bag.listedIds(products.map((p) => p.id), listedWhere());
  const lines = wanted.map((it) => {
    const p = bySlug.get(it.slug);
    if (!p) return { slug: it.slug, state: 'not_found', asked: it.quantity, quantity: 0, lineTotal: 0, priceWas: null };
    // A saree that isn't on the website is not described to someone who only knows its link:
    // the browser shows the name and photo it kept when the saree was added.
    if (!listed.has(p.id)) return { slug: it.slug, state: 'unavailable', asked: it.quantity, available: 0, quantity: 0, lineTotal: 0, priceWas: null };
    return presentLine(p, { listed: true, asked: it.quantity, priceSeen: it.priceSeen });
  });
  return present(lines);
}

/* ---------- A signed-in customer's bag ---------- */
// Read and check the saved bag inside a transaction (the customer's lock is held). Fewer
// pieces left than saved: the saved number is lowered, once (never raised again by itself).
async function readBag(accountId, tx) {
  const rows = await Bag.rowsFor(accountId, tx);
  const listed = await Bag.listedIds(rows.map((r) => r.productId), listedWhere(), tx);
  const mine = await Bag.heldFor(accountId, tx);
  const lines = [];
  for (const r of rows) {
    const line = presentLine(r.product, { listed: listed.has(r.productId), asked: r.quantity, priceSeen: r.priceSeen, mine: mine.get(r.productId) ?? 0 });
    if (line.state === 'fewer') await Bag.setQuantity(r.id, line.quantity, tx);
    lines.push(line);
  }
  return lines;
}

const inTx = (accountId, fn) => prisma.$transaction(async (tx) => {
  await Bag.lockFor(accountId, tx);
  return fn(tx);
});

export const getBag = ({ accountId }) => inTx(accountId, async (tx) => present(await readBag(accountId, tx)));

// Adds a saree or sets how many pieces (capped by what is in stock).
export const setItem = ({ accountId, slug, quantity, priceSeen }) => inTx(accountId, async (tx) => {
  const [p] = await Bag.productsBySlugs([slug], tx);
  if (!p || !(await Bag.listedIds([p.id], listedWhere(), tx)).has(p.id)) throw notOnWebsite();
  const card = presentCard(p);
  const available = card.available + ((await Bag.heldFor(accountId, tx)).get(p.id) ?? 0);
  if (available < 1) throw soldOut(slug);
  const had = await Bag.find(accountId, p.id, tx);
  if (!had && (await Bag.countFor(accountId, tx)) >= BAG.MAX_LINES) throw bagFull();
  const q = Math.min(quantity, available);
  await Bag.acknowledgePrices(accountId, tx);
  if (had) await Bag.update(had.id, { quantity: q, ...(priceSeen != null ? { priceSeen } : {}) }, tx);
  else await Bag.create({ authAccountId: accountId, productId: p.id, quantity: q, priceSeen: priceSeen ?? card.price }, tx);
  const lines = await readBag(accountId, tx);
  // Asked for more than is in stock: say so on this line (the saved number is the stock).
  return present(lines.map((l) => (l.slug === slug && quantity > q ? { ...l, asked: quantity, state: 'fewer' } : l)));
});

export const removeItem = ({ accountId, slug }) => inTx(accountId, async (tx) => {
  await Bag.removeBySlug(accountId, slug, tx);
  await Bag.acknowledgePrices(accountId, tx);
  return present(await readBag(accountId, tx));
});

export const clear = ({ accountId }) => inTx(accountId, async (tx) => {
  await Bag.removeAll(accountId, tx);
  return present([]);
});

// At sign-in: the browser's bag joins the account's (rule 9). The same saree in both: the
// larger number, capped by the stock; never the sum. Sarees that are gone, sold out or don't
// fit (20 sarees) are skipped and counted.
export const merge = ({ accountId, items }) => inTx(accountId, async (tx) => {
  const wanted = joinRepeats(items);
  const products = await Bag.productsBySlugs(wanted.map((i) => i.slug), tx);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const listed = await Bag.listedIds(products.map((p) => p.id), listedWhere(), tx);
  let count = await Bag.countFor(accountId, tx);
  const mine = await Bag.heldFor(accountId, tx);
  const joined = { added: 0, raised: 0, skipped: 0 };
  for (const it of wanted) {
    const p = bySlug.get(it.slug);
    const available = p ? presentCard(p).available + (mine.get(p.id) ?? 0) : 0;
    if (!p || !listed.has(p.id) || available < 1) { joined.skipped += 1; continue; }
    const q = Math.min(it.quantity, available);
    const had = await Bag.find(accountId, p.id, tx);
    if (had) {
      if (q > had.quantity) { await Bag.update(had.id, { quantity: q }, tx); joined.raised += 1; }
      continue;
    }
    if (count >= BAG.MAX_LINES) { joined.skipped += 1; continue; }
    await Bag.create({ authAccountId: accountId, productId: p.id, quantity: q, priceSeen: it.priceSeen ?? presentCard(p).price }, tx);
    count += 1;
    joined.added += 1;
  }
  return present(await readBag(accountId, tx), { joined });
});

// Buy again (W7 7.7 A): an order's sarees back in the bag, by the bag's own rules. Only what is
// still on the website and in stock, never more pieces than in stock, at most 20 sarees, at
// today's price. A saree already in the bag keeps the larger number (rule 9). items:
// [{ slug, name, quantity }]. Answers the bag and, by name, what was added, raised or skipped
// (reason: sold_out | unavailable | bag_full).
export const addOrderLines = ({ accountId, items }) => inTx(accountId, async (tx) => {
  const wanted = joinRepeats(items.filter((it) => it.slug));
  const products = await Bag.productsBySlugs(wanted.map((i) => i.slug), tx);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const listed = await Bag.listedIds(products.map((p) => p.id), listedWhere(), tx);
  let count = await Bag.countFor(accountId, tx);
  const mine = await Bag.heldFor(accountId, tx);
  const out = { added: [], raised: [], already: [], skipped: [] };
  for (const it of items.filter((x) => !x.slug)) out.skipped.push({ slug: null, name: it.name, reason: 'unavailable' });
  for (const it of wanted) {
    const p = bySlug.get(it.slug);
    const name = p ? presentCard(p).name : it.name;
    if (!p || !listed.has(p.id)) { out.skipped.push({ slug: it.slug, name, reason: 'unavailable' }); continue; }
    const card = presentCard(p);
    const available = card.available + (mine.get(p.id) ?? 0);
    if (available < 1) { out.skipped.push({ slug: it.slug, name, reason: 'sold_out' }); continue; }
    const q = Math.min(it.quantity, available);
    const had = await Bag.find(accountId, p.id, tx);
    if (had) {
      if (q > had.quantity) { await Bag.update(had.id, { quantity: q, priceSeen: card.price }, tx); out.raised.push({ slug: it.slug, name, quantity: q }); }
      else out.already.push({ slug: it.slug, name, quantity: had.quantity });
      continue;
    }
    if (count >= BAG.MAX_LINES) { out.skipped.push({ slug: it.slug, name, reason: 'bag_full' }); continue; }
    await Bag.create({ authAccountId: accountId, productId: p.id, quantity: q, priceSeen: card.price }, tx);
    count += 1;
    out.added.push({ slug: it.slug, name, quantity: q, fewer: q < it.quantity });
  }
  return present(await readBag(accountId, tx), { buyAgain: out });
});

// Account deletion and the clean-up job.
export const removeAllFor = (accountId, tx) => Bag.removeAll(accountId, tx);
export const forgetUnchanged = () => Bag.deleteUnchangedSince(new Date(Date.now() - BAG.KEEP_DAYS * 86400_000));
