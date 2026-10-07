import sharp from 'sharp';
import { BadRequestError } from './errors';

// The API runs on a 1 GB machine next to everything else. One picture at a
// time and no decoded-image cache keeps an upload from pushing it into swap.
sharp.cache(false);
sharp.concurrency(1);

// Every picture a customer's phone downloads — product, category and
// subcategory photos — is stored at or under this size. A listing page shows
// 12 of them at once: at the ~600 KB the staff app uploads, that page was
// about 7 MB and took many seconds on mobile data.
export const MAX_PICTURE_BYTES = 80 * 1024;

// What a stored picture always is, whatever was uploaded. JPEG rather than
// WebP because the catalog PDF embeds these same files and pdfkit reads only
// JPEG and PNG.
export const STORED_PICTURE = { contentType: 'image/jpeg', filename: 'picture.jpg' } as const;

// Longest edge, largest first. 960 leaves a 3:4 saree photo at 720 x 960,
// which is sharp on a phone; the smaller ones are only reached by photos too
// detailed to fit the limit at that size.
const PICTURE_EDGES = [960, 854, 800, 720, 640];
const QUALITIES = [70, 60, 50, 42];

export interface CompressOptions {
  maxBytes?: number;
  edges?: number[];
}

/**
 * Shrinks an uploaded picture to a JPEG no bigger than `maxBytes`.
 *
 * Tries the largest size at the best quality first and steps down — quality
 * before size, since a slightly softer 720 px photo shows more of the weave
 * than a crisp 480 px one. A photo that fits nowhere comes back at the
 * smallest size and lowest quality, which is still far below what came in.
 *
 * The result carries no EXIF: the phone's orientation is applied to the
 * pixels first, and the location a camera embeds is dropped with the rest.
 */
export const compressPicture = async (input: Buffer, options: CompressOptions = {}): Promise<Buffer> => {
  const maxBytes = options.maxBytes ?? MAX_PICTURE_BYTES;
  const edges = options.edges ?? PICTURE_EDGES;
  const largest = edges[0]!;

  let base: { data: Buffer; info: sharp.OutputInfo };
  try {
    // Decoded once at the largest size; every attempt below starts from
    // these pixels instead of re-reading a multi-megabyte upload.
    base = await sharp(input)
      .rotate()
      // JPEG has no transparency — without this a cut-out PNG turns black.
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .resize({ width: largest, height: largest, fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new BadRequestError('This picture could not be read. Please choose another one.');
  }

  const { data, info } = base;
  const fromPixels = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });

  let smallest: Buffer | null = null;
  for (const edge of edges) {
    for (const quality of QUALITIES) {
      const attempt = await fromPixels()
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (attempt.length <= maxBytes) return attempt;
      if (!smallest || attempt.length < smallest.length) smallest = attempt;
    }
  }
  return smallest!;
};
