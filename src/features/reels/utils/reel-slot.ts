/**
 * What a reel holds (plans/reels.md, section 4). `active` plays; `next`, the reel below it,
 * loads ahead so a swipe starts at once; `idle` shows its poster with no source, so the
 * WebView frees its buffer.
 */
export type ReelSlot = 'active' | 'next' | 'idle';

/** `canPreload` is false on Save-Data or a 2g network: only the reel on screen loads. */
export function slotOf(index: number, activeIndex: number, canPreload: boolean): ReelSlot {
  if (index === activeIndex) {
    return 'active';
  }
  if (canPreload && index === activeIndex + 1) {
    return 'next';
  }
  return 'idle';
}
