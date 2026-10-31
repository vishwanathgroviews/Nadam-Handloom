// Catalogue rules: % off, price parsing, warnings, form checks, filters and search.
import { discountPercent, parseMoney, priceWarning, rupees, subcategoryFormErrors, categoryFormErrors, priceChanges, filterSubcategories, filterCounts, matchesSearch } from './catalog';

test('% off matches the website', () => {
  expect(discountPercent(16999, 2800)).toBe(84);
  expect(discountPercent(null, 2800)).toBe(0);
  expect(discountPercent(16999, 25888)).toBe(0);
});

test('money text', () => {
  expect(parseMoney(' ₹3,400 ')).toBe(3400);
  expect(parseMoney('')).toBeNull();
  expect(Number.isNaN(parseMoney('abc'))).toBe(true);
  expect(rupees(54310)).toBe('₹54,310');
  expect(rupees(null)).toBe('—');
});

test('price warnings: more than double, under half, under ₹100', () => {
  expect(priceWarning(3800, 54310)).toMatch(/More than double the old price \(14\.3×\)/);
  expect(priceWarning(5400, 540)).toMatch(/Less than half/);
  expect(priceWarning(120, 90)).toBe('Under ₹100.');
  expect(priceWarning(3400, 3600)).toBeNull();
  expect(priceWarning(null, 3600)).toBeNull();
});

test('subcategory form: names, prices, MRP above the website price', () => {
  const ok = { name: 'Rainbow checks', description: 'x', storePrice: 3400, websitePrice: 2800, mrp: 16999 };
  expect(subcategoryFormErrors(ok)).toEqual({});
  expect(subcategoryFormErrors({ ...ok, mrp: null })).toEqual({});
  expect(subcategoryFormErrors({ ...ok, mrp: 2800 }).mrp).toMatch(/higher than the website price \(₹2,800\)/);
  // Store price above the MRP: refused (equal is fine; no MRP: no check).
  expect(subcategoryFormErrors({ ...ok, storePrice: 54310, mrp: 16999 }).storePrice).toBe("Can't be above the MRP (₹16,999).");
  expect(subcategoryFormErrors({ ...ok, storePrice: 16999, mrp: 16999 }).storePrice).toBeUndefined();
  expect(subcategoryFormErrors({ ...ok, storePrice: 54310, mrp: null }).storePrice).toBeUndefined();
  // The live typo row: both wrong, both shown at once.
  expect(subcategoryFormErrors({ ...ok, storePrice: 54310, websitePrice: 25888, mrp: 16999 })).toMatchObject({ storePrice: "Can't be above the MRP (₹16,999).", mrp: expect.stringMatching(/higher than the website price/) });
  expect(subcategoryFormErrors({ ...ok, storePrice: 0 }).storePrice).toMatch(/more than ₹0/);
  expect(subcategoryFormErrors({ ...ok, storePrice: 1000001 }).storePrice).toMatch(/10,00,000/);
  expect(subcategoryFormErrors({ ...ok, storePrice: 10.555 }).storePrice).toMatch(/2 decimals/);
  expect(subcategoryFormErrors({ ...ok, websitePrice: null }).websitePrice).toMatch(/Enter the website price/);
  expect(subcategoryFormErrors({ ...ok, name: 'A', description: ' ' })).toMatchObject({ name: expect.any(String), description: expect.any(String) });
  expect(categoryFormErrors({ name: 'Silk', description: 'x' })).toEqual({});
});

test('the old → new check lists only changed prices, with warnings', () => {
  const c = priceChanges({ storePrice: 3400, websitePrice: 2800, mrp: 16999 }, { storePrice: 54310, websitePrice: 2800, mrp: 17999 });
  expect(c.map((x) => x.key)).toEqual(['storePrice', 'mrp']);
  expect(c[0].warning).toMatch(/More than double/);
  expect(c[1].warning).toBeNull();
});

test('filters and search', () => {
  const list = [
    { name: 'Rainbow checks sarees', showOnWebsite: true, hasPhoto: true, productCount: 36, storePrice: 3400, websitePrice: 2800, mrp: 16999 },
    { name: 'Plain cotton', showOnWebsite: false, hasPhoto: false, productCount: 0, storePrice: 999, websitePrice: 899, mrp: null },
  ];
  expect(filterCounts(list)).toEqual({ all: 2, hidden: 1, nophoto: 1, empty: 1 });
  expect(filterSubcategories(list, 'hidden').map((s) => s.name)).toEqual(['Plain cotton']);
  expect(list.filter((s) => matchesSearch(s, '  RAINBOW  ')).length).toBe(1);
  expect(list.filter((s) => matchesSearch(s, '2800')).map((s) => s.name)).toEqual(['Rainbow checks sarees']);
  expect(list.filter((s) => matchesSearch(s, '₹999')).map((s) => s.name)).toEqual(['Plain cotton']);
});
