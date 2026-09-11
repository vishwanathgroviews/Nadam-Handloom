import { describe, expect, it } from 'vitest';
import { formatPrice, discountPercent } from './format';

describe('formatPrice', () => {
  it('formats a number as INR currency with no decimals', () => {
    expect(formatPrice(2999)).toBe('₹2,999');
  });

  it('formats large numbers with Indian digit grouping', () => {
    expect(formatPrice(1234567)).toBe('₹12,34,567');
  });

  it('handles string input by coercing to a number', () => {
    expect(formatPrice('4999')).toBe('₹4,999');
  });

  it('falls back to ₹0 for invalid input', () => {
    expect(formatPrice(undefined)).toBe('₹0');
    expect(formatPrice(null)).toBe('₹0');
    expect(formatPrice('not-a-number')).toBe('₹0');
  });
});

describe('discountPercent', () => {
  it('computes a rounded percentage off', () => {
    expect(discountPercent(4999, 3499)).toBe(30);
  });

  it('returns 0 when price equals or exceeds mrp', () => {
    expect(discountPercent(1000, 1000)).toBe(0);
    expect(discountPercent(1000, 1200)).toBe(0);
  });

  it('returns 0 when mrp is missing or zero', () => {
    expect(discountPercent(0, 500)).toBe(0);
    expect(discountPercent(undefined, 500)).toBe(0);
  });
});
