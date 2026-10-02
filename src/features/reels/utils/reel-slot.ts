/**
 * Reels this close to the one on screen keep their poster and overlay. The rest are empty
 * sections, which still hold the scroll height and snap point. One is enough: the next reel
 * is mounted before it snaps in, and a swipe moves one reel at a time.
 */
export const REEL_MOUNT_WINDOW = 1;

export type ReelSlot = 'active' | 'idle' | 'empty';

/** Only the reel on screen holds the one shared video element; its neighbours stay mounted. */
export function slotOf(index: number, activeIndex: number): ReelSlot {
  if (index === activeIndex) {
    return 'active';
  }

  return Math.abs(index - activeIndex) <= REEL_MOUNT_WINDOW ? 'idle' : 'empty';
}
