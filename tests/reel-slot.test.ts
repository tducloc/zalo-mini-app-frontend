import { slotOf } from '@/features/reels/utils/reel-slot';

const slots = (count: number, activeIndex: number, canPreload: boolean) =>
  Array.from({ length: count }, (_, index) => slotOf(index, activeIndex, canPreload));

describe('slotOf', () => {
  it('plays the reel on screen, keeps the one above and loads the one below', () => {
    expect(slots(5, 2, true)).toEqual(['idle', 'previous', 'active', 'next', 'idle']);
  });

  it('keeps no reel two or more above the one on screen', () => {
    expect(slotOf(0, 2, true)).toBe('idle');
  });

  it('keeps the reel above but loads nothing ahead on Save-Data or a slow network', () => {
    expect(slots(4, 1, false)).toEqual(['previous', 'active', 'idle', 'idle']);
  });

  it('has no reel above the first one', () => {
    expect(slots(3, 0, true)).toEqual(['active', 'next', 'idle']);
  });

  it('has no next reel after the last one', () => {
    expect(slots(3, 2, true)).toEqual(['idle', 'previous', 'active']);
  });

  it('keeps only the last reel while the end of the list is on screen', () => {
    expect(slots(3, 3, true)).toEqual(['idle', 'idle', 'previous']);
  });
});
