// Analytics (Module 9): the period and channel chips, the change against the period
// before, money in lakhs, payment and role names. Kept here so they can be tested.
import { rupees } from './catalog';

export const PERIODS = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['last', 'Last month'], ['custom', 'Any dates']];
export const CHANNELS = [['all', 'All'], ['store', 'Counter'], ['whatsapp', 'WhatsApp'], ['online', 'Online']];
export const TABS = [['sales', 'Sales'], ['designs', 'Designs'], ['people', 'People'], ['stock', 'Stock']];
export const PAYMENT = { cash: ['Cash', 'cash'], upi: ['UPI', 'upi'], card: ['Card', 'card'], online: ['Online', 'cloud'], none: ['Not recorded', 'info'] };
export const ROLE = { owner: 'Owner', staff: 'Staff', former: 'Former' };

// "↑ 12% vs 1–12 Sep 2026" (green), "↓ 8% vs the 7 days before" (amber); nothing to compare yet.
export function changeText(cur, prev, label, beforeHistory = false) {
  if (!prev) return { text: beforeHistory ? 'Nothing to compare yet' : `No sales ${label}`, tone: 'none' };
  const p = Math.round((100 * (cur - prev)) / prev);
  if (p === 0) return { text: `Same as ${label}`, tone: 'same' };
  if (p >= 1000) return { text: `↑ ${Math.round(cur / prev)}× vs ${label}`, tone: 'up' }; // "↑ 74×", not "↑ 7292%"
  return { text: `${p > 0 ? '↑' : '↓'} ${Math.abs(p)}% vs ${label}`, tone: p > 0 ? 'up' : 'down' };
}

// ₹2.42 lakh for big sums, ₹96,500 below a lakh.
export const lakh = (v) => (v >= 100000 ? `₹${(Math.floor(v / 1000) / 100).toFixed(2)} lakh` : rupees(Math.round(v)));

// The share of the largest value, for bar lengths (0–100).
export const share = (v, max) => (max > 0 ? Math.max(v > 0 ? 2 : 0, Math.round((100 * v) / max)) : 0);
export const maxOf = (list, key = 'amount') => list.reduce((m, x) => Math.max(m, x[key] || 0), 0);

// Which chart labels to print so they don't crowd: every one up to 16 bars, then about 6.
export const labelEvery = (n) => (n > 16 ? Math.ceil(n / 6) : 1);
