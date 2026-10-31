// Every list API sends 20 at a time (owner's decision, 2026-10-12). For each of the 13:
// no page is longer than 20, the pages together hold every item exactly once, the
// answer's total matches, a smaller page size works, and asking for more than 20 is refused.
import { describe, it, expect, beforeAll } from 'vitest';
import { signedIn, authed, allPages } from '../support/helpers.js';
import { istYmd } from '../../src/utils/day.js';

let owner;
const O = (method, url) => authed(method, url, owner.session, owner.device);
const today = istYmd(new Date());
const V2 = '/api/v2';

beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Pager' });
});

async function checkList(path, key, { hasTotal = true } = {}) {
  const { items, pages, first } = await allPages(O, path, key);
  expect(pages.every((p) => p[key].length <= 20), `${path}: a page longer than 20`).toBe(true);
  expect(pages.slice(0, -1).every((p) => p[key].length === 20), `${path}: a short page before the last`).toBe(true);
  const ids = items.map((x) => x.id);
  expect(new Set(ids).size, `${path}: repeats across pages`).toBe(ids.length);
  if (hasTotal) expect(first.total, `${path}: total`).toBe(items.length);
  const small = await O('get', `${path}${path.includes('?') ? '&' : '?'}limit=5`);
  expect(small.status).toBe(200);
  expect(small.body[key].length).toBeLessThanOrEqual(5);
  const big = await O('get', `${path}${path.includes('?') ? '&' : '?'}limit=21`);
  expect(big.status, `${path}: limit 21 should be refused`).toBe(400);
  return items.length;
}

describe('20 at a time, on all 13 list APIs', () => {
  it('Products, Orders, Invoices (they had 40 / 30 / 30)', async () => {
    expect(await checkList(`${V2}/products?filter=all`, 'products', { hasTotal: false })).toBeGreaterThan(20);
    await checkList(`${V2}/products?q=saree`, 'products', { hasTotal: false }); // a search is paged too
    for (const tab of ['to_ship', 'shipped', 'delivered']) await checkList(`${V2}/orders?tab=${tab}`, 'orders', { hasTotal: false });
    await checkList(`${V2}/invoices?from=2020-01-01&to=${today}`, 'invoices', { hasTotal: false });
  });

  it('Team, My devices, Categories, Designs in a category, Design search', async () => {
    await checkList(`${V2}/team`, 'members');
    await checkList(`${V2}/team?tab=removed`, 'members');
    await checkList(`${V2}/me/devices`, 'devices');
    const { items: cats } = await allPages(O, `${V2}/catalog/categories`, 'categories');
    await checkList(`${V2}/catalog/categories`, 'categories');
    const biggest = [...cats].sort((a, b) => b.subcategoryCount - a.subcategoryCount)[0];
    expect(await checkList(`${V2}/catalog/categories/${biggest.id}`, 'subcategories')).toBe(biggest.subcategoryCount);
    expect(await checkList(`${V2}/catalog/subcategories`, 'subcategories')).toBeGreaterThan(20);
  });

  it('Today\'s sales, Sales without an invoice, Unpaid checkouts, People in the Activity filter (totals still cover everything)', async () => {
    await checkList(`${V2}/sales/today`, 'sales');
    const { items, first } = await allPages(O, `${V2}/invoices/without?from=2020-01-01&to=${today}`, 'sales');
    await checkList(`${V2}/invoices/without?from=2020-01-01&to=${today}`, 'sales');
    expect(first.totals.count).toBe(items.length);
    await checkList(`${V2}/orders/unpaid`, 'customers');
    await checkList(`${V2}/activity/people`, 'people');
  });

  it('Activity log: 20 lines a page, following the "next" mark', async () => {
    const pages = [(await O('get', `${V2}/activity?period=all`)).body];
    while (pages.length < 6 && pages[pages.length - 1].next) pages.push((await O('get', `${V2}/activity?period=all&before=${encodeURIComponent(pages[pages.length - 1].next)}`)).body);
    expect(pages[0].entries).toHaveLength(20);
    expect(pages.every((p) => p.entries.length <= 20)).toBe(true);
    const keys = pages.flatMap((p) => p.entries.map((e) => e.id));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
