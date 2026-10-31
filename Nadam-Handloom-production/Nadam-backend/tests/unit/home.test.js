// Module 8 (Home): the date rules, without the database.
import { describe, it, expect } from 'vitest';
import { monthReminder, daysSince, dayLabel, monthStart, monthName } from '../../src/services/home.service.js';

const ist = (s) => new Date(`${s}+05:30`);

describe('the monthly reminder (6.6)', () => {
  it('From the 1st to the 7th (India time): last month\'s dates', () => {
    expect(monthReminder(ist('2026-11-03T10:00:00'))).toEqual({ month: 'October', key: '2026-10', from: '2026-10-01', to: '2026-10-31' });
    expect(monthReminder(ist('2026-11-07T23:59:00'))).not.toBeNull();
    expect(monthReminder(ist('2026-11-08T00:01:00'))).toBeNull();
    expect(monthReminder(ist('2026-10-12T19:00:00'))).toBeNull();
  });
  it('January gives December of the year before; February knows leap years', () => {
    expect(monthReminder(ist('2027-01-02T09:00:00'))).toMatchObject({ month: 'December', from: '2026-12-01', to: '2026-12-31' });
    expect(monthReminder(ist('2028-03-01T09:00:00'))).toMatchObject({ month: 'February', to: '2028-02-29' });
    expect(monthReminder(ist('2027-03-01T09:00:00'))).toMatchObject({ to: '2027-02-28' });
  });
  it('Uses the India date, not the server\'s: 1 Nov 1 am in India is still 31 Oct in UTC', () => {
    expect(monthReminder(ist('2026-11-01T01:00:00'))).toMatchObject({ month: 'October' });
  });
});

describe('days and labels', () => {
  it('Whole days waited', () => {
    const now = ist('2026-10-12T19:00:00');
    expect(daysSince(ist('2026-10-12T09:00:00'), now)).toBe(0);
    expect(daysSince(ist('2026-10-11T18:00:00'), now)).toBe(1);
    expect(daysSince(ist('2026-10-09T19:00:00'), now)).toBe(3);
    expect(daysSince(ist('2026-10-13T09:00:00'), now)).toBe(0);
  });
  it('The day label and the month, in India time', () => {
    expect(dayLabel(ist('2026-10-12T19:00:00'))).toBe('Mon 12 Oct');
    expect(dayLabel(ist('2026-10-13T00:30:00'))).toBe('Tue 13 Oct');
    expect(monthName(ist('2026-11-01T00:30:00'))).toBe('November');
    expect(monthStart(ist('2026-10-12T19:00:00')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });
});
