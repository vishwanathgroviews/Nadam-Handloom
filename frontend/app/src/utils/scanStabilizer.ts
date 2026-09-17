/**
 * Accepts a decoded barcode only once the camera has read the *same* value
 * several frames running.
 *
 * A single frame is not evidence. expo-camera fires onBarcodeScanned for
 * every frame it can decode something from, and with several symbologies
 * enabled a partial or smudged read can momentarily decode as a shorter
 * symbology (ITF and Codabar have no fixed length and no mandatory check
 * digit, so they will happily match a fragment of a Code128 label) and report
 * a number that was never on the tag. That is the "a different number
 * appeared" bug: the wrong value was real output from one bad frame.
 *
 * A genuine label decodes to the same string on frame after frame; a misread
 * almost never repeats identically. Requiring agreement costs one or two
 * extra frames — tens of milliseconds — and removes the whole class of
 * one-off misreads without needing to guess which symbologies to disable.
 *
 * Deliberately a plain class, not React state: onBarcodeScanned can fire
 * again before React has committed a setState from the previous fire, so a
 * state-based counter would miss reads. Same reasoning as SingleFireLock in
 * concurrencyGuards.ts.
 */
export class ScanStabilizer {
  private candidate: string | null = null;
  private count = 0;
  private firstSeenAt = 0;

  /**
   * @param required  How many agreeing reads to demand (2 is enough to kill
   *                  one-off misreads; 3 for a noisier environment).
   * @param windowMs  Agreement has to happen inside this window — otherwise
   *                  two unrelated sightings minutes apart would count.
   */
  constructor(
    private readonly required = 2,
    private readonly windowMs = 1500
  ) {}

  /** Returns the value once it has been confirmed, or null while still unsure. */
  offer(value: string, now: number = Date.now()): string | null {
    if (!value) return null;

    // Presence is tracked by `candidate`, not by firstSeenAt being non-zero —
    // 0 is a perfectly legitimate timestamp, and treating it as "nothing seen
    // yet" made the very first sighting unable to go stale.
    const staleWindow = this.candidate !== null && now - this.firstSeenAt > this.windowMs;
    if (value !== this.candidate || staleWindow) {
      this.candidate = value;
      this.count = 1;
      this.firstSeenAt = now;
    } else {
      this.count += 1;
    }

    if (this.count >= this.required) {
      this.reset();
      return value;
    }
    return null;
  }

  reset(): void {
    this.candidate = null;
    this.count = 0;
    this.firstSeenAt = 0;
  }
}
