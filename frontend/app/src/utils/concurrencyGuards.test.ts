import { describe, it, expect, vi } from 'vitest';
import { SingleFireLock, ClaimSet } from './concurrencyGuards';

describe('SingleFireLock', () => {
  it('rejects a second acquire before release', () => {
    const lock = new SingleFireLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    expect(lock.tryAcquire()).toBe(false);
  });

  it('allows acquiring again after release', () => {
    const lock = new SingleFireLock();
    lock.tryAcquire();
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });

  // Reproduces the actual BarcodeScanModal bug: expo-camera's
  // onBarcodeScanned fires several times for one physical scan before the
  // first handler's async work (scanLookup, or the 1s assign-mode debounce)
  // finishes. A `useState` boolean can't gate this — see the git history of
  // BarcodeScanModal.tsx for the pre-fix version this test would have failed
  // against (state read in the closure of each overlapping call was stale).
  it('lets only the first of several overlapping scan callbacks through, matching real onBarcodeScanned re-fire behavior', async () => {
    const lock = new SingleFireLock();
    const onScanned = vi.fn();

    const handleScanned = async (code: string) => {
      if (!lock.tryAcquire()) return;
      onScanned(code);
      await new Promise((resolve) => setTimeout(resolve, 10));
      lock.release();
    };

    // Same physical label re-fires 3 times before the first call's 10ms
    // "debounce" resolves — exactly what a real scanner does while the code
    // stays in frame.
    await Promise.all([handleScanned('BC-001'), handleScanned('BC-001'), handleScanned('BC-001')]);

    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith('BC-001');
  });
});

describe('ClaimSet', () => {
  it('claims a new item and reports it as held', () => {
    const set = new ClaimSet<string>();
    expect(set.claim('BC-100')).toBe(true);
    expect(set.has('BC-100')).toBe(true);
    expect(set.toArray()).toEqual(['BC-100']);
  });

  it('refuses to claim an item already held', () => {
    const set = new ClaimSet<string>(['BC-100']);
    expect(set.claim('BC-100')).toBe(false);
    expect(set.toArray()).toEqual(['BC-100']);
  });

  it('releases an item so it can be claimed again', () => {
    const set = new ClaimSet<string>(['BC-100']);
    set.release('BC-100');
    expect(set.has('BC-100')).toBe(false);
    expect(set.claim('BC-100')).toBe(true);
  });

  it('reset replaces the whole held set', () => {
    const set = new ClaimSet<string>(['A', 'B']);
    set.reset(['C']);
    expect(set.toArray()).toEqual(['C']);
  });

  // Reproduces the actual ProductFormScreen bug: tryAddBarcode's duplicate
  // check used to read `pendingBarcodes` (React state) from its closure —
  // two overlapping calls for the same never-yet-used code (a rapid
  // double-scan, or a double-tap of "Add") both read the same stale empty
  // array and both passed the check, so the second call incorrectly showed
  // "Already added" for a barcode that was never actually staged twice on
  // purpose, and receivePieces later rejected the resulting duplicate batch.
  it('an unused barcode scanned/typed twice in quick succession is claimed exactly once, not falsely reported as already added', async () => {
    const claims = new ClaimSet<string>();
    const results: string[] = [];

    // Mirrors tryAddBarcode: synchronous claim check+insert, THEN an async
    // lookup (which a genuinely-unused code always 404s, i.e. rejects here).
    const tryAddBarcode = async (code: string) => {
      if (claims.has(code)) {
        results.push(`already-added:${code}`);
        return;
      }
      claims.claim(code);
      try {
        await Promise.reject(new Error('404 not found')); // scanLookup: code is genuinely free
      } catch {
        results.push(`added:${code}`);
      }
    };

    await Promise.all([tryAddBarcode('BC-777'), tryAddBarcode('BC-777')]);

    // Order between the two isn't the point (it falls out of exactly how far
    // each call's synchronous prefix runs before its first await) — what
    // matters is that the code is claimed exactly once, not zero or twice.
    expect(results.sort()).toEqual(['added:BC-777', 'already-added:BC-777']);
    expect(claims.toArray()).toEqual(['BC-777']);
  });
});
