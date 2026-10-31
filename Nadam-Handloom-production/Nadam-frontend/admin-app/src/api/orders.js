// The order endpoints (Module 7).
import { api } from './client';

const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// { orders, nextOffset, counts: { to_ship, shipped, delivered }, searching }
export const listOrders = ({ tab = 'to_ship', q = '', offset = 0 }) => api(`/orders?${qs({ tab, q: q.trim(), offset })}`);
export const toShipCount = () => api('/orders/counts');
export const getOrder = (id) => api(`/orders/${id}`);
export const shipOrder = (id, { carrier, awb }) => api(`/orders/${id}/ship`, { method: 'POST', body: { carrier, awb } });
export const changeTracking = (id, { carrier, awb }) => api(`/orders/${id}/tracking`, { method: 'PATCH', body: { carrier, awb } });
export const markDelivered = (id) => api(`/orders/${id}/delivered`, { method: 'POST' });
export const cancelOrder = (id, reason) => api(`/orders/${id}/cancel`, { method: 'POST', body: { reason } });
// 20 customers at a time (offset, then nextOffset); totals cover all 30 days.
export const unpaidCheckouts = (offset = 0) => api(`/orders/unpaid?offset=${offset}`);
