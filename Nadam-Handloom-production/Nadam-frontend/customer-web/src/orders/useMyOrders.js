// The customer's orders (W7): the first 20 through the reply cache, shared with "Your order … is
// confirmed" (OrderNotice) and My account's latest order; Show more asks for the next 20.
import { useCallback, useEffect, useState } from 'react';
import { shopApi } from '../api/shop.js';
import { useAuth } from '../auth/useAuth.js';
import { ensure, useResource } from '../data/resource.js';

export const firstPage = () => shopApi.myOrders();
// One cache entry per customer: never a previous sign-in's orders on this browser.
export function myOrdersKey(status, customer) {
  return status === 'signedIn' && customer?.id ? `my-orders:${customer.id}` : null;
}

// fresh: ask the server again on opening (the cache may be from before a payment).
export function useMyOrders({ fresh = false } = {}) {
  const { status, customer } = useAuth();
  const key = myOrdersKey(status, customer);
  const first = useResource(key, firstPage);
  const [more, setMore] = useState({ orders: [], nextOffset: undefined, loading: false, error: null });
  useEffect(() => {
    if (key && fresh) ensure(key, firstPage, { force: true });
  }, [key, fresh]);

  const orders = [...(first.data?.orders || []), ...more.orders.filter((o) => !(first.data?.orders || []).some((f) => f.number === o.number))];
  const nextOffset = more.nextOffset !== undefined ? more.nextOffset : first.data?.nextOffset ?? null;
  const loadMore = useCallback(async () => {
    if (nextOffset == null) return;
    setMore((m) => ({ ...m, loading: true, error: null }));
    try {
      const r = await shopApi.myOrders(nextOffset);
      setMore((m) => ({ orders: [...m.orders, ...r.orders], nextOffset: r.nextOffset, loading: false, error: null }));
    } catch (error) {
      setMore((m) => ({ ...m, loading: false, error }));
      throw error;
    }
  }, [nextOffset]);
  const reload = useCallback(() => {
    setMore({ orders: [], nextOffset: undefined, loading: false, error: null });
    return first.reload();
  }, [first]);

  return { status: first.status, error: first.error, orders, nextOffset, loadingMore: more.loading, loadMore, reload };
}
