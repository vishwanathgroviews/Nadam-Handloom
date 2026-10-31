// Activity log (Module 10): kinds, periods, the filter summary, day titles and where
// an entry's Open goes. Kept here so they can be tested.
export const KINDS = [['all', 'All'], ['sales', 'Sales'], ['orders', 'Orders'], ['prices', 'Prices and catalogue'], ['products', 'Products and tags'], ['team', 'Team'], ['settings', 'Settings'], ['signin', 'Sign-in']];
export const KIND_ICON = { sales: 'receipt', orders: 'orders', prices: 'tag', products: 'box', team: 'users', settings: 'sliders', signin: 'shield' };
export const KIND_TONE = { sales: 'primary', orders: 'info', prices: 'accent', products: 'success', team: 'neutral', settings: 'danger', signin: 'warning' };
export const PERIODS = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All time'], ['custom', 'Any dates']];
export const DEFAULT_VIEW = { kind: 'all', person: null, personName: null, period: '30d', custom: null, important: false };

// "Sales · Ravi · 7 days · Important only"; nothing chosen: "Everything, last 30 days".
export function filterSummary(v) {
  const bits = [];
  if (v.kind !== 'all') bits.push(KINDS.find((k) => k[0] === v.kind)?.[1]);
  if (v.person) bits.push(v.personName || 'One person');
  if (v.period !== '30d') bits.push(v.period === 'custom' && v.custom ? `${v.custom.from} – ${v.custom.to}` : PERIODS.find((p) => p[0] === v.period)?.[1]);
  if (v.important) bits.push('Important only');
  return { count: bits.length, text: bits.length ? bits.join(' · ') : 'Everything, last 30 days' };
}

// "Today", "Yesterday", or the entry's own date ("10 Oct 2026").
export function dayTitle(day, date, todayYmd) {
  if (day === todayYmd) return 'Today';
  const y = new Date(`${todayYmd}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === y.toISOString().slice(0, 10)) return 'Yesterday';
  return date;
}

// Where "Open" goes for an entry's link; pages in other tabs come back to Activity.
const BACK = `?back=${encodeURIComponent('/more/activity')}`;
export function linkHref(link) {
  if (!link) return null;
  return {
    sale: `/scan/sale/${link.id}${BACK}`,
    order: `/orders/order/${link.id}${BACK}`,
    product: `/products/${link.id}${BACK}`,
    design: `/products/sub/${link.id}${BACK}`,
    person: `/more/team/${link.id}`,
    invoice: `/more/invoices/${link.id}`,
  }[link.type] || null;
}
export const LINK_WORD = { sale: 'the sale', order: 'the order', product: 'the saree', design: 'the design', person: 'the person', invoice: 'the invoice' };

// Day headers and entries in one list for the screen.
export function withDays(entries, todayYmd) {
  const out = [];
  let last = null;
  for (const e of entries) {
    if (e.day !== last) { out.push({ key: `d-${e.day}`, header: dayTitle(e.day, e.date, todayYmd) }); last = e.day; }
    out.push({ key: e.id, entry: e });
  }
  return out;
}
