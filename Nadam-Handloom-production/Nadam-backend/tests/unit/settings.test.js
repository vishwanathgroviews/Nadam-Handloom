// Module 11 (Settings): versions, update rules, GSTIN and the printed mobile.
import { describe, it, expect } from 'vitest';
import { buildOf, mustUpdate, GSTIN, mobileText } from '../../src/services/settings.service.js';

describe('app versions (6.4)', () => {
  it('The build number from "2.0.0 (26)"', () => {
    expect(buildOf('2.0.0 (26)')).toBe(26);
    expect(buildOf('2.0.0 (dev)')).toBeNull();
    expect(buildOf(null)).toBeNull();
  });
  it('Update required below the oldest allowed, or below the newest when required', () => {
    expect(mustUpdate({ newest: 26, oldest: 26, required: false }, 25)).toBe(true);
    expect(mustUpdate({ newest: 26, oldest: 0, required: false }, 25)).toBe(false);
    expect(mustUpdate({ newest: 26, oldest: 0, required: true }, 25)).toBe(true);
    expect(mustUpdate({ newest: 26, oldest: 26, required: true }, 26)).toBe(false);
    expect(mustUpdate({ newest: 26, oldest: 26 }, null)).toBe(false);
  });
});

describe('shop details (6.5)', () => {
  it('GSTIN format and the printed mobile', () => {
    expect(GSTIN.test('37CCWPN2487C1Z2')).toBe(true);
    expect(GSTIN.test('37CCWPN2487C1Y2')).toBe(false);
    expect(GSTIN.test('37ccwpn2487c1z2')).toBe(false);
    expect(mobileText('9494170180')).toBe('+91 94941 70180');
    expect(mobileText('+919494170180')).toBe('+919494170180');
  });
});
