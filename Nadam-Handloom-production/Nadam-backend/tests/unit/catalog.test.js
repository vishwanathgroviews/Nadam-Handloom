// Module 3 rules that need no database: % off, web addresses, tag numbers, photo size, PDF pages.
import crypto from 'node:crypto';
import sharp from 'sharp';
import { describe, it, expect } from 'vitest';
import { discountPercent, slugify } from '../../src/services/catalog.service.js';
import { tagNumber, renderPdf } from '../../src/services/catalogPdf.service.js';
import { compressPhoto, MAX_PHOTO_BYTES } from '../../src/services/photo.service.js';

describe('% off (same as the website)', () => {
  it('rounds (MRP - price) / MRP, and is 0 without an MRP above the price', () => {
    expect(discountPercent(16999, 2800)).toBe(84);
    expect(discountPercent(2999, 1999)).toBe(33);
    expect(discountPercent(null, 2800)).toBe(0);
    expect(discountPercent(16999, 25888)).toBe(0);
  });
});

describe('web address', () => {
  it('lower case words joined by dashes', () => {
    expect(slugify('MANGALAGIRI HANDLOOM PATTU SAREES')).toBe('mangalagiri-handloom-pattu-sarees');
    expect(slugify('  Cotton & Silk, 50/50! ')).toBe('cotton-silk-50-50');
    expect(slugify('***')).toBe('category');
  });
});

describe('tag numbers on PDF pages', () => {
  it('the number after the letters; codes without letters in full', () => {
    expect(tagNumber('NANDAM3136')).toBe('3136');
    expect(tagNumber('nandam 3137')).toBe('3137');
    expect(tagNumber('8901234567890')).toBe('8901234567890');
  });
});

describe('photo compression', () => {
  it('a large photo becomes a JPEG of 80 KB or less, upright, no metadata', async () => {
    const w = 3000;
    const h = 2000;
    const big = await sharp(crypto.randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).withMetadata({ orientation: 6 }).png().toBuffer();
    const out = await compressPhoto(big);
    expect(out.length).toBeLessThanOrEqual(MAX_PHOTO_BYTES);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(960);
    expect(meta.height).toBeGreaterThan(meta.width); // rotated upright from orientation 6
    expect(meta.orientation).toBeUndefined();
  });
  it('transparency becomes white', async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const { data } = await sharp(await compressPhoto(png)).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);
  });
});

describe('PDF pages', () => {
  it('one A4 page per item', async () => {
    const img = await sharp({ create: { width: 30, height: 40, channels: 3, background: '#aa3344' } }).jpeg().toBuffer();
    const pdf = await renderPdf([{ title: 'Rainbow checks sarees', image: img, ids: '3136, 3137' }, { title: 'Rainbow checks sarees', image: img, ids: null }, { title: 'Rainbow checks sarees', image: img, ids: '42' }]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(3);
  });
});
