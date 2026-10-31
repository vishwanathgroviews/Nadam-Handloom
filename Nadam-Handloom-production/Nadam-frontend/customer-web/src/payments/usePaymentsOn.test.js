// Who may pay online (W6): everyone once payments are on; while tried, only listed customers.
import { describe, it, expect } from 'vitest';
import { paymentsOpen } from './usePaymentsOn.js';

describe('paying online is open', () => {
  it('off: nobody; on: everyone; tried on the live website: only the customers the server lists', () => {
    expect(paymentsOpen({ enabled: false }, { payOnline: true })).toBe(false);
    expect(paymentsOpen(undefined, null)).toBe(false);
    expect(paymentsOpen({ enabled: true }, null)).toBe(true);
    expect(paymentsOpen({ enabled: true, testersOnly: true }, null)).toBe(false);
    expect(paymentsOpen({ enabled: true, testersOnly: true }, { payOnline: false })).toBe(false);
    expect(paymentsOpen({ enabled: true, testersOnly: true }, { payOnline: true })).toBe(true);
  });
});
