// Online payments from the website (owners) and this phone's notifications.
import { api } from './client';
import { paymentsQuery } from '../utils/payments';

// { payments, nextOffset, total, totals: { paid, paidCount, refunded, refundedCount }, counts, period }
export const listPayments = (filters) => api(`/payments?${paymentsQuery(filters)}`);
export const getPayment = (number) => api(`/payments/${encodeURIComponent(number)}`);

// { push: { registered, payments, canGetPayments, ready } }
export const pushStatus = () => api('/me/push');
export const registerPush = ({ token, platform, payments }) => api('/me/push', { method: 'PUT', body: { token, platform, ...(payments != null ? { payments } : {}) } });
export const setPaymentPush = (payments) => api('/me/push', { method: 'PATCH', body: { payments } });
export const testPush = () => api('/me/push/test', { method: 'POST' });
