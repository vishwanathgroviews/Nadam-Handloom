import { describe, expect, it } from 'vitest';
import { dayRange } from './dayRange';

describe('dayRange', () => {
  // The reported bug: 18 Sept to 18 Sept used to be a zero-length range.
  it('covers the whole of a single chosen day', () => {
    const r = dayRange('2026-09-18', '2026-09-18')!;
    expect(r.from).toEqual(new Date(2026, 8, 18, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 8, 18, 23, 59, 59, 999));
  });

  it('includes a sale at any time on that day, early morning and late night alike', () => {
    const r = dayRange('2026-09-18', '2026-09-18')!;
    for (const [h, m] of [[0, 5], [5, 29], [12, 0], [23, 58]]) {
      const sale = new Date(2026, 8, 18, h, m);
      expect(sale >= r.from && sale <= r.to).toBe(true);
    }
  });

  it('excludes the days either side', () => {
    const r = dayRange('2026-09-18', '2026-09-18')!;
    expect(new Date(2026, 8, 17, 23, 59, 59) < r.from).toBe(true);
    expect(new Date(2026, 8, 19, 0, 0, 0) > r.to).toBe(true);
  });

  it('spans every day of a multi-day range', () => {
    const r = dayRange('2026-09-01', '2026-09-18')!;
    expect(r.from).toEqual(new Date(2026, 8, 1, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 8, 18, 23, 59, 59, 999));
  });

  it('copes with the two days picked the wrong way round', () => {
    const r = dayRange('2026-09-18', '2026-09-10')!;
    expect(r.from).toEqual(new Date(2026, 8, 10, 0, 0, 0, 0));
    expect(r.to).toEqual(new Date(2026, 8, 18, 23, 59, 59, 999));
  });

  it('waits until both days are chosen and real', () => {
    expect(dayRange('', '2026-09-18')).toBeNull();
    expect(dayRange('2026-09-18', '')).toBeNull();
    expect(dayRange('2026-02-31', '2026-03-01')).toBeNull();
    expect(dayRange('18-09-2026', '18-09-2026')).toBeNull();
  });
});
