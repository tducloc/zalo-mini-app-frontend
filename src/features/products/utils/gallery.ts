import type { MediaType } from '../types';

/**
 * The image viewer only lists images, so a gallery slide maps to its position
 * among the images: the number of images before it.
 */
export function getViewerIndex(media: ReadonlyArray<{ type: MediaType }>, activeIndex: number) {
  return media.slice(0, activeIndex).filter((item) => item.type === 'IMAGE').length;
}
