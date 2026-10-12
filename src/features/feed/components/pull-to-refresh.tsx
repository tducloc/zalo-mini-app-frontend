import type { RefObject } from 'react';

import { PULL_THRESHOLD_PX, usePullToRefresh } from '@/features/feed/hooks/use-pull-to-refresh';

const INDICATOR_SIZE_PX = 36;
const FULL_TURN_DEG = 360;

// Slides out from under the fixed header (z-30), over the feed.
const indicatorClass =
  'pointer-events-none fixed left-1/2 top-[var(--home-header-height)] z-20 -ml-[18px] grid size-9 place-items-center rounded-full bg-white shadow-md';
const ringClass =
  'size-5 rounded-full border-2 border-solid border-marketplace-blue/25 border-t-marketplace-blue';

/**
 * Owns the pull state, so a pull re-renders only this indicator and not the feed under it.
 */
export default function PullToRefresh({
  scrollerRef,
  onRefresh,
}: {
  scrollerRef: RefObject<HTMLElement>;
  onRefresh: () => Promise<unknown>;
}) {
  const { pullDistance, isRefreshing } = usePullToRefresh(scrollerRef, onRefresh);

  if (!pullDistance && !isRefreshing) {
    return null;
  }

  const offset = isRefreshing ? PULL_THRESHOLD_PX : pullDistance;
  const progress = Math.min(offset / PULL_THRESHOLD_PX, 1);

  return (
    <div
      className={indicatorClass}
      style={{ transform: `translateY(${offset - INDICATOR_SIZE_PX}px)`, opacity: progress }}
      role={isRefreshing ? 'status' : undefined}
      aria-label={isRefreshing ? 'Đang làm mới tin đăng' : undefined}
    >
      <i
        className={`${ringClass} ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
        style={isRefreshing ? undefined : { transform: `rotate(${progress * FULL_TURN_DEG}deg)` }}
      />
    </div>
  );
}
