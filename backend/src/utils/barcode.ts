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
 *
 * Whitespace inside the value is stripped too, not just at the ends: some
 * scanner/keyboard-wedge paths inject a stray space, and "NH 001" must not
 * become a second, separate identity for the tag stored as "NH001".
 */
export const normalizeBarcode = (code: string): string =>
  code.replace(/\s+/g, '').toUpperCase();

const isDigits = (value: string): boolean => /^[0-9]+$/.test(value);

/**
 * Expands a zero-suppressed UPC-E code to its full 12-digit UPC-A form.
 * Returns null if `code` isn't a well-formed 8-digit UPC-E.
 *
 * This matters because a scanner reports whichever symbology it happened to
 * decode: the very same printed label can come back as UPC-E on one frame
 * and UPC-A on the next, and the two strings share not a single character.
 * See GS1's UPC-E specification for the six expansion cases below.
 */
export const expandUpcE = (code: string): string | null => {
  if (code.length !== 8 || !isDigits(code)) return null;
  const numberSystem = code[0]!;
  // Only number systems 0 and 1 have a UPC-E encoding.
  if (numberSystem !== '0' && numberSystem !== '1') return null;

  const body = code.slice(1, 7); // the six compressed digits
  const checkDigit = code[7]!;
  const [d1, d2, d3, d4, d5, lastDigit] = body.split('') as [string, string, string, string, string, string];

  let manufacturer: string;
  let product: string;
  switch (lastDigit) {
    case '0':
    case '1':
    case '2':
      manufacturer = `${d1}${d2}${lastDigit}00`;
      product = `00${d3}${d4}${d5}`;
      break;
    case '3':
      manufacturer = `${d1}${d2}${d3}00`;
      product = `000${d4}${d5}`;
      break;
    case '4':
      manufacturer = `${d1}${d2}${d3}${d4}0`;
      product = `0000${d5}`;
      break;
    default: // 5-9
      manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
      product = `0000${lastDigit}`;
      break;
  }
  return `${numberSystem}${manufacturer}${product}${checkDigit}`;
};

/** Inverse of expandUpcE — the 8-digit UPC-E form of a 12-digit UPC-A, when one exists. */
const compressUpcA = (code: string): string | null => {
  if (code.length !== 12 || !isDigits(code)) return null;
  const numberSystem = code[0]!;
  if (numberSystem !== '0' && numberSystem !== '1') return null;
  const check = code[11]!;
  const manufacturer = code.slice(1, 6);
  const product = code.slice(6, 11);

  const m = manufacturer.split('') as [string, string, string, string, string];
  const p = product.split('') as [string, string, string, string, string];

  if ((m[2] === '0' || m[2] === '1' || m[2] === '2') && p[0] === '0' && p[1] === '0' && p[2] === '0') {
    return `${numberSystem}${m[0]}${m[1]}${p[3]}${p[4]}${m[2]}${check}`;
  }
  if (m[3] === '0' && p[0] === '0' && p[1] === '0' && p[2] === '0' && p[3] === '0') {
    return `${numberSystem}${m[0]}${m[1]}${m[2]}${p[4]}3${check}`;
  }
  if (m[4] === '0' && p[0] === '0' && p[1] === '0' && p[2] === '0' && p[3] === '0') {
    return `${numberSystem}${m[0]}${m[1]}${m[2]}${m[3]}${p[4]}4${check}`;
  }
  if (p[0] === '0' && p[1] === '0' && p[2] === '0' && p[3] === '0' && Number(p[4]) >= 5) {
    return `${numberSystem}${m[0]}${m[1]}${m[2]}${m[3]}${m[4]}${p[4]}${check}`;
  }
  return null;
};

/**
 * Every stored form that could legitimately be the same physical tag as
 * `code`, canonical form first.
 *
 * A camera does not report "the barcode" — it reports whichever symbology it
 * decoded this frame, and the GTIN family overlaps: one printed label is
 * UPC-A "036000291452", EAN-13 "0036000291452" and UPC-E "03600029" all at
 * once. expo-camera hands back whichever it matched, so scanning the same tag
 * twice can genuinely yield two different strings — which is why a second
 * scan used to come back "No product found" after the first had worked, and
 * why a code could look like it had changed between scans.
 *
 * Matching on the whole family instead of one exact string makes a lookup
 * independent of which symbology won a given frame. Non-numeric codes (the
 * Code128/Code39 tags this shop actually prints, and SKUs) have exactly one
 * form and fall through unchanged.
 */
export const barcodeCandidates = (code: string): string[] => {
  const canonical = normalizeBarcode(code);
  if (!canonical) return [];
  const out = new Set<string>([canonical]);

  if (isDigits(canonical)) {
    // GTIN-14 is the widest form; every shorter form is it with leading
    // zeros removed, so padding to 14 gives one key the whole family shares.
    if (canonical.length <= 14) {
      const gtin14 = canonical.padStart(14, '0');
      out.add(gtin14);
      for (const width of [13, 12, 8]) {
        const trimmed = gtin14.slice(14 - width);
        // Only a form that keeps every significant digit is the same code.
        if (gtin14.slice(0, 14 - width) === '0'.repeat(14 - width)) out.add(trimmed);
      }
      const upcA = gtin14.slice(2); // 12-digit form
      if (gtin14.slice(0, 2) === '00') {
        const compressed = compressUpcA(upcA);
        if (compressed) out.add(compressed);
      }
    }
    // A UPC-E read has to be expanded, not just zero-padded.
    const expanded = expandUpcE(canonical);
    if (expanded) {
      out.add(expanded);
      out.add(expanded.padStart(14, '0'));
      out.add(`0${expanded}`);
    }
  }

  return [...out];
};
