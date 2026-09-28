export type SwipeDirection = 'left' | 'right';

/** Shorter moves are a tap that slid, not a swipe. */
const MIN_DISTANCE_PX = 60;
/** The move must be clearly sideways, so a vertical scroll is never taken for a swipe. */
const MIN_HORIZONTAL_RATIO = 1.5;

/** The direction of a finished touch that moved `dx`, `dy` pixels, or null when not a swipe. */
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) {
    return null;
  }
  return dx < 0 ? 'left' : 'right';
}
