// The shop's data hooks: catalogue (menu, filters), lists, saree pages.
import { useResource, useResources } from './resource.js';
import { shopApi } from '../api/shop.js';

export const useCatalog = () => useResource('catalog', (o) => shopApi.catalog(o));
export const useSaree = (slug) => useResource(slug ? `saree:${slug}` : null, (o) => shopApi.product(slug, o));

// List query string (only the filters that are set), the same order every time.
export function listKey(f, offset = 0, limit = 24) {
  const p = new URLSearchParams();
  for (const k of ['category', 'collection', 'craft', 'price', 'sets', 'q', 'sort']) if (f[k]) p.set(k, f[k]);
  p.set('offset', String(offset));
  p.set('limit', String(limit));
  return p.toString();
}

export const PAGE = 24;

// The first `pages` pages of a list (24 each), as cached separately so "Load more" and going
// back to the list both show at once.
export function useList(f, pages) {
  const keys = Array.from({ length: Math.max(1, pages) }, (_, i) => `list:${listKey(f, i * PAGE, PAGE)}`);
  return useResources(keys, (k) => (o) => shopApi.products(k.slice(5), o));
}
