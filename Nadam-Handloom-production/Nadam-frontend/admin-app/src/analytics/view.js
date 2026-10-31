// What the owner last looked at in Analytics (period, channel, tab, sort), shared by
// the Analytics pages while the app is open. Not saved to the phone.
import { useSyncExternalStore } from 'react';

let state = { period: 'month', custom: null, channel: 'all', tab: 'sales', sort: 'sarees' };
const listeners = new Set();
export const analyticsView = {
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  getState: () => state,
  set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l()); },
};
export const useAnalyticsView = () => useSyncExternalStore(analyticsView.subscribe, analyticsView.getState);
// The query for the server.
export const queryOf = (v) => ({ period: v.period, from: v.custom?.from, to: v.custom?.to, channel: v.channel });
