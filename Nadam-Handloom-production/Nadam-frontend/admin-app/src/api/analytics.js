// The Analytics endpoints (Module 9, owners).
import { api } from './client';

const qs = ({ period, from, to, channel }) => [['period', period], ['from', period === 'custom' ? from : null], ['to', period === 'custom' ? to : null], ['channel', channel]]
  .filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export const summary = (q) => api(`/analytics?${qs(q)}`);
export const person = (id, q) => api(`/analytics/people/${id}?${qs(q)}`);
export const stock = () => api('/analytics/stock');
