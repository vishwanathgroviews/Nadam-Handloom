import { describe, expect, it } from 'vitest';
import { parseSortOrder } from './sortOrder';

describe('parseSortOrder', () => {
  it('reads a position the user typed', () => {
    expect(parseSortOrder('3')).toBe(3);
    expect(parseSortOrder(' 12 ')).toBe(12);
  });

  it('keeps zero, which is a real first position', () => {
    expect(parseSortOrder('0')).toBe(0);
  });

  // Number('') is 0, so a blank box used to read as "move this to the front"
  // rather than "leave it where it is".
  it('treats a blank box as "no change", not as position zero', () => {
    expect(parseSortOrder('')).toBeUndefined();
    expect(parseSortOrder('   ')).toBeUndefined();
  });

  // Number('abc') is NaN, which serialises to null and fails validation
  // server-side — the save looked like it worked and nothing moved.
  it('ignores anything that is not a whole, non-negative number', () => {
    expect(parseSortOrder('abc')).toBeUndefined();
    expect(parseSortOrder('1.5')).toBeUndefined();
    expect(parseSortOrder('-2')).toBeUndefined();
  });
});
