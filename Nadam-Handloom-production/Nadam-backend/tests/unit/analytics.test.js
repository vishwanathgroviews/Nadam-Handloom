// Module 9 (Analytics): periods and the price check, without the database.
import { describe, it, expect } from 'vitest';
import { resolvePeriod, rangeText, chartUnit, daysIn } from '../../src/utils/period.js';
import { priceLooksWrong } from '../../src/services/analytics.service.js';

const ist = (s) => new Date(`${s}+05:30`);
const at = ist('2026-10-12T19:00:00');

describe('periods (6.2) and the period before (6.3)', () => {
  it('Today, 7 days, 30 days', () => {
    expect(resolvePeriod({ period: 'today' }, at)).toMatchObject({ range: { from: '2026-10-12', to: '2026-10-12', label: 'Mon 12 Oct 2026' }, previous: { from: '2026-10-11', to: '2026-10-11', label: 'yesterday' } });
    expect(resolvePeriod({ period: '7d' }, at)).toMatchObject({ range: { from: '2026-10-06', to: '2026-10-12', label: '6–12 Oct 2026' }, previous: { from: '2026-09-29', to: '2026-10-05', label: 'the 7 days before' } });
    expect(resolvePeriod({ period: '30d' }, at)).toMatchObject({ range: { from: '2026-09-13', to: '2026-10-12', label: '13 Sep – 12 Oct 2026' }, previous: { from: '2026-08-14', to: '2026-09-12' } });
  });
  it('This month: the same days of last month, shortened at a month end', () => {
    expect(resolvePeriod({ period: 'month' }, at)).toMatchObject({ range: { from: '2026-10-01', to: '2026-10-12' }, previous: { from: '2026-09-01', to: '2026-09-12', label: '1–12 Sep 2026' } });
    expect(resolvePeriod({ period: 'month' }, ist('2026-03-31T10:00:00')).previous).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(resolvePeriod({ period: 'month' }, ist('2027-01-05T10:00:00')).previous).toMatchObject({ from: '2026-12-01', to: '2026-12-05' });
  });
  it('Last month: the whole month, against the month before', () => {
    expect(resolvePeriod({ period: 'last' }, at)).toMatchObject({ range: { from: '2026-09-01', to: '2026-09-30', label: '1–30 Sep 2026' }, previous: { from: '2026-08-01', to: '2026-08-31', label: 'August' } });
    expect(resolvePeriod({ period: 'last' }, ist('2027-01-05T10:00:00'))).toMatchObject({ range: { from: '2026-12-01', to: '2026-12-31' }, previous: { label: 'November' } });
  });
  it('Any dates: checked, against the same number of days before', () => {
    expect(resolvePeriod({ period: 'custom', from: '2026-09-01', to: '2026-09-10' }, at).previous).toMatchObject({ from: '2026-08-22', to: '2026-08-31', label: 'the 10 days before' });
    expect(() => resolvePeriod({ period: 'custom', from: '2026-09-10', to: '2026-09-01' }, at)).toThrow(/before the first/);
    expect(() => resolvePeriod({ period: 'custom', from: '2026-10-01', to: '2026-10-13' }, at)).toThrow(/up to today/);
    expect(() => resolvePeriod({ period: 'custom' }, at)).toThrow(/first and last/);
  });
  it('The India day decides "today": 12:30 am in India is still the day before in UTC', () => {
    expect(resolvePeriod({ period: 'today' }, ist('2026-10-13T00:30:00')).range.from).toBe('2026-10-13');
  });
  it('Labels, chart grouping, day counts', () => {
    expect(rangeText({ from: '2025-12-20', to: '2026-01-05' })).toBe('20 Dec 2025 – 5 Jan 2026');
    expect(chartUnit({ from: '2026-10-12', to: '2026-10-12' })).toBe('hour');
    expect(chartUnit({ from: '2026-07-13', to: '2026-10-12' })).toBe('day');
    expect(chartUnit({ from: '2026-07-01', to: '2026-10-12' })).toBe('week');
    expect(daysIn('2026-02-01', '2026-02-28')).toBe(28);
  });
});

describe('prices that look wrong (Stock)', () => {
  it('Above the MRP, or more than 3 times the website price', () => {
    expect(priceLooksWrong({ storePrice: 54310, onlinePrice: 25888, mrp: 16999 })).toBe(true);
    expect(priceLooksWrong({ storePrice: 11999, onlinePrice: 2000, mrp: 16999 })).toBe(true);
    expect(priceLooksWrong({ storePrice: 9, onlinePrice: 2, mrp: null })).toBe(true);
    expect(priceLooksWrong({ storePrice: 3600, onlinePrice: 2800, mrp: 16999 })).toBe(false);
    expect(priceLooksWrong({ storePrice: 3600, onlinePrice: null, mrp: null })).toBe(false);
  });
});
