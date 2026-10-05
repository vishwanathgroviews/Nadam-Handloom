import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './apiError';

describe('apiErrorMessage', () => {
  it('shows the reason a form was refused instead of "Validation failed"', () => {
    expect(
      apiErrorMessage({
        message: 'Validation failed',
        details: [{ path: 'mpin', message: 'This MPIN is too easy to guess, please choose another' }],
      })
    ).toBe('This MPIN is too easy to guess, please choose another');
  });

  it('takes the first reason when several fields were refused', () => {
    expect(
      apiErrorMessage({
        message: 'Validation failed',
        details: [
          { path: 'phone', message: 'Phone number must be 10 digits' },
          { path: 'pincode', message: 'Pincode must be 6 digits' },
        ],
      })
    ).toBe('Phone number must be 10 digits');
  });

  it("keeps the server's own message for every other kind of error", () => {
    expect(apiErrorMessage({ message: 'Please wait before requesting another code' })).toBe(
      'Please wait before requesting another code'
    );
    // Details here belong to the error, not to a form check.
    expect(apiErrorMessage({ message: 'Some items are no longer available', details: [{ message: 'Saree A' }] })).toBe(
      'Some items are no longer available'
    );
  });

  it('falls back when the server said nothing useful', () => {
    expect(apiErrorMessage({})).toBe('Something went wrong');
    expect(apiErrorMessage({ message: 'Validation failed', details: [] })).toBe('Validation failed');
    expect(apiErrorMessage(undefined)).toBe('Something went wrong');
  });
});
