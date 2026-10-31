export const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "5 min ago", "3 hours ago", "2 days ago"; older than 30 days: "12 Mar 2026".
export function ago(iso, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  if (d <= 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return dateText(iso);
}

// "12 Mar 2026"
export const dateText = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// "Active now" / "Last active 3 hours ago" / "Not signed in yet"
export function lastActiveText(iso, now = Date.now()) {
  if (!iso) return 'Not signed in yet';
  const a = ago(iso, now);
  return a === 'just now' ? 'Active now' : `Last active ${a}`;
}
