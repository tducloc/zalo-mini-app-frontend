export type ReelSlot = 'active' | 'idle';

/** Only the reel on screen holds the one shared video element. */
export function slotOf(index: number, activeIndex: number): ReelSlot {
  return index === activeIndex ? 'active' : 'idle';
}
