import { describe, expect, it } from 'vitest';
import { formatShipTo } from './shipTo';

describe('formatShipTo', () => {
  it('lays out a full postal address over three lines', () => {
    expect(
      formatShipTo({
        fullName: 'Lakshmi Rao',
        line1: '12 Temple Street',
        line2: 'Near the market',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520001',
      })
    ).toBe('Lakshmi Rao\n12 Temple Street, Near the market\nVijayawada, Andhra Pradesh - 520001');
  });

  // The shape a WhatsApp order now arrives in: the whole address as one block
  // in line1, everything else blank. The old fixed template printed an empty
  // first line and a bare ", - " under it.
  it('prints a single free-text address on its own, with no blank lines or stray punctuation', () => {
    expect(
      formatShipTo({
        fullName: '',
        line1: 'Lakshmi Rao, 12 Temple Street, Vijayawada, AP - 520001',
        line2: null,
        city: '',
        state: '',
        pincode: '',
      })
    ).toBe('Lakshmi Rao, 12 Temple Street, Vijayawada, AP - 520001');
  });

  it('keeps a pincode even when the city and state are missing', () => {
    expect(formatShipTo({ line1: '5 Market Road', pincode: '522001' })).toBe('5 Market Road\n522001');
  });

  it('joins city and state without a dangling pincode separator', () => {
    expect(formatShipTo({ line1: '5 Market Road', city: 'Guntur', state: 'AP' })).toBe('5 Market Road\nGuntur, AP');
  });

  it('returns an empty string when there is nothing to show', () => {
    expect(formatShipTo({})).toBe('');
    expect(formatShipTo({ fullName: '  ', line1: '' })).toBe('');
  });
});
