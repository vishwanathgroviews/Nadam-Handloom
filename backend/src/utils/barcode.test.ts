import { describe, expect, it } from 'vitest';
import { barcodeCandidates, barcodeNumber, expandUpcE, normalizeBarcode } from './barcode';

describe('normalizeBarcode', () => {
  it('uppercases and strips surrounding whitespace', () => {
    expect(normalizeBarcode('  nandam2273 ')).toBe('NANDAM2273');
  });

  // A keyboard-wedge scanner (or a careless retype) can inject a space in the
  // middle; that must not become a second identity for the same tag.
  it('strips whitespace inside the code too', () => {
    expect(normalizeBarcode('NH 001')).toBe('NH001');
    expect(normalizeBarcode('NH\t001\n')).toBe('NH001');
  });
});

describe('expandUpcE', () => {
  // Worked through GS1's expansion table by hand: the last body digit picks
  // the case, e.g. "04252614" has body 425261 so d6=1 -> manufacturer
  // 4,2,1,0,0 and product 0,0,5,2,6.
  it.each([
    ['04252614', '042100005264'], // d6 = 1
    ['03600029', '036200000009'], // d6 = 2
    ['01234531', '012300000451'], // d6 = 3
    ['01234541', '012340000051'], // d6 = 4
    ['01234581', '012345000081'], // d6 = 5-9
  ])('expands %s to %s', (upcE, upcA) => {
    expect(expandUpcE(upcE)).toBe(upcA);
  });

  it('rejects anything that is not a well-formed UPC-E', () => {
    expect(expandUpcE('NANDAM01')).toBeNull();
    expect(expandUpcE('52345678')).toBeNull(); // only number systems 0 and 1 have a UPC-E form
    expect(expandUpcE('0360002')).toBeNull(); // too short
  });
});

describe('barcodeCandidates', () => {
  // The bug this exists for: one physical label decodes as UPC-A on one frame
  // and EAN-13 on the next, so the second scan of the same tag looked up a
  // string the database had never seen and came back "No product found".
  it('treats a 12-digit UPC-A and its 13-digit EAN-13 form as the same tag', () => {
    const fromUpcA = barcodeCandidates('036000291452');
    const fromEan13 = barcodeCandidates('0036000291452');

    expect(fromUpcA).toContain('0036000291452');
    expect(fromEan13).toContain('036000291452');
    // Whichever way round it is scanned, the two agree on a shared form.
    expect(fromUpcA.some((c) => fromEan13.includes(c))).toBe(true);
  });

  it('links a UPC-E read back to its expanded UPC-A form', () => {
    expect(barcodeCandidates('04252614')).toContain('042100005264');
  });

  it('puts the canonical form first so it stays the one we store', () => {
    expect(barcodeCandidates('  nandam2273 ')[0]).toBe('NANDAM2273');
  });

  it('leaves a non-numeric tag with exactly one form', () => {
    expect(barcodeCandidates('NH-HCDM-007')).toEqual(['NH-HCDM-007']);
  });

  it('never claims two genuinely different numbers are the same tag', () => {
    const a = barcodeCandidates('036000291452');
    const b = barcodeCandidates('036000291453'); // different check digit
    expect(a.some((c) => b.includes(c))).toBe(false);
  });

  // A zero-padded form only matches when the padding is all that differs —
  // "100000000001" and "1" must stay distinct codes.
  it('does not fold a long code into a short one that merely shares digits', () => {
    const long = barcodeCandidates('100000000001');
    expect(long).not.toContain('1');
  });

  it('returns nothing for an empty code', () => {
    expect(barcodeCandidates('   ')).toEqual([]);
  });
});

describe('barcodeNumber', () => {
  it('returns the digits after the letter prefix', () => {
    expect(barcodeNumber('NANDAM3136')).toBe('3136');
    expect(barcodeNumber('nandam 3136')).toBe('3136');
  });

  it('is null for codes without a letter prefix and number', () => {
    expect(barcodeNumber('3136')).toBeNull();
    expect(barcodeNumber('NH-HPS-001')).toBeNull();
    expect(barcodeNumber('NANDAM')).toBeNull();
  });
});
