// While payments run on Razorpay's test keys, the bag and checkout say no real money is taken.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TestPayNote from './TestPayNote.jsx';

const cfg = vi.hoisted(() => ({ payments: null }));
vi.mock('../config/useConfig.js', () => ({ useConfig: () => ({ config: { payments: cfg.payments } }) }));

describe('the test payment note', () => {
  it('shows only while payments are on with test keys', () => {
    cfg.payments = { enabled: true, mode: 'test' };
    const { unmount } = render(<TestPayNote />);
    expect(screen.getByRole('note')).toHaveTextContent('Test payment: no real money is taken');
    expect(screen.getByRole('note')).toHaveTextContent('4111 1111 1111 1111');
    unmount();
    for (const payments of [{ enabled: true, mode: 'live' }, { enabled: false, mode: null }, null]) {
      cfg.payments = payments;
      const r = render(<TestPayNote short />);
      expect(screen.queryByRole('note')).toBeNull();
      r.unmount();
    }
    cfg.payments = { enabled: true, mode: 'test' };
    render(<TestPayNote short />);
    expect(screen.getByRole('note')).toHaveTextContent('Test payment: no real money is taken.');
  });
});
