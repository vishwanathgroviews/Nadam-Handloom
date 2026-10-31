// Module 6: periods in India time, labels, the calendar, the correction check.
import { todayIst, periodRange, rangeLabel, monthGrid, pickDay, addMonths, correctErrors } from './invoices';
import { rupees } from './catalog';

// 11 Oct 2026, 11:45 pm in India = 18:15 UTC.
const NOW = Date.parse('2026-10-11T18:15:00Z');

describe('periods (6.7, 6.8)', () => {
  it('today is India\'s date, even late at night', () => {
    expect(todayIst(NOW)).toBe('2026-10-11');
    expect(todayIst(Date.parse('2026-10-11T18:31:00Z'))).toBe('2026-10-12');
  });
  it('Today, This month, Last month, All', () => {
    expect(periodRange('today', null, NOW)).toEqual({ from: '2026-10-11', to: '2026-10-11' });
    expect(periodRange('month', null, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-11' });
    expect(periodRange('last', null, NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('last', null, Date.parse('2026-03-05T06:00:00Z'))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('last', null, Date.parse('2027-01-05T06:00:00Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(periodRange('custom', { from: '2026-10-02', to: '2026-10-05' }, NOW)).toEqual({ from: '2026-10-02', to: '2026-10-05' });
  });
  it('labels a whole month, a month so far, one day and a range', () => {
    expect(rangeLabel({ from: '2026-09-01', to: '2026-09-30' }, NOW)).toBe('September 2026');
    expect(rangeLabel({ from: '2026-10-01', to: '2026-10-11' }, NOW)).toBe('October 2026 (so far)');
    expect(rangeLabel({ from: '2026-10-05', to: '2026-10-05' }, NOW)).toBe('5 Oct 2026');
    expect(rangeLabel({ from: '2026-10-02', to: '2026-10-05' }, NOW)).toBe('2 Oct 2026 – 5 Oct 2026');
  });
});

describe('the calendar', () => {
  it('weeks start on Monday; days after today can\'t be picked', () => {
    const weeks = monthGrid('2026-10', NOW);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]); // 1 Oct 2026 is a Thursday
    expect(weeks[0][3]).toMatchObject({ ymd: '2026-10-01', day: 1 });
    const all = weeks.flat().filter(Boolean);
    expect(all).toHaveLength(31);
    expect(all.find((d) => d.ymd === '2026-10-11')).toMatchObject({ today: true, future: false });
    expect(all.find((d) => d.ymd === '2026-10-12').future).toBe(true);
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
  it('first tap starts the range, second ends it, in either order', () => {
    expect(pickDay(null, '2026-10-05')).toEqual({ from: '2026-10-05', to: null });
    expect(pickDay({ from: '2026-10-05', to: null }, '2026-10-02')).toEqual({ from: '2026-10-02', to: '2026-10-05' });
    expect(pickDay({ from: '2026-10-02', to: '2026-10-05' }, '2026-10-07')).toEqual({ from: '2026-10-07', to: null });
  });
});

describe('correct the customer (6.11)', () => {
  it('name up to 60 characters; a 10-digit mobile or none', () => {
    expect(correctErrors({ name: 'Sita', mobile: '' })).toEqual({});
    expect(correctErrors({ name: 'Sita', mobile: '98480' }).mobile).toBeTruthy();
    expect(correctErrors({ name: 'x'.repeat(61) }).name).toBeTruthy();
  });
});

describe('money on screen', () => {
  it('whole rupees without decimals; paise always as two digits', () => {
    expect(rupees(3600)).toBe('₹3,600');
    expect(rupees(162998.1)).toBe('₹1,62,998.10');
    expect(rupees(1999.99)).toBe('₹1,999.99');
    expect(rupees(null)).toBe('—');
  });
});
