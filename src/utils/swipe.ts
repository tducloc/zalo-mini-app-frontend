export type SwipeDirection = 'left' | 'right';

const MIN_DISTANCE_PX = 60;
const MIN_HORIZONTAL_RATIO = 1.5;

export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) {
    return null;
  }
  return dx < 0 ? 'left' : 'right';
}
