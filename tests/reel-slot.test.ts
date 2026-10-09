import { slotOf } from '@/features/reels/utils/reel-slot';

const slots = (count: number, activeIndex: number) =>
  Array.from({ length: count }, (_, index) => slotOf(index, activeIndex));

describe('slotOf', () => {
  it('gives the shared video to the reel on screen and mounts only its neighbours', () => {
    expect(slots(7, 3)).toEqual(['empty', 'empty', 'idle', 'active', 'idle', 'empty', 'empty']);
  });

  it('holds no video while the end of the list is on screen, and keeps the last reel ready', () => {
    expect(slots(4, 4)).toEqual(['empty', 'empty', 'empty', 'idle']);
  });
});
