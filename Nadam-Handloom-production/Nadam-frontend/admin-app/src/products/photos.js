// Saree photos on the phone: each one fitted to the website's product card (3:4,
// portrait) and shrunk, then kept in the app's own folder until the server has it,
// so nothing is lost if the app closes (decisions 6.4, 6.13).
import { Image } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { cardArea } from '../utils/products';

const MAX_HEIGHT = 1600; // the server makes it 80 KB or less
const folder = () => {
  const dir = new Directory(Paths.document, 'saree-photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};
export const sizeOf = (uri) => new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));

// shift: -1 … 1 moves the 3:4 frame (0 = centred). Returns the kept file's uri.
export async function fitToCard(src, { width, height, shift = 0, name }) {
  const size = width && height ? { width, height } : await sizeOf(src);
  const ctx = ImageManipulator.manipulate(src);
  const area = cardArea(size.width, size.height, shift);
  ctx.crop(area);
  if (area.height > MAX_HEIGHT) ctx.resize({ width: null, height: MAX_HEIGHT });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const kept = new File(folder(), `${name || Date.now().toString(36)}.jpg`);
  if (kept.exists) kept.delete();
  await new File(out.uri).move(kept);
  return kept.uri;
}

export function removePhoto(uri) {
  try {
    const f = new File(uri);
    if (f.exists && uri.includes('saree-photos')) f.delete();
  } catch {
    // already gone
  }
}
export const photoExists = (uri) => { try { return !!uri && new File(uri).exists; } catch { return false; } };
