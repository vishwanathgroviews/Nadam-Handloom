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
  addRecentPick,
  clearRecentPicks,
  loadRecentPicks,
  MAX_RECENT_PICKS,
  recentPicksKey,
  saveRecentPicks,
} from './recentPicks';

beforeEach(() => store.clear());

const pick = (id: string, name = id) => ({ id, name });

describe('addRecentPick', () => {
  it('puts the newest pick first', () => {
    expect(addRecentPick([pick('a'), pick('b')], pick('c'))).toEqual([pick('c'), pick('a'), pick('b')]);
  });

  it('keeps only the last five', () => {
    const list = [pick('e'), pick('d'), pick('c'), pick('b'), pick('a')];
    expect(addRecentPick(list, pick('f'))).toHaveLength(MAX_RECENT_PICKS);
    expect(addRecentPick(list, pick('f'))[0]).toEqual(pick('f'));
  });

  it('moves a repeated pick to the front instead of listing it twice', () => {
    expect(addRecentPick([pick('a'), pick('b'), pick('c')], pick('b'))).toEqual([pick('b'), pick('a'), pick('c')]);
  });

  it('refreshes the name of something picked again after it was renamed', () => {
    const list = [pick('s1', 'Old name')];
    expect(addRecentPick(list, pick('s1', 'New name'))).toEqual([pick('s1', 'New name')]);
  });
});

describe('recentPicksKey', () => {
  it('keeps one person\'s picks apart from another\'s, and one category from another', () => {
    expect(recentPicksKey('u1', 'cat1')).not.toBe(recentPicksKey('u2', 'cat1'));
    expect(recentPicksKey('u1', 'cat1')).not.toBe(recentPicksKey('u1', 'cat2'));
  });
});

describe('storage', () => {
  const key = recentPicksKey('u1', 'cat1');

  it('reads back what was saved, and forgets it when cleared', async () => {
    await saveRecentPicks(key, [pick('s1', 'Pattu Saree')]);
    expect(await loadRecentPicks(key)).toEqual([pick('s1', 'Pattu Saree')]);
    await clearRecentPicks(key);
    expect(await loadRecentPicks(key)).toEqual([]);
  });

  it('returns nothing when the stored value is unusable', async () => {
    store.set(key, 'not json');
    expect(await loadRecentPicks(key)).toEqual([]);
    store.set(key, JSON.stringify(['a string', { id: 's1' }, pick('s2', 'Ok')]));
    expect(await loadRecentPicks(key)).toEqual([pick('s2', 'Ok')]);
  });
});
