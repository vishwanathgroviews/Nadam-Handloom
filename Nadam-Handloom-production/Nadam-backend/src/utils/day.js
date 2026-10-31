// The shop's day is India time (UTC+5:30, no summer time), wherever the server runs.
const IST_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight in India at the start of the day that `at` falls in.
export const istDayStart = (at = new Date()) => new Date(Math.floor((at.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS);
export const istSameDay = (a, b = new Date()) => istDayStart(a).getTime() === istDayStart(b).getTime();

const fmt = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
export const istDate = (d) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(d); // 11 Oct 2026
export const istDay = (d) => fmt({ day: 'numeric', month: 'short' }).format(d); // 11 Oct
export const istTime = (d) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(/\s?([ap])m$/i, (_, x) => ` ${x.toLowerCase()}m`); // 4:15 pm

// "2026-10-11" (India) for a moment in time.
export const istYmd = (d = new Date()) => new Date(istDayStart(d).getTime() + IST_MS).toISOString().slice(0, 10);
// From the first day's midnight to the last day's 23:59:59.999, India time.
export function istRange(fromYmd, toYmd) {
  const start = (ymd) => new Date(Date.parse(`${ymd}T00:00:00.000Z`) - IST_MS);
  return { from: start(fromYmd), to: new Date(start(toYmd).getTime() + DAY_MS - 1) };
}
export const istSameMonth = (a, b = new Date()) => istYmd(a).slice(0, 7) === istYmd(b).slice(0, 7);
