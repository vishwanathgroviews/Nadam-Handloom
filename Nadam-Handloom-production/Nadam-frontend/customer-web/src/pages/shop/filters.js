import { CRAFT_NAMES } from '../../data/crafts.js';

// The list's filters live in the address (so a list can be shared, and Back returns to it).
// Unknown values are dropped here as well as on the server.
export const SORTS = [
  ['', 'Newest first'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
];
const SORT_KEYS = SORTS.map(([k]) => k);
const PRICE_KEYS = ['u25', '25-35', '35-50', 'o50'];
const FILTER_KEYS = ['category', 'collection', 'craft', 'price', 'sets', 'q'];

export function readFilters(sp) {
  const sort = sp.get('sort') || '';
  return {
    category: (sp.get('category') || '').toLowerCase().replace(/[^a-z0-9-]/g, ''),
    collection: /^[0-9a-f-]{36}$/i.test(sp.get('collection') || '') ? sp.get('collection').toLowerCase() : '',
    craft: [...new Set((sp.get('craft') || '').toLowerCase().split(',').map((s) => s.trim()).filter((k) => CRAFT_NAMES[k]))].sort().join(','),
    price: PRICE_KEYS.includes(sp.get('price')) ? sp.get('price') : '',
    sets: sp.get('sets') === '1' || sp.get('sets') === 'true' ? '1' : '',
    q: (sp.get('q') || '').trim().slice(0, 60),
    sort: SORT_KEYS.includes(sort) ? sort : '',
  };
}

export const readPages = (sp) => Math.min(20, Math.max(1, Number.parseInt(sp.get('page'), 10) || 1));

export const crafts = (f) => (f.craft ? f.craft.split(',') : []);
export const isFiltered = (f, fixed = {}) => FILTER_KEYS.some((k) => f[k] && !fixed[k]);

// The next address after changing filters: back to the first page, empty values left out.
export function withFilters(sp, patch) {
  const next = new URLSearchParams(sp);
  for (const [k, v] of Object.entries(patch)) {
    if (v) next.set(k, v);
    else next.delete(k);
  }
  next.delete('page');
  return next;
}

// Which groups are worth showing: more than one choice, or one already chosen.
export function groupsFor(facets, f, fixed) {
  if (!facets) return [];
  const useful = (key) => !fixed[key] && (f[key] || (facets[key] || []).filter((o) => o.count > 0).length > 1);
  return ['category', 'craft', 'price', 'collection'].filter(useful);
}
