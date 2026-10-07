import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { compressPicture, MAX_PICTURE_BYTES } from './compressImage';
import { BadRequestError } from './errors';

// A stand-in for a saree photo: bands, checks and a diagonal weave, so the
// encoder has real detail to spend bytes on (a flat colour compresses to
// almost nothing and would prove nothing about the size limit).
const patterned = (width: number, height: number) => {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const check = (Math.floor(x / 37) + Math.floor(y / 53)) % 2 ? 60 : 0;
      pixels[i] = 120 + check + ((x + y) % 23) * 3;
      pixels[i + 1] = 40 + ((x * 3 + y) % 97);
      pixels[i + 2] = 90 + check + ((x ^ y) % 41);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } });
};

describe('compressPicture', () => {
  it('brings a phone-sized photo under the limit as a 720 x 960 JPEG', async () => {
    const upload = await patterned(1800, 2400).jpeg({ quality: 92 }).toBuffer();
    expect(upload.length).toBeGreaterThan(MAX_PICTURE_BYTES * 4);

    const stored = await compressPicture(upload);
    const meta = await sharp(stored).metadata();

    expect(stored.length).toBeLessThanOrEqual(MAX_PICTURE_BYTES);
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeLessThanOrEqual(720);
    expect(meta.height).toBeLessThanOrEqual(960);
    expect(meta.width! / meta.height!).toBeCloseTo(0.75, 2);
  });

  it('never enlarges a picture that is already small', async () => {
    const upload = await patterned(300, 400).jpeg().toBuffer();
    const meta = await sharp(await compressPicture(upload)).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
  });

  // A phone stores a portrait photo as landscape pixels plus an EXIF "turn
  // me" flag. The stored file has no EXIF, so the turn has to be baked in or
  // the saree shows up lying on its side.
  it('applies the camera orientation to the pixels', async () => {
    const upload = await patterned(400, 200).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const meta = await sharp(await compressPicture(upload)).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
    expect(meta.orientation).toBeUndefined();
  });

  it('puts a transparent PNG on white instead of black', async () => {
    const upload = await sharp({
      create: { width: 120, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const stored = await compressPicture(upload);
    const pixels = await sharp(stored).raw().toBuffer();

    expect((await sharp(stored).metadata()).format).toBe('jpeg');
    expect(Array.from(pixels.subarray(0, 3)).every((channel) => channel > 245)).toBe(true);
  });

  // Pure noise is the worst case for JPEG — no real photo is harder to
  // shrink — so if this fits, every upload does.
  const noise = () =>
    sharp({
      create: { width: 1200, height: 1600, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

  it('keeps even the hardest possible picture under the limit', async () => {
    const stored = await compressPicture(await noise());
    expect(stored.length).toBeLessThanOrEqual(MAX_PICTURE_BYTES);
  });

  // With a limit nothing can meet, the upload must still succeed with the
  // smallest version made, not fail or pass the original through.
  it('falls back to the smallest version when nothing fits the limit', async () => {
    const upload = await noise();
    const stored = await compressPicture(upload, { maxBytes: 10 * 1024 });
    const meta = await sharp(stored).metadata();

    expect(stored.length).toBeGreaterThan(10 * 1024);
    expect(stored.length).toBeLessThan(upload.length / 5);
    expect(Math.max(meta.width!, meta.height!)).toBe(640);
  });

  it('honours a different limit and size for wide banners', async () => {
    const upload = await patterned(2400, 1000).jpeg({ quality: 92 }).toBuffer();
    const stored = await compressPicture(upload, { maxBytes: 150 * 1024, edges: [1600, 1280] });
    const meta = await sharp(stored).metadata();

    expect(stored.length).toBeLessThanOrEqual(150 * 1024);
    expect([1600, 1280]).toContain(meta.width);
  });

  it('refuses a file that is not a picture', async () => {
    await expect(compressPicture(Buffer.from('fake-image-bytes'))).rejects.toBeInstanceOf(BadRequestError);
  });
});
