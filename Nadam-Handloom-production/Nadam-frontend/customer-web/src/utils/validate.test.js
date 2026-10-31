import { describe, it, expect } from 'vitest';
import { cleanMobile, mobileError, nameError, emailError, pincodeError, cityError, dobError, anniversaryError, safeNext } from './validate.js';

describe('field rules (same as the server)', () => {
  it('mobile numbers: +91, spaces and a leading 0 are fine; others are refused', () => {
    expect(cleanMobile('+91 98765 43210')).toBe('9876543210');
    expect(cleanMobile('09876543210')).toBe('9876543210');
    expect(mobileError('98765 43210')).toBeNull();
    for (const bad of ['12345', '5876543210', '', 'abcdefghij']) expect(mobileError(bad)).toMatch(/10-digit/);
  });

  it('names: 2 to 60 letters, any Indian script', () => {
    expect(nameError('Priya Sharma')).toBeNull();
    expect(nameError('ప్రియ శర్మ')).toBeNull();
    expect(nameError("D'Souza-Rao")).toBeNull();
    expect(nameError('A')).toBe('Enter your full name.');
    expect(nameError('x'.repeat(61))).toMatch(/60 characters/);
    expect(nameError('Priya <b>')).toMatch(/letters only/);
  });

  it('email, pincode, city', () => {
    expect(emailError('priya@example.com')).toBeNull();
    expect(emailError('priya@')).toMatch(/valid email/);
    expect(emailError('')).toBe('Enter your email address.');
    expect(pincodeError('522503')).toBeNull();
    expect(pincodeError('052250')).toMatch(/6-digit/);
    expect(cityError('Mangalagiri')).toBeNull();
    expect(cityError('M')).toMatch(/city/);
  });

  it('date of birth: real dates, 13 or older; anniversary not in the future', () => {
    expect(dobError('')).toBeNull();
    expect(dobError('1992-04-15')).toBeNull();
    expect(dobError('1990-02-30')).toBe('Use a valid date.');
    expect(dobError(`${new Date().getFullYear() - 5}-01-01`)).toMatch(/13 or older/);
    expect(anniversaryError('2015-11-20')).toBeNull();
    expect(anniversaryError(`${new Date().getFullYear() + 1}-01-01`)).toMatch(/future/);
  });

  it('after sign-in, only pages on this website (no open redirects)', () => {
    expect(safeNext('/account/addresses')).toBe('/account/addresses');
    expect(safeNext('/account?tab=x')).toBe('/account?tab=x');
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', null, '/sign-in?next=/x']) expect(safeNext(bad)).toBe('/account');
  });
});
