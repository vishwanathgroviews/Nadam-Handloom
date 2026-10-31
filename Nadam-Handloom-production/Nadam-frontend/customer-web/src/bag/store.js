// The bag (W5, docs/modules/web-03-cart.md section 6). One store for the whole website:
// - a visitor's bag is kept in this browser (localStorage "nh-bag-v1"; for this visit only when
//   the browser won't save) and checked by the server (POST /bag/check), which keeps nothing;
// - a signed-in customer's bag is kept in the account (/me/bag). This browser keeps a copy so
//   it shows at once and offline, and forgets it when the sign-in ends (rule 10);
// - at sign-in the visitor's bag joins the account's (rule 9);
// - the old website's bag (NANDAM_CART_V1) is brought in once (rule 14);
// - tabs keep in step through the storage event (rule 12).
// Nothing here holds a saree: payment does that (W6). After a payment the server takes the
// bought sarees out of the bag; the checkout asks for the bag again.
import { shopApi } from '../api/shop.js';
import { ApiError } from '../api/errors.js';
import { authStore } from '../auth/session.js';

export const KEY = 'nh-bag-v1';
export const OLD_KEY = 'NANDAM_CART_V1';
export const MAX_LINES = 20;
export const MAX_QUANTITY = 50;
const RECHECK_AFTER_MS = 60_000; // back to a tab after this long: check again (rule 4)
const SLUG = /^[A-Za-z0-9-]{1,160}$/;

/* ---------- State ---------- */
const EMPTY = {
  owner: 'guest', // whose bag this browser shows: guest | account
  items: [], // [{ slug, quantity, priceSeen, addedAt, name, sku, photo }] newest last
  pending: [], // old-website sarees waiting to join a signed-in bag
  checked: null, // the server's last answer for this bag
  status: 'idle', // idle | checking | ready | error
  error: null,
  checkedAt: 0,
  storable: true,
  notice: null, // one message: { kind: 'old' | 'joined' | 'signedOut' | 'dropped', ... }
  panel: null, // the side panel: null, or { added: slug | null }
  sent: false, // "Sent on WhatsApp?" on the bag page
  whatsapp: false, // the "Send bag on WhatsApp" pop-up is open
  lastRemoved: null, // for Undo: { item, index }
  bumpAt: 0, // when the header's number last went up (it bounces)
};
let state = { ...EMPTY };
const subscribers = new Set();
function set(patch) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}
export const bagStore = {
  subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
  get: () => state,
};

// The one-time message lasts for this visit (this tab), so a reload doesn't lose it.
const NOTICE_KEY = 'nh-bag-notice';
const NOTICE_KINDS = ['old', 'joined', 'signedOut', 'dropped'];
function notify(notice) {
  set({ notice });
  try {
    if (notice) sessionStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
    else sessionStorage.removeItem(NOTICE_KEY);
  } catch { /* private mode: for this page only */ }
}
function keptNotice() {
  try {
    const n = JSON.parse(sessionStorage.getItem(NOTICE_KEY) || 'null');
    if (!n || !NOTICE_KINDS.includes(n.kind)) return null;
    const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 100 ? v : 0);
    return { kind: n.kind, count: count(n.count), fromAccount: count(n.fromAccount), moreOf: count(n.moreOf), skipped: count(n.skipped), firstName: typeof n.firstName === 'string' ? n.firstName.slice(0, 60) : '' };
  } catch {
    return null;
  }
}

/* ---------- What this browser keeps ---------- */
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const url = (v) => (typeof v === 'string' && /^(https:\/\/|\/)/.test(v) ? v.slice(0, 600) : null);

// A line from storage, an old bag or another tab: anything odd is dropped, never trusted.
export function cleanItem(x) {
  if (!x || typeof x !== 'object' || typeof x.slug !== 'string' || !SLUG.test(x.slug)) return null;
  const quantity = Number(x.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const price = Number(x.priceSeen);
  const photoUrl = url(x.photo?.url);
  return {
    slug: x.slug,
    quantity: Math.min(quantity, MAX_QUANTITY),
    priceSeen: Number.isFinite(price) && price >= 0 ? Math.round(price) : null,
    addedAt: str(x.addedAt, 40) || new Date().toISOString(),
    name: str(x.name, 200),
    sku: str(x.sku, 40),
    photo: photoUrl ? { url: photoUrl, alt: str(x.photo?.alt, 200) || str(x.name, 200) || '' } : null,
  };
}

// The same saree twice (two tabs, an old bag): one line with the larger number; at most 20.
export function joinItems(...lists) {
  const by = new Map();
  for (const it of lists.flat()) {
    const had = by.get(it.slug);
    if (!had) by.set(it.slug, it);
    else if (it.quantity > had.quantity) by.set(it.slug, { ...had, quantity: it.quantity });
  }
  return [...by.values()].slice(0, MAX_LINES);
}

function readStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    const clean = (list) => (Array.isArray(list) ? joinItems(list.map(cleanItem).filter(Boolean)) : []);
    return { owner: data?.owner === 'account' ? 'account' : 'guest', items: clean(data?.items), pending: clean(data?.pending), storable: true };
  } catch {
    return { owner: 'guest', items: [], pending: [], storable: false };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, owner: state.owner, items: state.items, pending: state.pending }));
    if (!state.storable) set({ storable: true });
  } catch {
    // Private browsing or full storage: the bag lasts for this visit (rule 13).
    if (state.storable) set({ storable: false });
  }
}

// The old website kept its bag here: one line per saree, one piece each.
export function readOldBag() {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (raw == null) return null;
    localStorage.removeItem(OLD_KEY);
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((o) => cleanItem({ slug: o?.slug, quantity: 1, priceSeen: o?.price, name: o?.name, photo: o?.image ? { url: o.image, alt: o?.name } : null })).filter(Boolean);
  } catch {
    return null;
  }
}

/* ---------- Server answers ---------- */
const wire = (it) => ({ slug: it.slug, quantity: it.quantity, ...(it.priceSeen != null ? { priceSeen: it.priceSeen } : {}) });

function snapshot(line, had) {
  return {
    slug: line.slug,
    quantity: line.quantity > 0 ? line.quantity : (had?.quantity ?? line.asked ?? 1),
    priceSeen: had?.priceSeen ?? line.price ?? null,
    addedAt: had?.addedAt || new Date().toISOString(),
    name: line.name ?? had?.name ?? null,
    sku: line.sku ?? had?.sku ?? null,
    photo: line.photo ?? had?.photo ?? null,
  };
}

// A visitor's bag after a check: links that never existed go (with a note), fewer pieces left
// lowers the number (rule 7), and the name and photo kept for each saree are brought up to date.
function applyCheck(res) {
  const lines = new Map(res.items.map((l) => [l.slug, l]));
  const dropped = state.items.filter((it) => lines.get(it.slug)?.state === 'not_found');
  const items = state.items
    .filter((it) => lines.get(it.slug)?.state !== 'not_found')
    .map((it) => {
      const l = lines.get(it.slug);
      if (!l || l.state === 'unavailable') return it;
      return { ...snapshot(l, it), quantity: l.state === 'fewer' ? l.quantity : it.quantity };
    });
  set({ items, checked: res, status: 'ready', error: null, checkedAt: Date.now() });
  if (dropped.length) notify({ kind: 'dropped', count: dropped.length });
  save();
}

// A signed-in bag: the server's answer is the bag.
function applyAccount(res) {
  const had = new Map(state.items.map((it) => [it.slug, it]));
  const items = res.items.filter((l) => l.state !== 'not_found').map((l) => {
    const s = snapshot(l, had.get(l.slug));
    return { ...s, quantity: l.quantity > 0 ? l.quantity : l.asked, priceSeen: l.priceWas ?? l.price ?? s.priceSeen };
  });
  set({ owner: 'account', items, pending: [], checked: res, status: 'ready', error: null, checkedAt: Date.now() });
  save();
}

const signedIn = () => authStore.get().status === 'signedIn';
const isAccount = () => state.owner === 'account' && signedIn();

// "The customer has seen today's prices": a change clears the "price changed" notes (rule 5).
function acknowledged(items) {
  const lines = new Map((state.checked?.items || []).map((l) => [l.slug, l]));
  return items.map((it) => {
    const l = lines.get(it.slug);
    return l?.price != null ? { ...it, priceSeen: l.price } : it;
  });
}

/* ---------- Checking (rule 4) ---------- */
let inFlight = null;
let edits = 0; // local changes; a check sent before the latest change is followed by another
const edited = () => { edits += 1; };
export function refresh() {
  if (inFlight) return inFlight;
  // Signing in: the bags are being joined; a visitor's check now would answer for the visitor's
  // sarees only and could land after the joined bag (the account's sarees then look unknown).
  if (joining) return joining;
  if (state.owner === 'account' && !signedIn()) return Promise.resolve(); // waiting for the sign-in
  if (!isAccount() && !state.items.length) {
    set({ checked: null, status: 'ready', error: null, checkedAt: Date.now() });
    return Promise.resolve();
  }
  set({ status: 'checking' });
  const sent = edits;
  const job = isAccount() ? shopApi.bag().then(applyAccount) : shopApi.bagCheck(state.items.map(wire)).then(applyCheck);
  inFlight = job
    .catch((error) => set({ status: 'error', error }))
    .finally(() => {
      inFlight = null;
      if (edits !== sent && !isAccount()) refresh();
    });
  return inFlight;
}
// Checked recently enough to show without asking again?
export const isFresh = () => state.status === 'ready' && Date.now() - state.checkedAt < RECHECK_AFTER_MS;

/* ---------- Changes ---------- */
export class BagFullError extends ApiError {
  constructor() {
    super({ status: 409, code: 'BAG_FULL', message: `Your bag is full (${MAX_LINES} sarees). Remove one to add another.`, details: { maxLines: MAX_LINES } });
  }
}
const find = (slug) => state.items.find((it) => it.slug === slug) || null;
export const quantityOf = (slug) => find(slug)?.quantity ?? 0;

// Adds pieces of a saree (from its page: { slug, sku, name, price, available, photo }).
// Opens the side panel. Throws an ApiError the page shows (BAG_FULL, SOLD_OUT, NOT_ON_WEBSITE).
export async function add(saree, pieces = 1) {
  const had = find(saree.slug);
  if (!had && state.items.length >= MAX_LINES) throw new BagFullError();
  const quantity = Math.min(Math.max(1, saree.available || 1), MAX_QUANTITY, (had?.quantity || 0) + pieces);
  const line = {
    slug: saree.slug, quantity, priceSeen: Math.round(saree.price), addedAt: had?.addedAt || new Date().toISOString(),
    name: saree.name, sku: saree.sku, photo: saree.photo ? { url: saree.photo.url, alt: saree.photo.alt || saree.name } : null,
  };
  if (isAccount()) {
    applyAccount(await shopApi.bagSet(saree.slug, quantity, line.priceSeen));
  } else {
    const items = acknowledged(state.items);
    set({ items: had ? items.map((it) => (it.slug === saree.slug ? line : it)) : [...items, line] });
    edited();
    save();
    refresh();
  }
  set({ panel: { added: saree.slug }, bumpAt: Date.now(), lastRemoved: null });
}

export async function setQuantity(slug, quantity) {
  const q = Math.max(1, Math.min(MAX_QUANTITY, Math.round(quantity)));
  if (isAccount()) return applyAccount(await shopApi.bagSet(slug, q));
  set({ items: acknowledged(state.items).map((it) => (it.slug === slug ? { ...it, quantity: q } : it)) });
  edited();
  save();
  return refresh();
}

export async function remove(slug) {
  const index = state.items.findIndex((it) => it.slug === slug);
  if (index < 0) return;
  const item = state.items[index];
  if (isAccount()) {
    applyAccount(await shopApi.bagRemove(slug));
  } else {
    set({ items: acknowledged(state.items.filter((it) => it.slug !== slug)) });
    edited();
    save();
    refresh();
  }
  set({ lastRemoved: { item, index } });
}

// Puts back the saree just removed, in its place, with its number and the price it showed.
export async function undo() {
  const r = state.lastRemoved;
  if (!r) return;
  set({ lastRemoved: null });
  if (isAccount()) {
    applyAccount(await shopApi.bagSet(r.item.slug, r.item.quantity, r.item.priceSeen));
    return;
  }
  if (find(r.item.slug)) return;
  const items = [...state.items];
  items.splice(Math.min(r.index, items.length), 0, r.item);
  set({ items: items.slice(0, MAX_LINES) });
  edited();
  save();
  refresh();
}

export async function clear() {
  if (isAccount()) applyAccount(await shopApi.bagClear());
  else { set({ items: [], checked: null }); edited(); save(); }
  set({ sent: false, lastRemoved: null });
}

// The bag the server answered with (Pay stopped: something changed, or nothing to buy).
export function takeServerBag(res) {
  if (res && isAccount()) applyAccount(res);
}

// Buy again (W7): the server puts the order's sarees in the account's bag by the bag's rules and
// answers the bag, with what was added, raised, already there or skipped. Opens the side panel
// when the bag has any of them.
export async function buyAgain(number) {
  const res = await shopApi.buyAgain(number);
  applyAccount(res);
  const r = res.buyAgain || { added: [], raised: [], already: [], skipped: [] };
  if (r.added.length || r.raised.length || r.already.length) set({ panel: { added: null }, bumpAt: Date.now(), lastRemoved: null });
  return r;
}

export const openPanel = (added = null) => set({ panel: { added } });
export const closePanel = () => set({ panel: null });
export const setSent = (sent) => set({ sent });
export const openWhatsApp = () => set({ whatsapp: true, panel: null });
export const closeWhatsApp = () => set({ whatsapp: false });
export const dismissNotice = () => notify(null);

/* ---------- Signing in and out ---------- */
let joining = null;
// Signed in: the visitor's bag (and an old website's bag) joins the account's (rule 9).
function joinAccount() {
  if (joining) return joining;
  const guest = state.owner === 'guest' ? state.items : [];
  const toJoin = joinItems(guest, state.pending);
  set({ status: 'checking' });
  joining = (toJoin.length ? shopApi.bagMerge(toJoin.map(wire)) : shopApi.bag())
    .then((res) => {
      const before = new Map(toJoin.map((it) => [it.slug, it.quantity]));
      applyAccount(res);
      if (!toJoin.length) return;
      // Told from what the customer sees: sarees that came from the account, sarees that now
      // have more pieces (chosen before on another device), and sarees that couldn't join.
      const lines = res.items.filter((l) => l.state !== 'not_found');
      const fromAccount = lines.filter((l) => !before.has(l.slug)).length;
      const moreOf = lines.filter((l) => before.has(l.slug) && l.quantity > before.get(l.slug)).length;
      const skipped = res.joined?.skipped || 0;
      if (fromAccount || moreOf || skipped) notify({ kind: 'joined', fromAccount, moreOf, skipped, firstName: (authStore.get().customer?.fullName || '').split(' ')[0] });
    })
    .catch((error) => set({ status: 'error', error }))
    .finally(() => { joining = null; });
  return joining;
}

// The sign-in ended (sign-out here or everywhere, or the shop ended it): forget the account's
// bag on this browser; it stays in the account (rule 10).
function forgetAccount() {
  const had = state.owner === 'account' && state.items.length > 0;
  set({ owner: 'guest', items: [], pending: [], checked: null, status: 'idle', error: null, panel: null, whatsapp: false, sent: false, lastRemoved: null });
  // Never leave the last customer's "Welcome back, <name>" for the next person on this browser.
  if (had) notify({ kind: 'signedOut' });
  else if (state.notice?.kind === 'joined') notify(null);
  save();
}

/* ---------- Start ---------- */
let started = false;
export function startBag() {
  if (started) return;
  started = true;
  const kept = readStorage();
  const old = readOldBag();
  let { items, pending } = kept;
  let notice = keptNotice();
  if (old && old.length) {
    if (kept.owner === 'account') pending = joinItems(pending, old);
    else items = joinItems(items, old);
    notice = { kind: 'old', count: old.length };
  }
  set({ owner: kept.owner, items, pending, storable: kept.storable });
  notify(notice);
  if (old) save();

  // The first call handles the state at start: a copy of an account's bag left from a sign-in
  // that ended while the website was closed is forgotten too.
  let last = null;
  const onAuth = () => {
    const now = authStore.get().status;
    if (now === last) return;
    const was = last;
    last = now;
    if (now === 'signedIn') {
      // Signed in again (here or in another tab): "you're signed out" no longer applies.
      if (state.notice?.kind === 'signedOut') notify(null);
      joinAccount();
    }
    else if (now === 'signedOut' && (was === 'signedIn' || state.owner === 'account')) forgetAccount();
  };
  authStore.subscribe(onAuth);
  onAuth();

  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const next = readStorage();
    set({ owner: next.owner, items: next.items, pending: next.pending });
    if (state.checked) refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.items.length && Date.now() - state.checkedAt > RECHECK_AFTER_MS) refresh();
  });
  window.addEventListener('online', () => {
    if (state.status === 'error') {
      if (signedIn() && (state.owner === 'guest' ? state.items.length : state.pending.length)) joinAccount();
      else refresh();
    }
  });
}

// Tests only: start again from nothing.
export function resetBagForTests() {
  state = { ...EMPTY };
  started = false;
  inFlight = null;
  joining = null;
  edits = 0;
}
