// Which order news this browser has already shown (W6): "Your order … is confirmed" appears
// once per order and state (being confirmed, then confirmed, or refunded).
const KEY = 'nh-orders-seen';
const MAX = 40;

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const isSeen = (number, status) => read().includes(`${number}:${status}`);

export function markSeen(number, status) {
  const k = `${number}:${status}`;
  const list = read().filter((x) => x !== k);
  list.push(k);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch { /* private mode: shown again next visit */ }
}

// The news to show: the newest order of the last 3 days that is confirmed, being confirmed or
// refunded, and not shown yet.
const NEWS = new Set(['paid', 'confirming', 'refunded']);
export function newsOf(orders, now = Date.now()) {
  return (orders || []).find((o) => NEWS.has(o.status) && now - Date.parse(o.placedAt) < 3 * 86400_000 && !isSeen(o.number, o.status)) || null;
}
