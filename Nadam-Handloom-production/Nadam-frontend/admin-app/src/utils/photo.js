// Taking or choosing a photo, and cropping it to the website's tile shape (4:3).
// The phone's own crop is square on iPhone, so the crop is our own (PhotoCropper):
// these helpers do the picking and the final cut.
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const TILE_RATIO = 4 / 3; // the website shows category and subcategory photos as landscape tiles
const MAX_EDGE = 1600; // the server shrinks it further (80 KB or less)

const sizeOf = (uri) => new Promise((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));

// source: 'camera' | 'library'. Resolves { uri, width, height }, or null if cancelled.
export async function pickPhoto(source) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw Object.assign(new Error('Allow the camera for Nandam Admin in the phone\'s Settings to take photos.'), { code: 'NO_CAMERA' });
  }
  const opts = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const size = a.width && a.height ? { width: a.width, height: a.height } : await sizeOf(a.uri);
  return { uri: a.uri, ...size };
}

// Cuts the chosen area (in the photo's own pixels) and saves a JPEG; without an area, the whole photo.
export async function cutPhoto(photo, area) {
  const ctx = ImageManipulator.manipulate(photo.uri);
  let width = photo.width;
  if (area) {
    const crop = {
      originX: Math.max(0, Math.round(area.x)),
      originY: Math.max(0, Math.round(area.y)),
      width: Math.min(photo.width, Math.round(area.width)),
      height: Math.min(photo.height, Math.round(area.height)),
    };
    ctx.crop(crop);
    width = crop.width;
  }
  if (width > MAX_EDGE) ctx.resize({ width: MAX_EDGE, height: null });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return out.uri;
}

// The crop area for a photo shown "cover" inside a frame, moved by (dx, dy) on screen.
export function cropArea(photo, frame, offset) {
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  return { x: -offset.x / scale, y: -offset.y / scale, width: frame.width / scale, height: frame.height / scale };
}

// Keeps the photo covering the frame while it is dragged.
export function clampOffset(photo, frame, offset) {
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  const w = photo.width * scale;
  const h = photo.height * scale;
  return { x: Math.min(0, Math.max(frame.width - w, offset.x)), y: Math.min(0, Math.max(frame.height - h, offset.y)) };
}
export function centredOffset(photo, frame) {
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  return { x: (frame.width - photo.width * scale) / 2, y: (frame.height - photo.height * scale) / 2 };
}
