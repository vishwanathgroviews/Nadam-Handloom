import { pinRules, pinAllowed } from './pinRules';
import { normalizeMobile, formatMobile, mobileError, maskMobile } from './phone';

describe('PIN rules match the server', () => {
  it('accepts a normal PIN', () => expect(pinAllowed('482916', '9876543210')).toBe(true));
  it('refuses repeats, runs and the mobile tail', () => {
    expect(pinAllowed('111111', '9876543210')).toBe(false);
    expect(pinAllowed('123456', '9876543210')).toBe(false);
    expect(pinAllowed('654321', '9876543210')).toBe(false);
    expect(pinAllowed('543210', '9876543210')).toBe(false);
  });
  it('shows rules as pending until 6 digits are typed', () => {
    expect(pinRules('12', '9876543210').every((r) => r.ok === null)).toBe(true);
  });
  it('can require a PIN different from the current one', () => {
    expect(pinAllowed('482916', '9876543210', { differentFrom: '482916' })).toBe(false);
  });
});

describe('mobile numbers', () => {
  it('normalises and formats', () => {
    expect(normalizeMobile('+91 98765 43210')).toBe('9876543210');
    expect(formatMobile('9876543210')).toBe('98765 43210');
    expect(maskMobile('9876543210')).toBe('+91 98765 •••10');
  });
  it('explains what is wrong', () => {
    expect(mobileError('')).toMatch(/10-digit/);
    expect(mobileError('98765')).toMatch(/10-digit/);
    expect(mobileError('5876543210')).toMatch(/6, 7, 8 or 9/);
    expect(mobileError('9876543210')).toBeNull();
  });
});
