// The Activity endpoints (Module 10, owners).
import { api } from './client';

const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// { period, entries, next }
export const list = ({ kind = 'all', person, period = '30d', from, to, q, important, before }) =>
  api(`/activity?${qs({ kind, person, period, from: period === 'custom' ? from : null, to: period === 'custom' ? to : null, q: q?.trim(), important: important ? 'true' : null, before })}`);
// 20 at a time (offset, then nextOffset).
export const people = (offset = 0) => api(`/activity/people?offset=${offset}`);
