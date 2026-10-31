// How the website writes numbers, names and dates (Indian English).
export const formatMobile = (m) => (m && m.length === 10 ? `${m.slice(0, 5)} ${m.slice(5)}` : m || '');
// The shop's WhatsApp number as people read it ("73823 88565"), from config.store.whatsapp ("917382388565").
export const whatsappText = (config) => formatMobile(String(config.store.whatsapp || '').slice(-10));
export const firstName = (fullName) => String(fullName || '').trim().split(/\s+/)[0] || '';
export const initials = (fullName) => String(fullName || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
export const longDate = (iso) => (iso ? dayFmt.format(new Date(iso)) : '');
const dayMonthFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const dayMonthYearFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
// "17 Oct" and "17 Oct 2026" (India time)
export const dayMonth = (iso) => (iso ? dayMonthFmt.format(new Date(iso)) : '');
export const dayMonthYear = (iso) => (iso ? dayMonthYearFmt.format(new Date(iso)) : '');

// "Today, 4:12 pm" / "Yesterday" / "12 Oct".
export function whenText(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(x);
  if (day(d) === day(now)) return `Today, ${timeFmt.format(d)}`;
  if (day(d) === day(new Date(now.getTime() - 86400000))) return 'Yesterday';
  return shortFmt.format(d);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const labelName = (l) => ({ home: 'Home', office: 'Office', other: 'Other' })[l] || 'Home';
