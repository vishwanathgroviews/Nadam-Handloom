// Tag tidying and matching: the same rules as the old backend (Module 4, section 8).
import { describe, it, expect } from 'vitest';
import { normalizeTag, isValidTag, tagCandidates, tagNumber, isBareNumber, expandUpcE, freedName, originalOf } from '../../src/utils/tags.js';
import { categoryCode, slugify } from '../../src/models/product.model.js';

describe('tags', () => {
  it('removes spaces and uses capitals', () => {
    expect(normalizeTag(' nh 3136 ')).toBe('NH3136');
    expect(normalizeTag('nandam\t2273')).toBe('NANDAM2273');
  });
  it('accepts 3–64 printable characters, never "~" (used for freed tags)', () => {
    expect(isValidTag('NH3')).toBe(true);
    expect(isValidTag('NH')).toBe(false);
    expect(isValidTag('NH3~del~1')).toBe(false);
    expect(isValidTag('A'.repeat(65))).toBe(false);
  });
  it('matches one retail label in every form a camera may report', () => {
    const c = tagCandidates('036000291452');
    expect(c).toEqual(expect.arrayContaining(['036000291452', '0036000291452', '00036000291452']));
    expect(tagCandidates('0036000291452')).toContain('036000291452');
    expect(expandUpcE('01234505')).toBe('012000003455');
    expect(tagCandidates('01234505')).toEqual(expect.arrayContaining(['012000003455', '0012000003455']));
    expect(tagCandidates('NH3136')).toEqual(['NH3136']);
  });
  it('reads the number on a shop tag', () => {
    expect(tagNumber('NH3136')).toBe('3136');
    expect(tagNumber('nandam 172')).toBe('172');
    expect(tagNumber('036000291452')).toBeNull();
    expect(tagNumber('NH-HPS-001')).toBeNull();
    expect(isBareNumber('2264')).toBe(true);
    expect(isBareNumber('NH2264')).toBe(false);
  });
  it('freed tags keep the original visible for the log, and never match a real tag', () => {
    const f = freedName('NH207', 'del', '3f2a91bc-0000');
    expect(f).toBe('NH207~del~3f2a91bc');
    expect(isValidTag(f)).toBe(false);
    expect(originalOf(f)).toBe('NH207');
  });
});

describe('SKU and web address (same as the old app)', () => {
  it('SKU prefix: the category initials, at most 4', () => {
    expect(categoryCode('mangalagiri-handloom-pattu-sarees')).toBe('MHPS');
    expect(categoryCode('handloom-cotton-dress-material-extra')).toBe('HCDM');
    expect(categoryCode('fabrics')).toBe('F');
    expect(categoryCode('')).toBe('GEN');
  });
  it('web address from the name', () => {
    expect(slugify('Rainbow checks sarees')).toBe('rainbow-checks-sarees');
    expect(slugify('50/50 dye Screen Printed Saree')).toBe('50-50-dye-screen-printed-saree');
  });
});
