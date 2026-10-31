// Photos for categories and subcategories (and products in Module 4): every stored
// photo is a JPEG of 80 KB or less, upright, location data removed, transparency
// turned white. Same steps as the old backend, so the website looks the same.
import sharp from 'sharp';
import { badRequest } from '../utils/errors.js';

sharp.cache(false);
sharp.concurrency(1);

export const MAX_PHOTO_BYTES = 80 * 1024;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EDGES = [960, 854, 800, 720, 640];
const QUALITIES = [70, 60, 50, 42];

export async function compressPhoto(input, { maxBytes = MAX_PHOTO_BYTES, edges = EDGES } = {}) {
  let base;
  try {
    base = await sharp(input)
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .resize({ width: edges[0], height: edges[0], fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest('PHOTO_UNREADABLE', 'This photo could not be read. Please choose another one.');
  }
  const { data, info } = base;
  const fromPixels = () => sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  let smallest = null;
  for (const edge of edges) {
    for (const quality of QUALITIES) {
      const attempt = await fromPixels().resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (attempt.length <= maxBytes) return attempt;
      if (!smallest || attempt.length < smallest.length) smallest = attempt;
    }
  }
  return smallest;
}
