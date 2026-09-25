/**
 * Geometry for the photo crop frame in ImageEditorModal — free of React so
 * it can be unit-tested. Everything is in on-screen (displayed image)
 * coordinates until toSourcePixels converts to the file's real pixels.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

/** Smallest crop frame, in screen points — small enough to crop tight, big enough to grab. */
export const MIN_CROP = 48;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const fullRect = (bounds: Size): Rect => ({ x: 0, y: 0, width: bounds.width, height: bounds.height });

/** The largest centred frame of `ratio` (width / height) that fits the image. */
export const aspectRect = (bounds: Size, ratio: number): Rect => {
  let width = bounds.width;
  let height = width / ratio;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * ratio;
  }
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height };
};

/** Drags the whole frame, keeping it inside the image. */
export const moveRect = (start: Rect, dx: number, dy: number, bounds: Size): Rect => ({
  ...start,
  x: clamp(start.x + dx, 0, bounds.width - start.width),
  y: clamp(start.y + dy, 0, bounds.height - start.height),
});

/**
 * Drags one corner while the opposite corner stays put. With a `ratio`, the
 * frame keeps that shape: width follows the finger and height follows the
 * width, shrinking both if the height would leave the image.
 */
export const resizeFromCorner = (
  start: Rect,
  corner: Corner,
  dx: number,
  dy: number,
  bounds: Size,
  ratio: number | null
): Rect => {
  const left = corner[1] === 'l';
  const top = corner[0] === 't';
  const anchorX = left ? start.x + start.width : start.x;
  const anchorY = top ? start.y + start.height : start.y;
  // How far the frame may reach from the fixed corner before leaving the image.
  const roomX = left ? anchorX : bounds.width - anchorX;
  const roomY = top ? anchorY : bounds.height - anchorY;

  const draggedX = (left ? start.x : start.x + start.width) + dx;
  const draggedY = (top ? start.y : start.y + start.height) + dy;
  let width = clamp(left ? anchorX - draggedX : draggedX - anchorX, Math.min(MIN_CROP, roomX), roomX);
  let height = clamp(top ? anchorY - draggedY : draggedY - anchorY, Math.min(MIN_CROP, roomY), roomY);

  if (ratio) {
    height = width / ratio;
    if (height > roomY) {
      height = roomY;
      width = height * ratio;
    }
    if (height < MIN_CROP && roomY >= MIN_CROP) {
      height = MIN_CROP;
      width = Math.min(height * ratio, roomX);
      height = width / ratio;
    }
  }

  return {
    x: left ? anchorX - width : anchorX,
    y: top ? anchorY - height : anchorY,
    width,
    height,
  };
};

/** True when the frame still covers the whole photo (nothing to crop). */
export const isWholeImage = (rect: Rect, bounds: Size): boolean =>
  rect.x <= 0.5 && rect.y <= 0.5 && rect.width >= bounds.width - 0.5 && rect.height >= bounds.height - 0.5;

/**
 * The frame in the file's own pixels, as ImageManipulator's crop wants it —
 * whole pixels, never reaching past the image edge.
 */
export const toSourcePixels = (
  rect: Rect,
  scale: number,
  source: Size
): { originX: number; originY: number; width: number; height: number } => {
  const originX = clamp(Math.round(rect.x / scale), 0, source.width - 1);
  const originY = clamp(Math.round(rect.y / scale), 0, source.height - 1);
  const width = clamp(Math.round(rect.width / scale), 1, source.width - originX);
  const height = clamp(Math.round(rect.height / scale), 1, source.height - originY);
  return { originX, originY, width, height };
};
