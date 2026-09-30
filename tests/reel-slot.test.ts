import { slotOf } from '@/features/reels/utils/reel-slot';

const slots = (count: number, activeIndex: number) =>
  Array.from({ length: count }, (_, index) => slotOf(index, activeIndex));

describe('slotOf', () => {
  it('gives the shared video only to the reel on screen', () => {
    expect(slots(5, 2)).toEqual(['idle', 'idle', 'active', 'idle', 'idle']);
  });

  it('gives it to the first reel', () => {
    expect(slots(3, 0)).toEqual(['active', 'idle', 'idle']);
  });

  it('gives it to the last reel', () => {
    expect(slots(3, 2)).toEqual(['idle', 'idle', 'active']);
  });

  it('holds no video while the end of the list is on screen', () => {
    expect(slots(3, 3)).toEqual(['idle', 'idle', 'idle']);
  });
});
