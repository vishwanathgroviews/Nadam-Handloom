// How many orders are waiting to ship: the number on the Orders tab (decision 6.9).
// Refreshed when a tab opens and after shipping or cancelling.
import { useSyncExternalStore } from 'react';
import * as orders from '../api/orders';
import { can, PERMISSION } from '../auth/permissions';
import { session } from '../auth/session';

let state = { toShip: 0 };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const orderCount = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,
  set(toShip) { if (toShip !== state.toShip) { state = { toShip }; emit(); } },
  async refresh() {
    if (!can(session.getState().user, PERMISSION.ORDERS_MANAGE)) return;
    try { orderCount.set((await orders.toShipCount()).toShip); } catch { /* keep the last number */ }
  },
};

export const useToShipCount = () => useSyncExternalStore(orderCount.subscribe, orderCount.getState).toShip;
