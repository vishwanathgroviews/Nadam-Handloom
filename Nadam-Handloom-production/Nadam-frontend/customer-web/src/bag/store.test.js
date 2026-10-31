// The bag store (W5, docs/modules/web-03-cart.md section 6): what the browser keeps, the old
// website's bag, adding and its limits, checks, signing in and out, private browsing, Undo,
// and the WhatsApp message. The server and the sign-in are stand-ins here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ bagCheck: vi.fn(), bag: vi.fn(), bagSet: vi.fn(), bagRemove: vi.fn(), bagMerge: vi.fn(), bagClear: vi.fn() }));
const auth = vi.hoisted(() => {
  let state = { status: 'signedOut', customer: null };
  const subs = new Set();
  return {
    authStore: { get: () => state, subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); } },
    setAuth(patch) { state = { ...state, ...patch }; subs.forEach((fn) => fn()); },
    reset() { state = { status: 'signedOut', customer: null }; subs.clear(); },
  };
});
vi.mock('../api/shop.js', () => ({ shopApi: api }));
vi.mock('../auth/session.js', () => ({ authStore: auth.authStore }));

const store = await import('./store.js');
const { bagLines, bagTotals } = await import('./useBag.js');
const { bagMessage, similarMessage } = await import('./message.js');

const flush = () => new Promise((r) => { setTimeout(r, 0); });
const saree = (slug, price = 2700, available = 1) => ({ slug, sku: `NH-${slug.toUpperCase()}`, name: `Saree ${slug}`, price, available, photo: { url: `https://example.test/${slug}.jpg`, alt: slug } });
const okLine = (slug, quantity, price = 2700, extra = {}) => ({ slug, sku: `NH-${slug.toUpperCase()}`, name: `Saree ${slug}`, photo: null, price, priceWas: null, available: Math.max(quantity, 1), asked: quantity, quantity, lineTotal: quantity * price, state: 'ok', ...extra });
const answer = (items, extra = {}) => ({ items, totals: {}, changes: {}, maxLines: 20, checkedAt: new Date().toISOString(), ...extra });
const kept = () => JSON.parse(localStorage.getItem(store.KEY));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  auth.reset();
  store.resetBagForTests();
  Object.values(api).forEach((f) => f.mockReset());
  api.bagCheck.mockImplementation(async (items) => answer(items.map((i) => okLine(i.slug, i.quantity, i.priceSeen ?? 2700))));
});

describe('what the browser keeps', () => {
  it('drops anything odd and caps the pieces', () => {
    expect(store.cleanItem({ slug: 'drop table;', quantity: 1 })).toBeNull();
    expect(store.cleanItem({ slug: 'ok-1', quantity: 0 })).toBeNull();
    expect(store.cleanItem({ slug: 'ok-1', quantity: 1.5 })).toBeNull();
    expect(store.cleanItem({ slug: 'ok-1', quantity: 99 }).quantity).toBe(50);
    expect(store.cleanItem({ slug: 'ok-1', quantity: 1, photo: { url: 'javascript:alert(1)' } }).photo).toBeNull();
    expect(store.cleanItem({ slug: 'ok-1', quantity: 1, priceSeen: 2799.6 }).priceSeen).toBe(2800);
  });

  it('the same saree twice is one line with the larger number; at most 20 lines', () => {
    const a = store.cleanItem({ slug: 'a', quantity: 2 });
    const a3 = store.cleanItem({ slug: 'a', quantity: 3 });
    expect(store.joinItems([a], [a3])).toEqual([{ ...a, quantity: 3 }]);
    const many = Array.from({ length: 25 }, (_, i) => store.cleanItem({ slug: `s-${i}`, quantity: 1 }));
    expect(store.joinItems(many)).toHaveLength(20);
  });
});

describe('the old website\'s bag (rule 14)', () => {
  it('is brought in once, one piece each, and the old key removed', async () => {
    localStorage.setItem(store.OLD_KEY, JSON.stringify([
      { productId: 'x', slug: 'old-1', name: 'Old saree', price: 4200, image: 'https://example.test/o.jpg', quantity: 3 },
      { slug: 'bad slug!', name: 'Broken' },
    ]));
    store.startBag();
    expect(localStorage.getItem(store.OLD_KEY)).toBeNull();
    const s = store.bagStore.get();
    expect(s.items).toEqual([expect.objectContaining({ slug: 'old-1', quantity: 1, priceSeen: 4200, name: 'Old saree' })]);
    expect(s.notice).toEqual({ kind: 'old', count: 1 });
    expect(kept().items).toHaveLength(1);
  });

  it('a broken old bag is just removed', () => {
    localStorage.setItem(store.OLD_KEY, '{not json');
    store.startBag();
    expect(localStorage.getItem(store.OLD_KEY)).toBeNull();
    expect(store.bagStore.get().items).toEqual([]);
  });
});

describe('a visitor adds and changes', () => {
  it('adds, opens the side panel, keeps it in the browser and asks the server to check', async () => {
    store.startBag();
    await store.add(saree('one', 5800));
    await flush();
    const s = store.bagStore.get();
    expect(s.panel).toEqual({ added: 'one' });
    expect(kept().items).toEqual([expect.objectContaining({ slug: 'one', quantity: 1, priceSeen: 5800, sku: 'NH-ONE' })]);
    expect(api.bagCheck).toHaveBeenCalledWith([{ slug: 'one', quantity: 1, priceSeen: 5800 }]);
    expect(s.status).toBe('ready');
  });

  it('a set: never more than in stock; more of it later adds up', async () => {
    store.startBag();
    await store.add(saree('set', 2700, 5), 3);
    await store.add(saree('set', 2700, 5), 4);
    expect(store.quantityOf('set')).toBe(5);
  });

  it('at most 20 different sarees', async () => {
    store.startBag();
    for (let i = 0; i < 20; i += 1) await store.add(saree(`s-${i}`));
    await expect(store.add(saree('s-20'))).rejects.toMatchObject({ code: 'BAG_FULL', message: 'Your bag is full (20 sarees). Remove one to add another.' });
    await store.add(saree('s-0', 2700, 3)); // more of one already in the bag is fine
    expect(store.quantityOf('s-0')).toBe(2);
  });

  it('the check lowers a number when fewer are left, and drops links that never existed', async () => {
    store.startBag();
    await store.add(saree('set', 2700, 5), 4);
    await store.add(saree('ghost'));
    api.bagCheck.mockResolvedValueOnce(answer([okLine('set', 2, 2700, { state: 'fewer', asked: 4, available: 2 }), { slug: 'ghost', state: 'not_found', asked: 1, quantity: 0, lineTotal: 0, priceWas: null }]));
    await store.refresh();
    const s = store.bagStore.get();
    expect(s.items.map((i) => [i.slug, i.quantity])).toEqual([['set', 2]]);
    expect(s.notice).toEqual({ kind: 'dropped', count: 1 });
    const [line] = bagLines(s);
    expect(line).toMatchObject({ state: 'fewer', quantity: 2, fewerFrom: 4, available: 2, lineTotal: 5400 });
  });

  it('a new price is shown until the customer changes the bag', async () => {
    store.startBag();
    await store.add(saree('a', 2400));
    await store.add(saree('b', 3000));
    api.bagCheck.mockResolvedValueOnce(answer([okLine('a', 1, 2600, { priceWas: 2400 }), okLine('b', 1, 3000)]));
    await store.refresh();
    expect(bagLines(store.bagStore.get())[0]).toMatchObject({ price: 2600, priceWas: 2400 });
    await store.setQuantity('b', 1);
    expect(bagLines(store.bagStore.get())[0].priceWas).toBeNull();
    expect(kept().items[0].priceSeen).toBe(2600);
  });

  it('remove, then Undo puts it back in its place', async () => {
    store.startBag();
    await store.add(saree('a'));
    await store.add(saree('b'));
    await store.add(saree('c'));
    await store.remove('b');
    expect(store.bagStore.get().items.map((i) => i.slug)).toEqual(['a', 'c']);
    await store.undo();
    expect(store.bagStore.get().items.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
  });

  it('sold-out and gone sarees stay visible but are not counted', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    await store.add(saree('b', 3000));
    api.bagCheck.mockResolvedValueOnce(answer([okLine('a', 1, 2000, { state: 'sold_out', available: 0, quantity: 0, lineTotal: 0 }), { slug: 'b', state: 'unavailable', asked: 1, available: 0, quantity: 0, lineTotal: 0, priceWas: null }]));
    await store.refresh();
    const lines = bagLines(store.bagStore.get());
    expect(lines.map((l) => [l.slug, l.state, l.buyable])).toEqual([['a', 'sold_out', false], ['b', 'unavailable', false]]);
    expect(lines[1].name).toBe('Saree b'); // kept from when it was added
    expect(bagTotals(lines)).toMatchObject({ pieces: 0, amount: 0, out: 2 });
  });
});

describe('signing in and out', () => {
  it('signing in joins the visitor\'s bag into the account\'s', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    api.bagMerge.mockResolvedValueOnce(answer([okLine('a', 1, 2000), okLine('acct', 2, 3000)], { joined: { added: 1, raised: 0, skipped: 0 } }));
    auth.setAuth({ status: 'signedIn', customer: { fullName: 'Priya Sharma' } });
    await flush();
    expect(api.bagMerge).toHaveBeenCalledWith([{ slug: 'a', quantity: 1, priceSeen: 2000 }]);
    const s = store.bagStore.get();
    expect(s.owner).toBe('account');
    expect(s.items.map((i) => [i.slug, i.quantity])).toEqual([['a', 1], ['acct', 2]]);
    expect(s.notice).toMatchObject({ kind: 'joined', fromAccount: 1, moreOf: 0, skipped: 0, firstName: 'Priya' });
  });

  it('a brand-new customer\'s bag simply moves into the account: no message', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    api.bagMerge.mockResolvedValueOnce(answer([okLine('a', 1, 2000)], { joined: { added: 1, raised: 0, skipped: 0 } }));
    auth.setAuth({ status: 'signedIn', customer: { fullName: 'Anitha Reddy' } });
    await flush();
    expect(store.bagStore.get().notice).toBeNull();
  });

  it('a saree that can\'t join (sold since) is said to be left out', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    await store.add(saree('b', 2000));
    api.bagMerge.mockResolvedValueOnce(answer([okLine('a', 1, 2000)], { joined: { added: 1, raised: 0, skipped: 1 } }));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    expect(store.bagStore.get().notice).toMatchObject({ kind: 'joined', fromAccount: 0, moreOf: 0, skipped: 1 });
  });

  it('signed in with an empty browser bag: the account\'s bag is read, nothing joined', async () => {
    store.startBag();
    api.bag.mockResolvedValueOnce(answer([okLine('acct', 1)]));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    expect(api.bagMerge).not.toHaveBeenCalled();
    expect(store.bagStore.get().items.map((i) => i.slug)).toEqual(['acct']);
  });

  it('while signed in, changes go to the account', async () => {
    store.startBag();
    api.bag.mockResolvedValueOnce(answer([]));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    api.bagSet.mockResolvedValueOnce(answer([okLine('a', 1, 5800)]));
    await store.add(saree('a', 5800));
    expect(api.bagSet).toHaveBeenCalledWith('a', 1, 5800);
    expect(api.bagCheck).not.toHaveBeenCalled();
    api.bagSet.mockRejectedValueOnce(Object.assign(new Error('This saree has just sold out.'), { code: 'SOLD_OUT' }));
    await expect(store.add(saree('b'))).rejects.toMatchObject({ code: 'SOLD_OUT' });
  });

  it('a check asked for while the bags are being joined waits for the joining (never a visitor\'s answer over the account\'s bag)', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    await flush();
    let joined;
    api.bagMerge.mockReturnValueOnce(new Promise((r) => { joined = r; }));
    api.bagCheck.mockClear();
    auth.setAuth({ status: 'signedIn', customer: { fullName: 'Priya Sharma' } });
    const again = store.refresh(); // e.g. the checkout asks for the bag right after signing in
    joined(answer([okLine('a', 1, 2000), okLine('acct', 2, 3000)], { joined: { added: 1, raised: 0, skipped: 0 } }));
    await again;
    await flush();
    expect(api.bagCheck).not.toHaveBeenCalled();
    expect(store.bagStore.get().checked.items.map((l) => l.slug)).toEqual(['a', 'acct']);
  });

  it('signing out never leaves the last customer\'s "Welcome back, <name>" for the next person', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    api.bagMerge.mockResolvedValueOnce(answer([], { joined: { added: 0, raised: 0, skipped: 1 } }));
    auth.setAuth({ status: 'signedIn', customer: { fullName: 'Asha Rao' } });
    await flush();
    expect(store.bagStore.get().notice).toMatchObject({ kind: 'joined', firstName: 'Asha' });
    auth.setAuth({ status: 'signedOut', customer: null }); // her bag was empty: no "signed out" note
    expect(store.bagStore.get().notice).toBeNull();
    expect(sessionStorage.getItem('nh-bag-notice')).toBeNull();
  });

  it('signing out removes the bag from this browser (it stays in the account)', async () => {
    store.startBag();
    api.bag.mockResolvedValueOnce(answer([okLine('acct', 1)]));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    auth.setAuth({ status: 'signedOut' });
    const s = store.bagStore.get();
    expect(s).toMatchObject({ owner: 'guest', items: [], notice: { kind: 'signedOut' } });
    expect(kept()).toMatchObject({ owner: 'guest', items: [] });
  });

  it('signing in again clears "you\'re signed out", even when another tab did the joining', async () => {
    store.startBag();
    api.bag.mockResolvedValue(answer([okLine('acct', 1)]));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    auth.setAuth({ status: 'signedOut' });
    expect(store.bagStore.get().notice).toEqual({ kind: 'signedOut' });
    // Another tab joined the bags and saved the account's bag here: this tab only reads it.
    localStorage.setItem(store.KEY, JSON.stringify({ v: 1, owner: 'account', items: [{ slug: 'acct', quantity: 1 }] }));
    window.dispatchEvent(new StorageEvent('storage', { key: store.KEY }));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    expect(store.bagStore.get().notice).toBeNull();
    expect(api.bagMerge).not.toHaveBeenCalled();
  });

  it('an account\'s bag left from a sign-in that ended while the website was closed is forgotten', () => {
    localStorage.setItem(store.KEY, JSON.stringify({ v: 1, owner: 'account', items: [{ slug: 'acct', quantity: 1 }] }));
    store.startBag();
    expect(store.bagStore.get().items).toEqual([]);
  });

  it('an old website\'s bag found while signed in waits, then joins the account', async () => {
    localStorage.setItem(store.KEY, JSON.stringify({ v: 1, owner: 'account', items: [] }));
    localStorage.setItem(store.OLD_KEY, JSON.stringify([{ slug: 'old-1', price: 4200, name: 'Old' }]));
    auth.setAuth({ status: 'unknown' });
    store.startBag();
    expect(store.bagStore.get().pending.map((i) => i.slug)).toEqual(['old-1']);
    api.bagMerge.mockResolvedValueOnce(answer([okLine('old-1', 1, 4200)], { joined: { added: 1, raised: 0, skipped: 0 } }));
    auth.setAuth({ status: 'signedIn' });
    await flush();
    expect(api.bagMerge).toHaveBeenCalledWith([{ slug: 'old-1', quantity: 1, priceSeen: 4200 }]);
    expect(store.bagStore.get().pending).toEqual([]);
  });
});

describe('the one-time message', () => {
  it('survives a reload in the same tab, and goes once dismissed', async () => {
    store.startBag();
    await store.add(saree('a', 2000));
    api.bagMerge.mockResolvedValueOnce(answer([okLine('a', 1, 2000), okLine('acct', 1)], { joined: { added: 1, raised: 0, skipped: 0 } }));
    auth.setAuth({ status: 'signedIn', customer: { fullName: 'Priya Sharma' } });
    await flush();
    api.bag.mockResolvedValue(answer([okLine('a', 1, 2000), okLine('acct', 1)]));
    store.resetBagForTests(); // a reload
    store.startBag();
    expect(store.bagStore.get().notice).toMatchObject({ kind: 'joined', fromAccount: 1, firstName: 'Priya' });
    store.dismissNotice();
    store.resetBagForTests();
    store.startBag();
    expect(store.bagStore.get().notice).toBeNull();
  });
});

describe('private browsing (rule 13)', () => {
  it('the bag works for this visit when the browser won\'t save', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    store.startBag();
    await store.add(saree('a'));
    expect(store.bagStore.get().items).toHaveLength(1);
    expect(store.bagStore.get().storable).toBe(false);
    setItem.mockRestore();
  });
});

describe('the WhatsApp message (rule 15)', () => {
  it('lists the sarees that can be bought, with codes, pieces and the total', () => {
    const lines = [
      { slug: 'a', sku: 'NH-MHPS-1107', name: 'Pure Pattu 350k Butta Saree', price: 5800, quantity: 1, lineTotal: 5800, buyable: true },
      { slug: 'b', sku: 'NH-MHPS-1009', name: '150/50 Plain Saree', price: 2700, quantity: 2, lineTotal: 5400, buyable: true },
      { slug: 'c', sku: 'NH-X', name: 'Sold one', price: 3000, quantity: 1, lineTotal: 0, buyable: false },
    ];
    expect(bagMessage(lines, 'https://nandamhandlooms.com')).toBe("Hello Nandam Handlooms, I'd like to order these sarees from my bag:\n\n1. Pure Pattu 350k Butta Saree\n   Code NH-MHPS-1107 · 1 piece · ₹5,800\n   https://nandamhandlooms.com/product/a\n2. 150/50 Plain Saree\n   Code NH-MHPS-1009 · 2 pieces × ₹2,700 = ₹5,400\n   https://nandamhandlooms.com/product/b\n\nTotal: ₹11,200 (3 pieces, free delivery)");
  });

  it('links each saree on this website (WhatsApp shows the first one\'s photo)', () => {
    const one = [{ slug: 'pure-pattu-1', sku: 'NH-1', name: 'Pure Pattu', price: 5800, quantity: 1, lineTotal: 5800, buyable: true }];
    expect(bagMessage(one)).toContain(`\n   ${window.location.origin}/product/pure-pattu-1\n`);
    expect(similarMessage({ slug: 'gone-1', sku: 'NH-9', name: 'Gone' }, 'https://nandamhandlooms.com')).toBe('Hello Nandam Handlooms, this saree from my bag is no longer available. Do you have a similar one?\nGone\nCode: NH-9\nhttps://nandamhandlooms.com/product/gone-1');
  });
});
