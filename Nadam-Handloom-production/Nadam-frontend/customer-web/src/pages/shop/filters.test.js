import { describe, it, expect } from 'vitest';
import { readFilters, readPages, withFilters, isFiltered, groupsFor } from './filters.js';

const sp = (q) => new URLSearchParams(q);

describe('list filters in the address', () => {
  it('keeps only real values, in a fixed order', () => {
    expect(readFilters(sp('craft=Pure,embroidery,nonsense,pure&price=u25&sets=1&sort=price-desc&q=  red  '))).toEqual({
      category: '', collection: '', craft: 'embroidery,pure', price: 'u25', sets: '1', q: 'red', sort: 'price-desc',
    });
  });

  it('drops junk: unknown price, sort, collection id, odd category characters', () => {
    expect(readFilters(sp('price=cheap&sort=random&collection=nope&category=Pattu%20<b>'))).toMatchObject({ price: '', sort: '', collection: '', category: 'pattub' });
  });

  it('"Load more" pages: 1 to 20', () => {
    expect([readPages(sp('')), readPages(sp('page=3')), readPages(sp('page=x')), readPages(sp('page=999'))]).toEqual([1, 3, 1, 20]);
  });

  it('changing a filter starts again from the first page and leaves out empty values', () => {
    expect(withFilters(sp('craft=pure&page=3&sort=new'), { craft: '', price: 'o50' }).toString()).toBe('sort=new&price=o50');
  });

  it('knows when the visitor has filtered (not counting what the page fixes)', () => {
    expect(isFiltered(readFilters(sp('category=x')), { category: 'x' })).toBe(false);
    expect(isFiltered(readFilters(sp('category=x&sets=1')), { category: 'x' })).toBe(true);
  });

  it('shows a filter group only when it offers a real choice', () => {
    const facets = {
      category: [{ key: 'a', count: 5 }, { key: 'b', count: 0 }],
      craft: [{ key: 'pure', count: 3 }, { key: 'checks', count: 2 }],
      price: [{ key: 'u25', count: 5 }],
      collection: [{ key: 'c1', count: 5 }],
    };
    expect(groupsFor(facets, readFilters(sp('')), {})).toEqual(['craft']);
    expect(groupsFor(facets, readFilters(sp('price=u25')), {})).toEqual(['craft', 'price']);
    expect(groupsFor(facets, readFilters(sp('')), { craft: 'pure' })).toEqual([]);
  });
});
