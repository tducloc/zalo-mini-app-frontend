/**
 * The math of zooming a photo in the full-screen gallery, pure for the tests. The photo
 * is drawn with `translate(offset) scale(scale)` around its box's centre; points are in
 * pixels relative to that centre.
 */

import { MIN_SCALE, MAX_SCALE } from '@/features/products/constants/zoom';
import type { Point, Size } from '@/features/products/types/zoom';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampScale = (scale: number) => clamp(scale, MIN_SCALE, MAX_SCALE);

/** Keeps a zoomed photo covering its box: it cannot be dragged past its edges. */
export function clampOffset(offset: Point, scale: number, box: Size): Point {
  const maxX = ((scale - 1) * box.width) / 2;
  const maxY = ((scale - 1) * box.height) / 2;
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
}

/** The offset that keeps the point under `focus` in place while the scale changes. */
export function zoomAt(focus: Point, offset: Point, fromScale: number, toScale: number): Point {
  const ratio = toScale / fromScale;
  return { x: focus.x - (focus.x - offset.x) * ratio, y: focus.y - (focus.y - offset.y) * ratio };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
