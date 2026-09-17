import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  MAX_RECENT_SEARCHES,
  recentSearchesKey,
  saveRecentSearches,
} from './recentSearches';

beforeEach(() => store.clear());

describe('addRecentSearch', () => {
  it('puts the newest search first', () => {
    expect(addRecentSearch(['cotton', 'silk'], 'pattu')).toEqual(['pattu', 'cotton', 'silk']);
  });

  it('keeps only the last five', () => {
    const list = ['e', 'd', 'c', 'b', 'a'];
    expect(addRecentSearch(list, 'f')).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(addRecentSearch(list, 'f')).toHaveLength(MAX_RECENT_SEARCHES);
  });

  it('moves a repeated search to the front instead of listing it twice', () => {
    expect(addRecentSearch(['cotton', 'pattu', 'silk'], 'pattu')).toEqual(['pattu', 'cotton', 'silk']);
  });

  it('treats differences in case and spacing as the same search', () => {
    expect(addRecentSearch(['Pattu Saree'], '  pattu   saree ')).toEqual(['pattu saree']);
  });

  it('ignores a blank search', () => {
    expect(addRecentSearch(['cotton'], '   ')).toEqual(['cotton']);
  });
});

describe('recentSearchesKey', () => {
  it('keeps each person and each category separate', () => {
    const keys = new Set([
      recentSearchesKey('user-1', 'cat-a'),
      recentSearchesKey('user-1', 'cat-b'),
      recentSearchesKey('user-2', 'cat-a'),
    ]);
    expect(keys.size).toBe(3);
  });
});

describe('storage', () => {
  it('round-trips a list', async () => {
    await saveRecentSearches('k', ['pattu', 'cotton']);
    expect(await loadRecentSearches('k')).toEqual(['pattu', 'cotton']);
  });

  it('comes back empty when nothing is stored', async () => {
    expect(await loadRecentSearches('missing')).toEqual([]);
  });

  it('survives corrupt or unexpected stored data', async () => {
    store.set('bad-json', '{not json');
    store.set('not-array', JSON.stringify({ a: 1 }));
    store.set('mixed', JSON.stringify(['ok', 42, null, 'fine']));
    expect(await loadRecentSearches('bad-json')).toEqual([]);
    expect(await loadRecentSearches('not-array')).toEqual([]);
    expect(await loadRecentSearches('mixed')).toEqual(['ok', 'fine']);
  });

  it('clears the list', async () => {
    await saveRecentSearches('k', ['pattu']);
    await clearRecentSearches('k');
    expect(await loadRecentSearches('k')).toEqual([]);
  });
});
