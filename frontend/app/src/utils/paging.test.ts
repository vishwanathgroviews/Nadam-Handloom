import { describe, expect, it } from 'vitest';
import { hasMorePages, mergeById, PAGE_SIZE, refreshPlan } from './paging';

describe('PAGE_SIZE', () => {
  it('asks for ten records at a time', () => {
    expect(PAGE_SIZE).toBe(10);
  });
});

describe('mergeById', () => {
  it('appends the next page', () => {
    expect(mergeById([{ id: 'a' }], [{ id: 'b' }]).map((r) => r.id)).toEqual(['a', 'b']);
  });

  // A new record arriving while you scroll pushes every row down by one, so
  // the last row of page 1 comes back again as the first row of page 2.
  it('does not show a row twice when it shifts between pages', () => {
    expect(mergeById([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('hasMorePages', () => {
  it('keeps going while there are more records than loaded', () => {
    expect(hasMorePages(10, 25, 10, 10)).toBe(true);
  });

  it('stops once everything is loaded', () => {
    expect(hasMorePages(25, 25, 5, 10)).toBe(false);
  });

  it('stops when the server returns a short page, even if the total says otherwise', () => {
    // e.g. rows removed since the total was counted — never loop on empty pages.
    expect(hasMorePages(20, 30, 0, 10)).toBe(false);
  });
});

describe('refreshPlan', () => {
  it('refetches what was on screen in one request', () => {
    expect(refreshPlan(30, 10, 50)).toEqual({ requestPageSize: 30, pagesCovered: 3 });
  });

  it('rounds up so the next page starts exactly where the refresh ends', () => {
    expect(refreshPlan(23, 10, 50)).toEqual({ requestPageSize: 30, pagesCovered: 3 });
  });

  it('never asks for more than the server allows at once', () => {
    expect(refreshPlan(140, 10, 50)).toEqual({ requestPageSize: 50, pagesCovered: 5 });
  });

  it('asks for one page when nothing is loaded yet', () => {
    expect(refreshPlan(0, 10, 50)).toEqual({ requestPageSize: 10, pagesCovered: 1 });
  });
});
