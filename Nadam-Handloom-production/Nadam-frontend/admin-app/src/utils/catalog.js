// Catalogue rules and wording shared by the screens (docs Module 3, sections 5–7).
// The server checks the same rules; these give instant feedback while typing.

export const MAX_PRICE = 1000000;
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const INR_PAISE = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "₹3,400" / "₹2,999.50" (paise always as two digits); a dash for no value.
export function rupees(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Math.round(Number(v) * 100) / 100;
  return `₹${Number.isInteger(n) ? INR.format(n) : INR_PAISE.format(n)}`;
}

// Same as the website (customer-web utils/format.js).
export function discountPercent(mrp, price) {
  const m = Number(mrp);
  const p = Number(price);
  if (!m || m <= p) return 0;
  return Math.round(((m - p) / m) * 100);
}

// What a price box holds: null when empty, NaN when it isn't a number.
export function parseMoney(text) {
  const v = String(text ?? '').replace(/[₹,\s]/g, '');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
export const moneyText = (v) => (v == null ? '' : String(v));

// Warning for one price change (decision 5.4): more than doubles, drops by more than
// half, or goes under ₹100. Null when it looks normal.
export function priceWarning(from, to) {
  if (from == null || to == null || from === to) return null;
  if (to > from * 2) return `More than double the old price (${Math.round((to / from) * 10) / 10}×). Is this a typo?`;
  if (to < from / 2) return 'Less than half the old price. Is this a typo?';
  if (to < 100) return 'Under ₹100.';
  return null;
}

const cleanName = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
function nameProblem(name, max) {
  const n = cleanName(name);
  if (n.length < 2) return 'Enter a name of at least 2 letters.';
  if (n.length > max) return `Keep it under ${max} characters.`;
  if (/[<>]/.test(n)) return 'Remove the < > characters from the name.';
  return null;
}
const descProblem = (d) => (!String(d ?? '').trim() ? 'Add a short description: the website shows it.' : String(d).trim().length > 2000 ? 'Keep it under 2000 characters.' : null);
function priceProblem(v, label) {
  if (v == null) return `Enter the ${label}.`;
  if (Number.isNaN(v) || v <= 0) return 'Must be more than ₹0.';
  if (v > MAX_PRICE) return 'At most ₹10,00,000.';
  if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6) return 'Use at most 2 decimals.';
  return null;
}

export function categoryFormErrors({ name, description }) {
  const e = { name: nameProblem(name, 100), description: descProblem(description) };
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v));
}

export function subcategoryFormErrors({ name, description, storePrice, websitePrice, mrp }) {
  const e = {
    name: nameProblem(name, 150),
    description: descProblem(description),
    storePrice: priceProblem(storePrice, 'store price'),
    websitePrice: priceProblem(websitePrice, 'website price'),
  };
  if (mrp != null) {
    if (Number.isNaN(mrp) || mrp <= 0) e.mrp = 'Must be more than ₹0, or leave it empty.';
    else {
      if (websitePrice && !Number.isNaN(websitePrice) && mrp <= websitePrice) e.mrp = `MRP must be higher than the website price (${rupees(websitePrice)}), or leave it empty.`;
      // Refused, not warned (2026-10-12): a store price above the MRP is a typing mistake.
      if (!e.storePrice && storePrice > mrp) e.storePrice = `Can't be above the MRP (${rupees(mrp)}).`;
    }
  }
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v));
}

// The price lines that changed, for the "old → new" check, with any warning.
export function priceChanges(before, after) {
  return [
    ['Store price', 'storePrice'],
    ['Website price', 'websitePrice'],
    ['MRP', 'mrp'],
  ]
    .map(([label, key]) => ({ label, key, from: before[key] ?? null, to: after[key] ?? null }))
    .filter((c) => c.from !== c.to)
    .map((c) => ({ ...c, warning: c.key === 'mrp' ? null : priceWarning(c.from, c.to) }));
}

export const FILTERS = [
  ['all', 'All'],
  ['hidden', 'Hidden'],
  ['nophoto', 'Needs photo'],
  ['empty', 'No products'],
];

export function filterSubcategories(list, filter) {
  if (filter === 'hidden') return list.filter((s) => !s.showOnWebsite);
  if (filter === 'nophoto') return list.filter((s) => !s.hasPhoto);
  if (filter === 'empty') return list.filter((s) => s.productCount === 0);
  return list;
}
export const filterCounts = (list) => ({
  all: list.length,
  hidden: list.filter((s) => !s.showOnWebsite).length,
  nophoto: list.filter((s) => !s.hasPhoto).length,
  empty: list.filter((s) => s.productCount === 0).length,
});

// Search by name (ignoring capitals and extra spaces) or an exact price. Same rule as the server.
export function matchesSearch(s, q) {
  const query = String(q ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!query) return true;
  const n = Number(query.replace(/[₹,\s]/g, ''));
  return s.name.toLowerCase().includes(query) || (Number.isFinite(n) && n > 0 && [s.storePrice, s.websitePrice, s.mrp].includes(n));
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "9 Oct 2026"
export const dayText = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
