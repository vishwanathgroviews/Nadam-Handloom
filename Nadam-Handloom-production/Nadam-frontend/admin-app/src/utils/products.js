// Products (sarees) and tags: the rules the screens share. Docs Module 4.
// Tag tidying matches the server (src/utils/tags.js): spaces removed, capitals.

export const TAG_PATTERN = /^[!-}]{3,64}$/; // printable, no "~" (the server uses it for freed tags)
export const tidyTag = (code) => String(code ?? '').replace(/\s+/g, '').toUpperCase();
export const isValidTag = (code) => TAG_PATTERN.test(code);
// A number typed on its own (up to 6 digits) means the shop's NH tag: 3302 → NH3302 (rule T6).
// Camera reads are used as they are.
export function typedTag(text) {
  const t = tidyTag(text);
  return /^\d{1,6}$/.test(t) ? `NH${t}` : t;
}
export const tagNumber = (code) => (/^[A-Z]+([0-9]+)$/.exec(tidyTag(code)) || [])[1] || null;

export const CHANNELS = [
  ['both', 'Online + store', 'Website and the counter'],
  ['online_only', 'Online only', 'Website only, not sold at the counter'],
  ['store_only', 'Store only', 'Counter only, not on the website'],
];
export const channelText = (ch) => (CHANNELS.find((c) => c[0] === ch) || [null, 'Hidden'])[1];

export const PRODUCT_FILTERS = [['all', 'All'], ['instock', 'In stock'], ['soldout', 'Sold out'], ['nophoto', 'No photo'], ['online', 'Online only'], ['store', 'Store only']];

const STOCK = { in_stock: ['In stock', 'success'], held: ['Held', 'warning'], damaged: ['Damaged', 'danger'], sold_out: ['Sold out', 'neutral'] };
export const stockBadge = (stock) => STOCK[stock] || STOCK.sold_out;

export function tagStatusText(t) {
  const on = (iso) => (iso ? ` · ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : '');
  switch (t.status) {
    case 'in_stock': return ['In stock', 'success'];
    case 'reserved': return [`Held by an online order${t.heldUntil ? ` until ${new Date(t.heldUntil).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}`, 'warning'];
    case 'sold_offline': return [`Sold at the counter${on(t.soldAt)}`, 'neutral'];
    case 'sold_online': return [`Sold online${on(t.soldAt)}`, 'neutral'];
    case 'damaged': return ['Saree damaged · not for sale', 'danger'];
    case 'retired': return [`Retired · damaged tag${on(t.retiredAt)}`, 'neutral'];
    case 'returned': return ['Returned', 'neutral'];
    default: return [t.status, 'neutral'];
  }
}

// Why a tag can't be changed right now (shown in the tag sheet).
export function tagLockReason(t) {
  if (t.status === 'sold_offline' || t.status === 'sold_online') return 'Sold. A sold saree\'s tag can\'t be changed.';
  if (t.status === 'reserved') return `A customer is paying for it online${t.orderNumber ? ` (order ${t.orderNumber})` : ''}. Try again after the checkout ends.`;
  if (t.status === 'retired') return 'This tag was damaged and replaced. Its number can\'t be used again.';
  return null;
}

/* ---------- the batch: photos waiting for their tags (section 5.1) ---------- */

// A photo carries one tag per saree. Usually one; a SET (several identical sarees, one
// photo; client's request 15 Oct 2026) has as many as "Sarees in this photo" says.
export const MAX_SET = 50;
// Drafts saved before sets had `tag`; read both.
export const tagsOf = (it) => it?.tags || (it?.tag ? [it.tag] : []);
export const wantOf = (it) => Math.max(1, it?.want || 1);
// Has all its tags: as many as its count (at least one).
export const itemDone = (it) => tagsOf(it).length >= wantOf(it);

// The next photo to scan after `from`: unfinished ones first, then the skipped ones; -1 when all are done.
export function nextIndex(items, from) {
  const n = items.length;
  for (let i = 1; i <= n; i++) { const k = (from + i) % n; if (!itemDone(items[k]) && !items[k].skipped) return k; }
  for (let i = 1; i <= n; i++) { const k = (from + i) % n; if (!itemDone(items[k])) return k; }
  return -1;
}

// Where else this tag is in the batch (a tag is on one saree only: T2), or -1.
export const indexWithTag = (items, code, except = -1) => items.findIndex((it, i) => i !== except && tagsOf(it).includes(code));

// tagged/missing count photos; sarees counts tags; short = sets with fewer tags than their count.
export function batchSummary(items) {
  const withTags = items.filter((i) => tagsOf(i).length);
  return {
    total: items.length,
    tagged: withTags.length,
    missing: items.length - withTags.length,
    sarees: withTags.reduce((n, i) => n + tagsOf(i).length, 0),
    sets: withTags.filter((i) => tagsOf(i).length > 1).length,
    short: withTags.filter((i) => !itemDone(i)).length,
    done: items.filter((i) => tagsOf(i).length && itemDone(i)).length,
    unchecked: withTags.filter((i) => i.unchecked).length,
  };
}

/* ---------- photos: fitted to the website's product card (3:4, portrait) ---------- */

export const CARD_RATIO = 3 / 4;
// The centred 3:4 area of a photo, moved up or down by `shift` (-1 top … 0 centre … 1 bottom)
// or left / right for a wide photo. Pixels of the photo itself.
export function cardArea(width, height, shift = 0) {
  if (width / height > CARD_RATIO) {
    const w = Math.round(height * CARD_RATIO);
    const spare = width - w;
    return { originX: Math.round((spare / 2) * (1 + shift)), originY: 0, width: w, height };
  }
  const h = Math.round(width / CARD_RATIO);
  const spare = height - h;
  return { originX: 0, originY: Math.round((spare / 2) * (1 + shift)), width, height: h };
}

/* ---------- the upload queue ---------- */

export const QUEUE_DONE = ['saved'];
// A short, unique id made on the phone for each saree, so a repeat save is recognised.
export const newRef = (prefix = 'sr') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
// After a network failure: 5 s, 10 s, 20 s … at most 2 minutes.
export const retryDelay = (attempts) => Math.min(120000, 5000 * 2 ** Math.max(0, attempts - 1));
// Errors the person has to fix (a different tag, another subcategory); anything else is retried.
export const NEEDS_FIX = new Set(['TAG_TAKEN', 'TAG_ON_THIS_SAREE', 'TOO_MANY_TAGS', 'TAG_MISSING', 'TAG_SOLD', 'TAG_RETIRED', 'TAG_INVALID', 'VALIDATION_FAILED', 'SUBCATEGORY_GONE', 'LIMIT_REACHED', 'PHOTO_UNREADABLE', 'PHOTO_TYPE', 'PHOTO_TOO_LARGE', 'PHOTO_LOST']);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
