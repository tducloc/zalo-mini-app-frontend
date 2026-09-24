import type { MediaType } from '../types';

/**
 * The image viewer only lists images, so a gallery slide maps to its position
 * among the images: the number of images before it.
 */
export function getViewerIndex(media: ReadonlyArray<{ type: MediaType }>, activeIndex: number) {
  return media.slice(0, activeIndex).filter((item) => item.type === 'IMAGE').length;
}

/** Whether a slide is the active one or a neighbour, counting across the loop seam. */
export function isNearSlide(index: number, activeIndex: number, slideCount: number) {
  const distance = Math.abs(index - activeIndex);
  return Math.min(distance, slideCount - distance) <= 1;
}
