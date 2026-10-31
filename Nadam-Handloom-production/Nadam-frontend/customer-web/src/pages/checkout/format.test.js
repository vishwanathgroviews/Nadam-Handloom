import { describe, it, expect } from 'vitest';
import { addressText, clock, gstText } from './format.js';

describe('checkout wording', () => {
  it('times in India time, like "4:35 pm"', () => {
    expect(clock('2026-10-17T11:05:00.000Z')).toBe('4:35 pm');
    expect(clock('2026-10-17T03:30:00.000Z')).toBe('9:00 am');
  });

  it('the GST note: CGST + SGST today; IGST for another state once switched on', () => {
    expect(gstText(10500, 'Telangana', { ratePercent: 5, shopState: 'Andhra Pradesh', igstOtherStates: false })).toBe('Includes GST 5% (₹500): CGST 2.5% + SGST 2.5%');
    expect(gstText(10500, 'Telangana', { ratePercent: 5, shopState: 'Andhra Pradesh', igstOtherStates: true })).toBe('Includes IGST 5% (₹500): delivered to Telangana');
    expect(gstText(10500, 'Andhra Pradesh', { ratePercent: 5, shopState: 'Andhra Pradesh', igstOtherStates: true })).toBe('Includes GST 5% (₹500): CGST 2.5% + SGST 2.5%');
    expect(gstText(10500, null, undefined)).toBe('Includes GST 5% (₹500): CGST 2.5% + SGST 2.5%');
  });

  it('an address on one line, with the landmark', () => {
    expect(addressText({ line1: 'Flat 302', line2: '', landmark: 'Near the temple', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002' })).toBe('Flat 302, Near the temple, Guntur, Andhra Pradesh 522002');
  });
});
