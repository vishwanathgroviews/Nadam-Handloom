// The scan-to-sell endpoints (Module 5). Selling always needs the server (decision
// 6.4: no selling without internet), so nothing here is kept for offline use.
import { api } from './client';

const post = (body) => ({ method: 'POST', body });

// { saree, sellable, problem } — 404 TAG_UNKNOWN when no saree has the tag.
export const lookup = (code) => api('/sales/lookup', post({ code }));
// { sale, actions, repeated, invoiceFailed } — the same bill id twice returns the same sale.
export const completeSale = (body) => api('/sales', post(body));
// 20 at a time (offset, then nextOffset); the day's totals cover every sale.
export const today = (offset = 0) => api(`/sales/today?offset=${offset}`);
export const getSale = (id) => api(`/sales/${id}`);
export const makeInvoice = (id) => api(`/sales/${id}/invoice`, { method: 'POST' });
export const cancelSale = (id, reason) => api(`/sales/${id}/cancel`, post({ reason }));
