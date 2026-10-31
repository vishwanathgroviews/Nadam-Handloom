import { describe, it, expect } from 'vitest';
import { cardLabel, wordMeansCraft } from './crafts.js';

describe('crafts', () => {
  it('a card shows its collection, or its craft when the saree is named after the collection', () => {
    expect(cardLabel({ name: 'Peacock blouse', craft: 'embroidery', collection: { name: 'Gap border Embroidery sarees' } })).toBe('Gap border Embroidery sarees');
    expect(cardLabel({ name: 'Gap border Embroidery sarees', craft: 'embroidery', collection: { name: 'Gap Border Embroidery Sarees ' } })).toBe('Embroidery');
    expect(cardLabel({ name: 'X', craft: null, collection: { name: 'X' } })).toBe('Mangalagiri handloom');
    expect(cardLabel({ name: 'X', craft: 'pure', collection: { name: 'Y' } }, 'craft')).toBe('Pure Pattu & Plain');
  });

  it('search words that mean a craft, the shop\'s own spellings included', () => {
    expect(wordMeansCraft('kalankari', 'kalamkari')).toBe(true);
    expect(wordMeansCraft('Embroidered', 'embroidery')).toBe(true);
    expect(wordMeansCraft('print', 'digital')).toBe(true);
    expect(wordMeansCraft('print', 'screen')).toBe(true);
    expect(wordMeansCraft('red', 'pure')).toBe(false);
    expect(wordMeansCraft('pat', 'pure')).toBe(false);
    expect(wordMeansCraft('kalamkari', null)).toBe(false);
  });
});
