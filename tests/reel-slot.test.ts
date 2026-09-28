import { slotOf } from '@/features/reels/utils/reel-slot';

const slots = (count: number, activeIndex: number, canPreload: boolean) =>
  Array.from({ length: count }, (_, index) => slotOf(index, activeIndex, canPreload));

describe('slotOf', () => {
  it('plays the reel on screen and loads only the one below it', () => {
    expect(slots(5, 2, true)).toEqual(['idle', 'idle', 'active', 'next', 'idle']);
  });

  it('never loads the reel above, which the viewer already left', () => {
    expect(slotOf(1, 2, true)).toBe('idle');
  });

  it('loads nothing ahead on Save-Data or a slow network', () => {
    expect(slots(4, 1, false)).toEqual(['idle', 'active', 'idle', 'idle']);
  });

  it('has no next reel after the last one', () => {
    expect(slots(3, 2, true)).toEqual(['idle', 'idle', 'active']);
  });

  it('leaves every reel idle while the end of the list is on screen', () => {
    // The footer after the last reel takes the index after it.
    expect(slots(3, 3, true)).toEqual(['idle', 'idle', 'idle']);
  });
});
