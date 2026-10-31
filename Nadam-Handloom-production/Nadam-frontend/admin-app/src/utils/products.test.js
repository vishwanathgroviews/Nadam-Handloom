// Module 4 rules on the phone: tag tidying (the same as the server), the batch order,
// one tag per saree, the 3:4 photo fit and the upload retry timing.
import { batchSummary, cardArea, indexWithTag, isValidTag, itemDone, nextIndex, retryDelay, tagLockReason, tagNumber, tagsOf, tidyTag, typedTag, NEEDS_FIX } from './products';

describe('tags', () => {
  test('tidied like the server: no spaces, capitals', () => {
    expect(tidyTag(' nh 3136 ')).toBe('NH3136');
    expect(isValidTag('NH3')).toBe(true);
    expect(isValidTag('NH')).toBe(false);
    expect(isValidTag('NH3~del~x')).toBe(false);
  });
  test('a typed number alone means an NH tag (rule T6); retail codes stay as they are', () => {
    expect(typedTag('3302')).toBe('NH3302');
    expect(typedTag(' 33 02 ')).toBe('NH3302');
    expect(typedTag('nandam172')).toBe('NANDAM172');
    expect(typedTag('8901234567890')).toBe('8901234567890');
  });
  test('the number on a tag', () => {
    expect(tagNumber('NH2264')).toBe('2264');
    expect(tagNumber('8901234567890')).toBeNull();
  });
  test('why a tag is locked', () => {
    expect(tagLockReason({ status: 'sold_offline' })).toMatch(/sold/i);
    expect(tagLockReason({ status: 'reserved', orderNumber: 'NH-1' })).toMatch(/NH-1/);
    expect(tagLockReason({ status: 'retired' })).toMatch(/can't be used again/);
    expect(tagLockReason({ status: 'in_stock' })).toBeNull();
  });
});

describe('the batch (5.1)', () => {
  const items = (tags) => tags.map((t, i) => ({ id: String(i), tag: t === '-' || t === 's' ? null : t, skipped: t === 's' }));
  test('next photo: untagged first, then skipped ones; -1 when all tagged', () => {
    expect(nextIndex(items(['A', '-', '-']), 0)).toBe(1);
    expect(nextIndex(items(['A', 's', '-']), 0)).toBe(2);
    expect(nextIndex(items(['A', 's', 'C']), 2)).toBe(1);
    expect(nextIndex(items(['-', 'B', 'C']), 2)).toBe(0);
    expect(nextIndex(items(['A', 'B']), 1)).toBe(-1);
  });
  test('one saree, one tag: finds the same tag on another photo', () => {
    const list = items(['NH1', '-', 'NH3']);
    expect(indexWithTag(list, 'NH3', 1)).toBe(2);
    expect(indexWithTag(list, 'NH3', 2)).toBe(-1);
    expect(indexWithTag(list, 'NH9')).toBe(-1);
  });
  test('summary counts (drafts saved before sets have `tag`)', () => {
    const list = [{ tag: 'A', unchecked: true }, { tag: null }, { tag: 'C' }];
    expect(batchSummary(list)).toEqual({ total: 3, tagged: 2, missing: 1, sarees: 2, sets: 0, short: 0, done: 2, unchecked: 1 });
  });
});

describe('a set: one photo, several tags (15 Oct 2026)', () => {
  const set = (tags, want) => ({ tags, want });
  test('a photo is done when it has as many tags as its count', () => {
    expect(itemDone(set([], 1))).toBe(false);
    expect(itemDone(set(['A'], 1))).toBe(true);
    expect(itemDone(set(['A', 'B'], 5))).toBe(false);
    expect(itemDone(set(['A', 'B', 'C', 'D', 'E'], 5))).toBe(true);
    expect(tagsOf({ tag: 'X' })).toEqual(['X']);
    expect(tagsOf({ tags: [] })).toEqual([]);
  });
  test('the next photo skips finished sets but comes back to a short one', () => {
    const list = [set(['A'], 1), set(['B', 'C'], 5), set([], 1)];
    expect(nextIndex(list, 0)).toBe(1);
    expect(nextIndex(list, 1)).toBe(2);
    list[1].tags.push('D', 'E', 'F');
    list[2].tags.push('G');
    expect(nextIndex(list, 2)).toBe(-1);
  });
  test('a tag in a set is found from another photo', () => {
    expect(indexWithTag([set(['A', 'B'], 2), set([], 1)], 'B', 1)).toBe(0);
  });
  test('summary counts sarees and sets', () => {
    expect(batchSummary([set(['A', 'B', 'C'], 5), set(['D'], 1), set([], 1)])).toEqual({ total: 3, tagged: 2, missing: 1, sarees: 4, sets: 1, short: 1, done: 1, unchecked: 0 });
  });
});

describe('photos fit the website card (3:4)', () => {
  test('a tall phone photo keeps its width, cropped top and bottom, centred', () => {
    expect(cardArea(3000, 4000)).toEqual({ originX: 0, originY: 0, width: 3000, height: 4000 });
    expect(cardArea(3000, 5000)).toEqual({ originX: 0, originY: 500, width: 3000, height: 4000 });
    expect(cardArea(3000, 5000, -1).originY).toBe(0);
    expect(cardArea(3000, 5000, 1).originY).toBe(1000);
  });
  test('a wide photo keeps its height, cropped at the sides', () => {
    expect(cardArea(4000, 3000)).toEqual({ originX: 875, originY: 0, width: 2250, height: 3000 });
  });
});

describe('upload queue', () => {
  test('retries wait longer each time, at most 2 minutes', () => {
    expect(retryDelay(1)).toBe(5000);
    expect(retryDelay(2)).toBe(10000);
    expect(retryDelay(10)).toBe(120000);
  });
  test('a taken tag needs the person; a network error is retried', () => {
    expect(NEEDS_FIX.has('TAG_TAKEN')).toBe(true);
    expect(NEEDS_FIX.has('NETWORK')).toBe(false);
  });
});
