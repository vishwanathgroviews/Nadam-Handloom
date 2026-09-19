/**
 * Turns two picked calendar days (local "YYYY-MM-DD", as DatePickerModal
 * returns them) into the full span of time they cover: from the very start of
 * the first day to the very end of the last, in the phone's own time zone.
 *
 * `new Date('2026-09-18')` is NOT that: JavaScript reads a bare date as
 * midnight UTC. Picking 18 Sept to 18 Sept therefore meant "from 18 Sept
 * 00:00 UTC to 18 Sept 00:00 UTC" — a range zero seconds long, which is why a
 * single day showed no sales at all. (Midnight UTC is also 5:30 am in India,
 * so every custom range was missing its first day's early-morning sales.)
 *
 * Returns null while either day is missing or not a real date.
 */
export const dayRange = (fromDay: string, toDay: string): { from: Date; to: Date } | null => {
  const parse = (value: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const [year, month, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
    const date = new Date(year, month, day);
    // Rejects impossible dates like 2026-02-31, which Date would roll over.
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  };

  const start = parse(fromDay);
  const endDay = parse(toDay);
  if (!start || !endDay) return null;

  const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999);
  // Picked the wrong way round: still cover exactly the days chosen.
  return start.getTime() <= end.getTime()
    ? { from: start, to: end }
    : { from: new Date(endDay), to: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999) };
};
