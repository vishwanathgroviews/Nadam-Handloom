import { describe, it, expect } from 'vitest';
import { pinProblems, lockMinutes } from '../../src/utils/pin.js';
import { normalizeMobile, maskMobile } from '../../src/utils/phone.js';

describe('PIN rules (plan section 5)', () => {
  it('accepts a normal 6-digit PIN', () => expect(pinProblems('482916', '9876543210')).toEqual([]));
  it('requires exactly 6 digits', () => {
    expect(pinProblems('1357', '9876543210')).toEqual(['length']);
    expect(pinProblems('12345a', '9876543210')).toEqual(['length']);
    expect(pinProblems('1234567', '9876543210')).toEqual(['length']);
  });
  it('refuses the same digit repeated', () => expect(pinProblems('111111', '9876543210')).toContain('all_same'));
  it('refuses straight runs up and down', () => {
    expect(pinProblems('123456', '9876543210')).toContain('sequence');
    expect(pinProblems('654321', '9876543210')).toContain('sequence');
    expect(pinProblems('012345', '9876543210')).toContain('sequence');
  });
  it('refuses the last 6 digits of the mobile number', () => expect(pinProblems('543210', '9876543210')).toContain('mobile_tail'));
});

describe('lock steps', () => {
  it('goes 15 -> 30 -> 60 and stays at 60', () => {
    expect([1, 2, 3, 4, 9].map(lockMinutes)).toEqual([15, 30, 60, 60, 60]);
  });
});

describe('mobile numbers', () => {
  it('normalises common forms to 10 digits', () => {
    expect(normalizeMobile('98765 43210')).toBe('9876543210');
    expect(normalizeMobile('+91 98765-43210')).toBe('9876543210');
    expect(normalizeMobile('09876543210')).toBe('9876543210');
  });
  it('rejects numbers that are not Indian mobiles', () => {
    expect(normalizeMobile('5876543210')).toBeNull();
    expect(normalizeMobile('98765')).toBeNull();
    expect(normalizeMobile('')).toBeNull();
  });
  it('masks the middle digits', () => expect(maskMobile('9876543210')).toBe('+91 98765 •••10'));
});
