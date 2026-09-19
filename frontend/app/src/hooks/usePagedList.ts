import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { hasMorePages, mergeById, PAGE_SIZE, refreshPlan } from '../utils/paging';

export interface Page<T> {
  items: T[];
  total: number;
}

interface Options {
  /** Largest page the endpoint accepts — bounds how much a refresh refetches at once. */
  maxPageSize?: number;
  /** Nothing is fetched while false (e.g. no access token yet). */
  enabled?: boolean;
}

/**
 * The app's infinite-scroll list: ten records at a time, the next ten when
 * the reader nears the end.
 *
 * Replaces screens fetching whole lists (or one large page) at once, which
 * cost the server and the phone for rows nobody scrolled to.
 *
 * `fetchPage` must be stable for a given filter — wrap it in useCallback with
 * the filter as dependencies. A new `fetchPage` means "the filter changed":
 * the list starts over from the first page.
 */
export function usePagedList<T extends { id: string }>(
  fetchPage: (page: number, pageSize: number) => Promise<Page<T>>,
  { maxPageSize = 50, enabled = true }: Options = {}
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  // Refs, not state, for everything the callbacks read: FlatList can fire
  // onEndReached several times before React re-renders, and a slow response
  // from an old filter must not land on top of the new one.
  const pageRef = useRef(0);
  const itemsRef = useRef<T[]>([]);
  const seqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);

  const commit = useCallback((next: T[], nextTotal: number, lastPageSize: number, pageSize: number) => {
    itemsRef.current = next;
    setItems(next);
    setTotal(nextTotal);
    const more = hasMorePages(next.length, nextTotal, lastPageSize, pageSize);
    hasMoreRef.current = more;
    setHasMore(more);
  }, []);

  /** Starts over from the first page — used when the filter changes. */
  const reset = useCallback(async () => {
    if (!enabled) return;
    const seq = ++seqRef.current;
    loadingMoreRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setError('');
    try {
      const res = await fetchPage(1, PAGE_SIZE);
      if (seq !== seqRef.current) return;
      pageRef.current = 1;
      commit(res.items, res.total, res.items.length, PAGE_SIZE);
    } catch (err: any) {
      if (seq !== seqRef.current) return;
      setError(err?.message || 'Could not load this list');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [enabled, fetchPage, commit]);

  /**
   * Refetches what is already on screen, keeping the reader's place — used
   * on returning to the screen and on pull-to-refresh.
   */
  const refresh = useCallback(async (opts: { pull?: boolean } = {}) => {
    if (!enabled) return;
    if (itemsRef.current.length === 0) return reset();
    const seq = ++seqRef.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (opts.pull) setRefreshing(true);
    setError('');
    try {
      const plan = refreshPlan(itemsRef.current.length, PAGE_SIZE, maxPageSize);
      const res = await fetchPage(1, plan.requestPageSize);
      if (seq !== seqRef.current) return;
      pageRef.current = plan.pagesCovered;
      commit(res.items, res.total, res.items.length, plan.requestPageSize);
    } catch (err: any) {
      if (seq !== seqRef.current) return;
      setError(err?.message || 'Could not refresh this list');
    } finally {
      if (seq === seqRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [enabled, fetchPage, commit, maxPageSize, reset]);

  /** Fetches the next ten. Safe to call repeatedly; it only ever runs one at a time. */
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMoreRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const seq = seqRef.current;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const res = await fetchPage(next, PAGE_SIZE);
      if (seq !== seqRef.current) return;
      pageRef.current = next;
      commit(mergeById(itemsRef.current, res.items), res.total, res.items.length, PAGE_SIZE);
    } catch (err: any) {
      if (seq === seqRef.current) setError(err?.message || 'Could not load more');
    } finally {
      if (seq === seqRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [enabled, fetchPage, commit]);

  // A new filter (a new fetchPage) starts the list over.
  useEffect(() => {
    reset();
  }, [reset]);

  /** Replaces the loaded rows locally, e.g. after removing one. */
  const setLocalItems = useCallback((updater: (prev: T[]) => T[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);

  return { items, total, loading, loadingMore, refreshing, error, hasMore, loadMore, refresh, reset, setLocalItems };
}

/**
 * Refreshes a paged list whenever its screen comes back into view (after
 * opening one of its rows, say) — but not on the very first focus, when the
 * list is already loading its first page.
 */
export function useRefreshOnReturn(refresh: () => void) {
  const firstFocus = useRef(true);
  // Read through a ref so the focus callback itself never changes. A changing
  // callback makes useFocusEffect re-run while the screen is already open,
  // which would fire an extra refresh on every filter change.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refreshRef.current();
    }, [])
  );
}
