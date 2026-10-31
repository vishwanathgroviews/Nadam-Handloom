// Module 10 (Activity log): the rules in plan sections 5, 6, 8 and 13.
// Most records are written into May 2021, which only these tests use.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { api, prisma, signedIn, authed } from '../support/helpers.js';
import { list, people, deleteOldSignIns, securityAlerts } from '../../src/services/activity.service.js';
import { summary } from '../../src/services/analytics.service.js';

const C = '/api/v2/catalog';
const AC = '/api/v2/activity';
const uid = () => crypto.randomUUID().slice(0, 8);
let seq = Math.floor(Math.random() * 100000) + 9000000;
const ist = (s) => new Date(`${s}+05:30`);
const NOW = ist('2021-06-01T10:00:00');
const MAY = { period: 'custom', from: '2021-05-01', to: '2021-05-31', now: NOW };
let owner;
let staff;
let sub;
let prod;
const O = (m, u) => authed(m, u, owner.session, owner.device);
const S = (m, u) => authed(m, u, staff.session, staff.device);
const ev = (eventType, { at, accountId = null, metadata = {} }) => prisma.authEvent.create({ data: { eventType, source: 'staff_app', authAccountId: accountId, createdAt: at, metadata } });
const texts = (r) => r.entries.map((e) => e.text);

beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Meena' });
  staff = await signedIn({ role: 'STAFF', name: 'Ravi' });
  const c = await O('post', `${C}/categories`).send({ name: `Cat ${uid()}`, description: 'Test category' });
  const s = await O('post', `${C}/categories/${c.body.category.id}/subcategories`).send({ name: `Kanchi ${uid()}`, description: 'Test', storePrice: 3800, websitePrice: 3200, mrp: 16999 });
  sub = { ...s.body.subcategory, category: c.body.category };
  const id = uid() + uid();
  prod = await prisma.product.create({ data: { slug: `t-${id}`, sku: `NH-TST-${seq}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true } });
  await prisma.piece.create({ data: { productId: prod.id, barcode: `NH${seq++}`, status: 'in_stock' } });
  const o = owner.account.id;
  const st = staff.account.id;
  // A price change (important), as the new app writes it.
  await ev('subcategory_price_changed', { at: ist('2021-05-10T16:31:00'), accountId: o, metadata: { api: 'v2', subcategoryId: sub.id, actorId: o, before: { storePrice: '3800', onlinePrice: '3200', mrp: '16999' }, after: { storePrice: '54310', onlinePrice: '3200', mrp: '16999' } } });
  // The old app's way: the actor in metadata.actorId; adding a saree and its photo in turns.
  for (let i = 0; i < 3; i += 1) {
    await ev('product_created', { at: ist(`2021-05-11T10:0${i * 2}:00`), accountId: st, metadata: { actorId: st, productId: prod.id, sku: prod.sku } });
    await ev('product_image_updated', { at: ist(`2021-05-11T10:0${i * 2 + 1}:00`), accountId: st, metadata: { actorId: st, productId: prod.id } });
  }
  // 30 minutes later: a new group.
  await ev('product_created', { at: ist('2021-05-11T10:40:00'), accountId: st, metadata: { actorId: st, productId: prod.id, sku: prod.sku } });
  // Sales are never grouped; a bargain under half the store price is important.
  await ev('sale_completed', { at: ist('2021-05-12T19:00:00'), accountId: st, metadata: { api: 'v2', actorId: st, orderNumber: 'NH70000001', channel: 'store', paymentMethod: 'upi', total: 1500, sarees: 1, invoice: false } });
  await ev('sale_completed', { at: ist('2021-05-12T19:02:00'), accountId: st, metadata: { api: 'v2', actorId: st, orderNumber: 'NH70000002', channel: 'store', paymentMethod: 'cash', total: 3600, sarees: 1, invoice: true } });
  await ev('offline_sale_price_override', { at: ist('2021-05-12T19:00:01'), accountId: st, metadata: { api: 'v2', actorId: st, orderNumber: 'NH70000001', productId: prod.id, code: 'NH2264', categoryStorePrice: 3800, salePrice: 1500 } });
  await ev('offline_sale_price_override', { at: ist('2021-05-12T19:02:01'), accountId: st, metadata: { api: 'v2', actorId: st, orderNumber: 'NH70000002', productId: prod.id, code: 'NH2265', categoryStorePrice: 3800, salePrice: 3000 } });
  // Team: the person acted on in authAccountId, the owner in byUserId.
  await ev('admin_changed_role', { at: ist('2021-05-13T11:05:00'), accountId: st, metadata: { api: 'v2', from: 'ADMIN', to: 'STAFF', byUserId: o } });
  // Sign-in, with a locked PIN (important).
  await ev('login_success', { at: ist('2021-05-14T09:58:00'), accountId: o, metadata: { api: 'v2', method: 'pin' } });
  await ev('login_locked', { at: ist('2021-05-14T10:15:00'), accountId: st, metadata: { api: 'v2' } });
  // A website customer's record is never shown.
  await prisma.authEvent.create({ data: { eventType: 'login_success', source: 'customer_web', authAccountId: o, createdAt: ist('2021-05-14T11:00:00'), metadata: {} } });
});

describe('who can open Activity (6.1)', () => {
  it('Owners only; the server refuses staff; bad filters are refused', async () => {
    expect((await api().get(AC)).status).toBe(401);
    expect((await S('get', AC)).status).toBe(403);
    expect((await S('get', `${AC}/people`)).status).toBe(403);
    const r = await O('get', `${AC}?period=7d`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('entries');
    expect((await O('get', `${AC}?kind=nope`)).status).toBe(400);
    expect((await O('get', `${AC}?period=custom`)).status).toBe(400);
    expect((await O('get', `${AC}?before=drop table`)).status).toBe(400);
  });
});

describe('plain sentences, important marks and grouping (6.4, 6.5, 6.7)', () => {
  it('Each kind reads as one sentence with its details; website records are left out', async () => {
    const r = await list(MAY);
    const all = texts(r);
    expect(all).toContain(`Meena Person changed the store price of ${sub.name}: ₹3,800 → ₹54,310`);
    expect(all).toContain('Ravi Person sold 1 saree for ₹1,500 (UPI)');
    expect(all).toContain(`Ravi Person sold ${sub.name} NH2264 for ₹1,500, below half its store price ₹3,800`);
    expect(all).toContain(`Ravi Person sold ${sub.name} NH2265 for ₹3,000 (store price ₹3,800)`);
    expect(all).toContain('Meena Person changed Ravi Person\'s role: Owner → Staff');
    expect(all).toContain('Ravi Person\'s PIN was locked after too many wrong tries');
    expect(all.filter((t) => t === 'Meena Person signed in')).toHaveLength(1);
    const price = r.entries.find((e) => e.type === 'subcategory_price_changed');
    expect(price).toMatchObject({ kind: 'prices', important: true, day: '2021-05-10', time: '4:31 pm', link: { type: 'design', id: sub.id }, actor: { id: owner.account.id, role: 'owner' } });
    expect(price.details).toEqual(expect.arrayContaining([['Store price', '₹3,800 → ₹54,310'], ['Note', 'The store price is above the MRP: check it']]));
    const role = r.entries.find((e) => e.type === 'admin_changed_role');
    expect(role).toMatchObject({ kind: 'team', important: true, actor: { id: owner.account.id }, link: { type: 'person', id: staff.account.id } });
    expect(r.entries.find((e) => e.text.includes('NH2265')).important).toBe(false);
    expect(r.entries.find((e) => e.text.includes('NH2264')).important).toBe(true);
  });

  it('Adding sarees and their photos, minutes apart, is one line; a long gap starts another; sales stay apart', async () => {
    const r = await list(MAY);
    const groups = r.entries.filter((e) => e.group);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 6, text: `Ravi Person added 3 sarees to ${sub.name} with 3 photos`, time: '10:00 am–10:05 am', kind: 'products' });
    expect(groups[0].items).toHaveLength(6);
    expect(texts(r)).toContain(`Ravi Person added ${sub.name} ${prod.sku}`);
    expect(r.entries.filter((e) => e.type === 'sale_completed')).toHaveLength(2);
    // Newest first.
    const ats = r.entries.map((e) => e.at);
    expect([...ats].sort().reverse()).toEqual(ats);
  });
});

describe('filters, search and pages (6.6)', () => {
  it('Kind, person (the doer, also for team records), Important only', async () => {
    expect(texts(await list({ ...MAY, kind: 'prices' }))).toEqual([`Meena Person changed the store price of ${sub.name}: ₹3,800 → ₹54,310`]);
    const mine = await list({ ...MAY, person: owner.account.id });
    expect(mine.entries.map((e) => e.type).sort()).toEqual(['admin_changed_role', 'login_success', 'subcategory_price_changed']);
    const imp = await list({ ...MAY, important: true });
    expect(imp.entries.map((e) => e.type).sort()).toEqual(['admin_changed_role', 'login_locked', 'offline_sale_price_override', 'subcategory_price_changed']);
  });

  it('Search by design name, tag, order number or person', async () => {
    expect(texts(await list({ ...MAY, q: sub.name.slice(0, 10) })).length).toBeGreaterThanOrEqual(4);
    expect(texts(await list({ ...MAY, q: 'NH2264' }))).toEqual([`Ravi Person sold ${sub.name} NH2264 for ₹1,500, below half its store price ₹3,800`]);
    expect(texts(await list({ ...MAY, q: 'NH70000002' })).length).toBe(2);
    expect((await list({ ...MAY, q: 'Meena' })).entries.length).toBeGreaterThanOrEqual(3);
    expect((await list({ ...MAY, q: 'zzzz-nothing' })).entries).toEqual([]);
  });

  it('Pages of 20 lines follow on without gaps or repeats', async () => {
    const at = ist('2021-04-10T12:00:00');
    for (let i = 0; i < 65; i += 1) await ev('login_failed', { at: new Date(at.getTime() - i * 60000 * 30), accountId: staff.account.id, metadata: { api: 'v2' } });
    const q = { period: 'custom', from: '2021-04-01', to: '2021-04-30', now: NOW };
    const pages = [await list(q)];
    while (pages[pages.length - 1].next) pages.push(await list({ ...q, before: pages[pages.length - 1].next }));
    expect(pages.map((p) => p.entries.length)).toEqual([20, 20, 20, 5]);
    const ids = pages.flatMap((p) => p.entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(65);
    const r = await O('get', `${AC}?period=custom&from=2021-04-01&to=2021-04-30&before=${encodeURIComponent(pages[2].next)}`);
    expect(r.body.entries).toHaveLength(5);
    expect(r.body.next).toBeNull();
  });

  it('The person list has everyone who did something, 20 at a time', async () => {
    const pages = [await people()];
    while (pages[pages.length - 1].nextOffset != null) pages.push(await people({ offset: pages[pages.length - 1].nextOffset }));
    expect(pages.every((p) => p.people.length <= 20)).toBe(true);
    const ids = pages.flatMap((p) => p.people.map((x) => x.id));
    expect(ids).toHaveLength(pages[0].total);
    expect(ids).toEqual(expect.arrayContaining([owner.account.id, staff.account.id]));
    expect((await O('get', '/api/v2/activity/people?limit=21')).status).toBe(400);
  });
});

describe('keeping records (6.2) and security alerts (6.8)', () => {
  it('Sign-in records over a year old are removed; sales and prices are kept', async () => {
    const old = new Date(Date.now() - 400 * 86400000);
    const a = await ev('login_success', { at: old, accountId: staff.account.id, metadata: { api: 'v2' } });
    const b = await ev('subcategory_price_changed', { at: old, accountId: owner.account.id, metadata: { api: 'v2', subcategoryId: sub.id, before: {}, after: {} } });
    const c = await ev('sale_completed', { at: old, accountId: staff.account.id, metadata: { api: 'v2', total: 10 } });
    expect(await deleteOldSignIns()).toBeGreaterThanOrEqual(1);
    expect(await prisma.authEvent.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await prisma.authEvent.findUnique({ where: { id: b.id } })).not.toBeNull();
    expect(await prisma.authEvent.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  it('A locked PIN in the last 24 hours shows on owners\' Home only', async () => {
    const before = (await O('get', '/api/v2/home')).body.attention.security;
    await ev('login_locked', { at: new Date(), accountId: staff.account.id, metadata: { api: 'v2' } });
    const s = await securityAlerts();
    expect(s.text).toBe('Ravi Person\'s PIN was locked after too many wrong tries');
    const home = (await O('get', '/api/v2/home')).body.attention.security;
    expect(home.count - (before?.count ?? 0)).toBe(1);
    expect((await S('get', '/api/v2/home')).body.attention.security).toBeNull();
  });
});

describe('the store price on each sale line (6.3)', () => {
  it('A sale keeps each line\'s store price; Analytics\' bargains survive without the log', async () => {
    const pc = await prisma.piece.create({ data: { productId: prod.id, barcode: `NH${seq++}`, status: 'in_stock' } });
    const pc2 = await prisma.piece.create({ data: { productId: (await prisma.product.create({ data: { slug: `t-${uid()}${uid()}`, sku: `NH-TST-${seq++}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true } })).id, barcode: `NH${seq++}`, status: 'in_stock' } });
    const r = await S('post', '/api/v2/sales').send({ clientRef: `bill-${uid()}${uid()}`, lines: [{ pieceId: pc.id, price: 1500, storePrice: 3800 }, { pieceId: pc2.id, price: 3800, storePrice: 3800 }], channel: 'store', paymentMethod: 'cash', invoice: false });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const items = await prisma.orderItem.findMany({ where: { orderId: r.body.sale.id }, orderBy: { lineNo: 'asc' } });
    expect(items.map((i) => Number(i.storePrice))).toEqual([3800, 3800]);
    // The old server deletes the bargain record after 30 days: the sale still knows.
    await prisma.authEvent.deleteMany({ where: { eventType: 'offline_sale_price_override', metadata: { path: ['orderId'], equals: r.body.sale.id } } });
    const today = await summary({ period: 'today', channel: 'store' });
    expect(today.bargains.store - today.bargains.sold).toBeGreaterThanOrEqual(2300);
    const sale = await S('get', `/api/v2/sales/${r.body.sale.id}`);
    expect(sale.body.sale.lines[0]).toMatchObject({ price: 1500, storePrice: 3800 });
    expect(sale.body.sale.savings).toBe(2300);
  });
});
