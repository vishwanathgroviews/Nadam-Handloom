// Synchronous guards against overlapping async calls for the same logical
// operation — e.g. expo-camera's onBarcodeScanned firing several times in a
// row for one physical scan before React has committed the state update
// from the first fire. A `useState` boolean/array isn't visible to a call
// that starts before the previous one's state update lands (the bug this
// exists to prevent), so both primitives here hold their value in a plain
// field instead, read/written synchronously in the same tick as the check.

/** One-at-a-time lock: a second tryAcquire() before release() is rejected. */
export class SingleFireLock {
  private locked = false;

  tryAcquire(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }

  get isLocked(): boolean {
    return this.locked;
  }
}

/**
 * A set of claimed keys (e.g. scanned barcodes staged before "Create
 * Product" is pressed). `claim` atomically checks-and-inserts — there is no
 * separate `has()` + push in caller code for a race to land between.
 */
export class ClaimSet<T> {
  private items: T[];

  constructor(initial: T[] = []) {
    this.items = [...initial];
  }

  has(item: T): boolean {
    return this.items.includes(item);
  }

  /** Returns true and claims the item if it wasn't already claimed; false (no-op) otherwise. */
  claim(item: T): boolean {
    if (this.items.includes(item)) return false;
    this.items.push(item);
    return true;
  }

  release(item: T): void {
    this.items = this.items.filter((i) => i !== item);
  }

  toArray(): T[] {
    return [...this.items];
  }

  reset(items: T[] = []): void {
    this.items = [...items];
  }
}
