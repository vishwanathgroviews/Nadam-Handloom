// A list that comes from the server 20 at a time (all 13 list APIs, 2026-10-12): the first
// page, then the next one when the person nears the end (or taps "Show more").
//   page(offset) calls the API; `key` names the list in its answer. The first answer is
//   kept whole (`data`) for the counts and totals, which always cover every page.
import { useCallback, useRef, useState } from 'react';

export function usePaged(page, key) {
  const [s, set] = useState({ data: null, items: [], next: null, error: null, more: false, moreError: null });
  const asked = useRef(0);
  const busy = useRef(false);

  // The first page again (on opening, pull down, or a new search). An older answer that
  // arrives late is dropped.
  const load = useCallback(async () => {
    const mine = ++asked.current;
    busy.current = false;
    try {
      const data = await page(0);
      if (mine === asked.current) set({ data, items: data[key] || [], next: data.nextOffset ?? null, error: null, more: false, moreError: null });
      return data;
    } catch (e) {
      if (mine === asked.current) set((x) => ({ ...x, error: e }));
      return null;
    }
  }, [page, key]);

  const loadMore = useCallback(async () => {
    if (s.next == null || busy.current) return;
    busy.current = true;
    const mine = asked.current;
    set((x) => ({ ...x, more: true, moreError: null }));
    try {
      const data = await page(s.next);
      if (mine !== asked.current) return;
      set((x) => {
        const seen = new Set(x.items.map((i) => i.id));
        return { ...x, items: [...x.items, ...(data[key] || []).filter((i) => !seen.has(i.id))], next: data.nextOffset ?? null, more: false };
      });
    } catch (e) {
      if (mine === asked.current) set((x) => ({ ...x, more: false, moreError: e }));
    } finally {
      busy.current = false;
    }
  }, [page, key, s.next]);

  const update = useCallback((fn) => set((x) => ({ ...x, items: fn(x.items) })), []);
  return { ...s, total: s.data?.total ?? null, hasMore: s.next != null, load, loadMore, update };
}

// Every page at once, for the few places that need the whole list (reordering).
export async function allPages(page, key) {
  const items = [];
  let offset = 0;
  for (;;) {
    const data = await page(offset);
    items.push(...(data[key] || []));
    if (data.nextOffset == null) return items;
    offset = data.nextOffset;
  }
}

// For a ScrollView's onScroll: the person is near the end.
export const nearEnd = ({ nativeEvent: e }, gap = 600) => e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - gap;
