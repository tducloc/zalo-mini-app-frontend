import { describe, expect, it } from 'vitest';

import { swipeDirection } from '@/utils/swipe';

describe('swipeDirection', () => {
  it('reads a long sideways move as a swipe that way', () => {
    expect(swipeDirection(-80, 10)).toBe('left');
    expect(swipeDirection(80, -10)).toBe('right');
  });

  it('ignores a short move, which is a tap that slid', () => {
    expect(swipeDirection(-59, 0)).toBeNull();
    expect(swipeDirection(-60, 0)).toBe('left');
  });

  it('ignores a move that is not clearly sideways, such as a vertical scroll', () => {
    expect(swipeDirection(-80, 60)).toBeNull();
    expect(swipeDirection(-90, 60)).toBe('left');
    expect(swipeDirection(10, 300)).toBeNull();
  });
});
