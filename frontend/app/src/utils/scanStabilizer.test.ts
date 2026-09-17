import { describe, expect, it } from 'vitest';
import { ScanStabilizer } from './scanStabilizer';

describe('ScanStabilizer', () => {
  it('withholds a value until it has been read twice', () => {
    const s = new ScanStabilizer();
    expect(s.offer('NH001', 0)).toBeNull();
    expect(s.offer('NH001', 40)).toBe('NH001');
  });

  // The "a different number appeared" bug: one bad frame decoded a fragment
  // of the label as a shorter symbology. A misread does not repeat, so it
  // never reaches the caller.
  it('drops a one-off misread between good frames', () => {
    const s = new ScanStabilizer();
    expect(s.offer('NH001', 0)).toBeNull();
    expect(s.offer('7412', 30)).toBeNull(); // spurious short decode
    expect(s.offer('NH001', 60)).toBeNull(); // count restarted, not confirmed yet
    expect(s.offer('NH001', 90)).toBe('NH001');
  });

  it('never returns a value that was only ever seen once', () => {
    const s = new ScanStabilizer();
    for (const [i, code] of ['A', 'B', 'C', 'D'].entries()) {
      expect(s.offer(code, i * 30)).toBeNull();
    }
  });

  it('starts over once the agreement window has passed', () => {
    const s = new ScanStabilizer(2, 1000);
    expect(s.offer('NH001', 0)).toBeNull();
    // Same code, but so much later that it is a fresh sighting, not agreement.
    expect(s.offer('NH001', 5000)).toBeNull();
    expect(s.offer('NH001', 5030)).toBe('NH001');
  });

  it('resets after confirming, so the next scan needs its own agreement', () => {
    const s = new ScanStabilizer();
    s.offer('NH001', 0);
    expect(s.offer('NH001', 30)).toBe('NH001');
    expect(s.offer('NH001', 60)).toBeNull();
    expect(s.offer('NH001', 90)).toBe('NH001');
  });

  it('can demand more agreement in a noisy environment', () => {
    const s = new ScanStabilizer(3);
    expect(s.offer('NH001', 0)).toBeNull();
    expect(s.offer('NH001', 30)).toBeNull();
    expect(s.offer('NH001', 60)).toBe('NH001');
  });

  it('ignores an empty decode', () => {
    const s = new ScanStabilizer();
    expect(s.offer('', 0)).toBeNull();
    expect(s.offer('', 30)).toBeNull();
  });

  it('forgets a partial run when reset', () => {
    const s = new ScanStabilizer();
    s.offer('NH001', 0);
    s.reset();
    expect(s.offer('NH001', 30)).toBeNull();
  });
});
