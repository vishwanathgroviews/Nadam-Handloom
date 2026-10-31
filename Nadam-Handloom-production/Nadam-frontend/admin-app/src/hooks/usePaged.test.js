// Lists come 20 at a time: the hook, walking every page (for reordering), the "near the end" check.
import { renderHook, act } from '@testing-library/react-native';
import { allPages, nearEnd, usePaged } from './usePaged';

describe('20 at a time', () => {
  it('allPages follows nextOffset until it is null, in order, nothing twice', async () => {
    const all = Array.from({ length: 47 }, (_, i) => ({ id: `c${i}` }));
    const asked = [];
    const page = async (offset) => { asked.push(offset); const items = all.slice(offset, offset + 20); return { categories: items, nextOffset: offset + 20 < all.length ? offset + 20 : null, total: all.length }; };
    const got = await allPages(page, 'categories');
    expect(asked).toEqual([0, 20, 40]);
    expect(got.map((x) => x.id)).toEqual(all.map((x) => x.id));
  });
  it('one short page: asked once', async () => {
    const page = jest.fn(async () => ({ members: [{ id: 'a' }], nextOffset: null }));
    expect(await allPages(page, 'members')).toEqual([{ id: 'a' }]);
    expect(page).toHaveBeenCalledTimes(1);
  });
  it('nearEnd: true within 600 points of the bottom', () => {
    const ev = (y) => ({ nativeEvent: { layoutMeasurement: { height: 800 }, contentOffset: { y }, contentSize: { height: 3000 } } });
    expect(nearEnd(ev(0))).toBe(false);
    expect(nearEnd(ev(1500))).toBe(false);
    expect(nearEnd(ev(1700))).toBe(true);
    expect(nearEnd(ev(2200))).toBe(true);
  });
});

// The hook itself: first page, the next pages, the end, and an old search answering late.

const listOf = (n, p = 'x') => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }));
const server = (all) => async (offset) => ({ sales: all.slice(offset, offset + 20), nextOffset: offset + 20 < all.length ? offset + 20 : null, total: all.length, totals: { count: all.length } });

describe('usePaged', () => {
  it('loads 20, then the next 20, then the rest; totals from the first answer', async () => {
    const page = server(listOf(45));
    const { result } = await renderHook(() => usePaged(page, 'sales'));
    await act(async () => { await result.current.load(); });
    expect(result.current.items).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.total).toBe(45);
    expect(result.current.data.totals.count).toBe(45);
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items).toHaveLength(40);
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items).toHaveLength(45);
    expect(result.current.hasMore).toBe(false);
    await act(async () => { await result.current.loadMore(); }); // nothing more to ask
    expect(result.current.items).toHaveLength(45);
  });

  it('a newer search wins over an older one that answers late', async () => {
    let release;
    const slow = new Promise((r) => { release = r; });
    let q = 'old';
    const page = async () => (q === 'old' ? slow : { sales: listOf(3, 'new'), nextOffset: null, total: 3 });
    const { result } = await renderHook(() => usePaged(page, 'sales'));
    let first;
    await act(async () => { first = result.current.load(); });
    q = 'new';
    await act(async () => { await result.current.load(); });
    await act(async () => { release({ sales: listOf(20, 'old'), nextOffset: 20, total: 50 }); await first; });
    expect(result.current.items.map((x) => x.id)).toEqual(['new0', 'new1', 'new2']);
  });

  it('a failed next page keeps what is shown and offers to try again', async () => {
    let fail = false;
    const base = server(listOf(30));
    const page = async (offset) => { if (fail) throw Object.assign(new Error('No internet.'), { code: 'NETWORK' }); return base(offset); };
    const { result } = await renderHook(() => usePaged(page, 'sales'));
    await act(async () => { await result.current.load(); });
    fail = true;
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items).toHaveLength(20);
    expect(result.current.moreError.message).toBe('No internet.');
    fail = false;
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.items).toHaveLength(30);
    expect(result.current.moreError).toBeNull();
  });
});
