import { describe, expect, it } from 'vitest';
import { aspectRect, isWholeImage, moveRect, resizeFromCorner, toSourcePixels, MIN_CROP } from './cropMath';

const bounds = { width: 300, height: 400 };

describe('aspectRect', () => {
  it('fits the largest centred square', () => {
    expect(aspectRect(bounds, 1)).toEqual({ x: 0, y: 50, width: 300, height: 300 });
  });
});

describe('moveRect', () => {
  it('keeps the frame inside the image', () => {
    const start = { x: 50, y: 50, width: 100, height: 100 };
    expect(moveRect(start, -500, 1000, bounds)).toEqual({ x: 0, y: 300, width: 100, height: 100 });
  });
});

describe('resizeFromCorner', () => {
  const start = { x: 100, y: 100, width: 100, height: 100 };

  it('keeps the opposite corner fixed', () => {
    const r = resizeFromCorner(start, 'tl', -20, -30, bounds, null);
    expect(r).toEqual({ x: 80, y: 70, width: 120, height: 130 });
    expect(r.x + r.width).toBe(200);
    expect(r.y + r.height).toBe(200);
  });

  it('never shrinks below the minimum or crosses the anchor', () => {
    const r = resizeFromCorner(start, 'br', -500, -500, bounds, null);
    expect(r.width).toBe(MIN_CROP);
    expect(r.height).toBe(MIN_CROP);
    expect(r.x).toBe(100);
  });

  it('never grows past the image edge', () => {
    const r = resizeFromCorner(start, 'br', 1000, 1000, bounds, null);
    expect(r).toEqual({ x: 100, y: 100, width: 200, height: 300 });
  });

  it('keeps the chosen shape', () => {
    const r = resizeFromCorner(start, 'br', 50, 0, bounds, 3 / 4);
    expect(r.width / r.height).toBeCloseTo(3 / 4);
  });
});

describe('toSourcePixels', () => {
  it('scales back to file pixels and stays inside the file', () => {
    expect(toSourcePixels({ x: 10, y: 20, width: 300, height: 400 }, 0.5, { width: 600, height: 800 })).toEqual({
      originX: 20,
      originY: 40,
      width: 580,
      height: 760,
    });
  });
});

describe('isWholeImage', () => {
  it('spots an untouched frame', () => {
    expect(isWholeImage({ x: 0, y: 0, width: 300, height: 400 }, bounds)).toBe(true);
    expect(isWholeImage({ x: 0, y: 10, width: 300, height: 390 }, bounds)).toBe(false);
  });
});
