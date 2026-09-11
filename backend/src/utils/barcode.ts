/**
 * Canonical form for any scanned or typed code (a piece barcode or a SKU).
 *
 * Piece.barcode is a plain unique string column, so a raw lookup is exact and
 * case-sensitive: a piece stored as "NANDAM2273" is simply not found when the
 * scanner reports "nandam2273". That mismatch is easy to hit in practice —
 * the app's manual-entry fields force-uppercase what staff type
 * (autoCapitalize="characters") while the camera hands back the label's raw
 * value, so the same physical tag can be stored one way and scanned the
 * other.
 *
 * Canonicalizing on every write and every read fixes both directions at once:
 * lookups stop depending on how the code was originally entered, and the
 * unique index starts enforcing real uniqueness (a code can't be claimed
 * twice by varying its case).
 *
 * Generated SKUs are already uppercase, so the same normalization is safe for
 * the SKU fallback path that scanning shares.
 */
export const normalizeBarcode = (code: string): string => code.trim().toUpperCase();
