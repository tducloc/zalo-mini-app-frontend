import { type RefObject, useEffect, useRef, useState } from 'react';

export const PULL_THRESHOLD_PX = 64;
const MAX_PULL_PX = 96;
// The indicator follows the finger at half speed, so the pull has some weight.
const PULL_RESISTANCE = 0.5;

/**
 * A pull down from the very top of `scrollerRef` past the threshold calls `onRefresh`. A touch
 * that starts below the top, or first moves up or sideways, scrolls as usual. No new pull starts
 * until `onRefresh` settles.
 */
export function usePullToRefresh(
  scrollerRef: RefObject<HTMLElement>,
  onRefresh: () => Promise<unknown>,
) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    let start: { x: number; y: number } | null = null;
    let distance = 0;
    let isBusy = false;

    const setDistance = (next: number) => {
      distance = next;
      setPullDistance(next);
    };

    const handleStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      // iOS bounce takes scrollTop below zero, which is still the top.
      const isAtTop = scroller.scrollTop <= 0;
      start =
        !isBusy && isAtTop && event.touches.length === 1
          ? { x: touch.clientX, y: touch.clientY }
          : null;
    };

    const handleMove = (event: TouchEvent) => {
      if (!start) {
        return;
      }

      const touch = event.touches[0];
      const dy = touch.clientY - start.y;
      const dx = Math.abs(touch.clientX - start.x);

      if (distance === 0 && (dy <= 0 || dx > dy)) {
        start = null;
        return;
      }

      // Holds the page still, which also keeps iOS from bouncing it under the indicator.
      event.preventDefault();
      setDistance(Math.min(Math.max(dy, 0) * PULL_RESISTANCE, MAX_PULL_PX));
    };

    const handleCancel = () => {
      start = null;
      setDistance(0);
    };

    const handleEnd = () => {
      const pulled = distance;
      handleCancel();

      if (pulled < PULL_THRESHOLD_PX) {
        return;
      }

      isBusy = true;
      setIsRefreshing(true);
      void onRefreshRef.current().finally(() => {
        isBusy = false;
        setIsRefreshing(false);
      });
    };

    scroller.addEventListener('touchstart', handleStart, { passive: true });
    scroller.addEventListener('touchmove', handleMove, { passive: false });
    scroller.addEventListener('touchend', handleEnd);
    scroller.addEventListener('touchcancel', handleCancel);

    return () => {
      scroller.removeEventListener('touchstart', handleStart);
      scroller.removeEventListener('touchmove', handleMove);
      scroller.removeEventListener('touchend', handleEnd);
      scroller.removeEventListener('touchcancel', handleCancel);
    };
  }, [scrollerRef]);

  return { pullDistance, isRefreshing };
}
