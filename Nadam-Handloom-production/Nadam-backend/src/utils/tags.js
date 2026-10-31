// Tag (barcode) rules, the same as the old backend (backend/src/utils/barcode.ts) so a
// tag reads the same in the old and the new app. Docs Module 4, section 8.
//
// - Spaces removed and capitals: "nh 001" and "NH001" are one tag.
// - Retail barcodes match in every form the camera may report (UPC-A, UPC-E,
//   EAN-13, 14-digit): one printed label can decode as any of them.
// - The shop's tags are letters then a number (NH3136): staff can type just the
//   number to find a saree. Adding a saree needs the whole tag (the app adds NH
//   to a typed number before sending).

export const normalizeTag = (code) => String(code ?? '').replace(/\s+/g, '').toUpperCase();

// 3–64 printable characters. "~" is kept out: freed tags are renamed with it.
export const TAG_PATTERN = /^[!-}]{3,64}$/;
export const isValidTag = (code) => TAG_PATTERN.test(code);

const isDigits = (v) => /^[0-9]+$/.test(v);

// The full 12-digit UPC-A form of an 8-digit UPC-E code, or null.
export function expandUpcE(code) {
  if (code.length !== 8 || !isDigits(code)) return null;
  const ns = code[0];
  if (ns !== '0' && ns !== '1') return null;
  const [d1, d2, d3, d4, d5, last] = code.slice(1, 7).split('');
  const check = code[7];
  let maker;
  let item;
  if (last === '0' || last === '1' || last === '2') { maker = `${d1}${d2}${last}00`; item = `00${d3}${d4}${d5}`; }
  else if (last === '3') { maker = `${d1}${d2}${d3}00`; item = `000${d4}${d5}`; }
  else if (last === '4') { maker = `${d1}${d2}${d3}${d4}0`; item = `0000${d5}`; }
  else { maker = `${d1}${d2}${d3}${d4}${d5}`; item = `0000${last}`; }
  return `${ns}${maker}${item}${check}`;
}

// The 8-digit UPC-E form of a 12-digit UPC-A, when one exists.
function compressUpcA(code) {
  if (code.length !== 12 || !isDigits(code)) return null;
  const ns = code[0];
  if (ns !== '0' && ns !== '1') return null;
  const check = code[11];
  const m = code.slice(1, 6).split('');
  const p = code.slice(6, 11).split('');
  if ((m[2] === '0' || m[2] === '1' || m[2] === '2') && p[0] === '0' && p[1] === '0' && p[2] === '0') return `${ns}${m[0]}${m[1]}${p[3]}${p[4]}${m[2]}${check}`;
  if (m[3] === '0' && p[0] === '0' && p[1] === '0' && p[2] === '0' && p[3] === '0') return `${ns}${m[0]}${m[1]}${m[2]}${p[4]}3${check}`;
  if (m[4] === '0' && p[0] === '0' && p[1] === '0' && p[2] === '0' && p[3] === '0') return `${ns}${m[0]}${m[1]}${m[2]}${m[3]}${p[4]}4${check}`;
  if (p[0] === '0' && p[1] === '0' && p[2] === '0' && p[3] === '0' && Number(p[4]) >= 5) return `${ns}${m[0]}${m[1]}${m[2]}${m[3]}${m[4]}${p[4]}${check}`;
  return null;
}

// Every stored form that could be the same physical tag, the tidy form first.
export function tagCandidates(code) {
  const canonical = normalizeTag(code);
  if (!canonical) return [];
  const out = new Set([canonical]);
  if (isDigits(canonical)) {
    if (canonical.length <= 14) {
      const gtin14 = canonical.padStart(14, '0');
      out.add(gtin14);
      for (const width of [13, 12, 8]) if (gtin14.slice(0, 14 - width) === '0'.repeat(14 - width)) out.add(gtin14.slice(14 - width));
      if (gtin14.startsWith('00')) {
        const short = compressUpcA(gtin14.slice(2));
        if (short) out.add(short);
      }
    }
    const expanded = expandUpcE(canonical);
    if (expanded) {
      out.add(expanded);
      out.add(expanded.padStart(14, '0'));
      out.add(`0${expanded}`);
    }
  }
  return [...out];
}

// The number printed after the letters: "NH3136" → "3136". Null for codes that
// aren't letters-then-digits (retail barcodes, SKUs).
export function tagNumber(code) {
  const m = /^[A-Z]+([0-9]+)$/.exec(normalizeTag(code));
  return m ? m[1] : null;
}
export const isBareNumber = (code) => isDigits(normalizeTag(code));

// A tag that is freed (its saree deleted, or an extra tag taken off) is renamed so
// the number can go on another saree; the activity log keeps the original.
export const freedName = (code, why, id) => `${code}~${why}~${id.slice(0, 8)}`;
export const isFreedName = (code) => code.includes('~');
export const originalOf = (code) => code.split('~')[0];
