export type ReelSlot = 'active' | 'next' | 'idle';

export function slotOf(index: number, activeIndex: number, canPreload: boolean): ReelSlot {
  if (index === activeIndex) {
    return 'active';
  }
  if (canPreload && index === activeIndex + 1) {
    return 'next';
  }
  return 'idle';
}
