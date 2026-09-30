import { type RefObject, useLayoutEffect, useRef } from 'react';

/** Scrolls once to the reel the viewer left, after the list has laid out. */
export function useRestoreReelScroll(
  scrollerRef: RefObject<HTMLElement>,
  reelCount: number,
  activeIndex: number,
) {
  const hasRestoredRef = useRef(false);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (hasRestoredRef.current || !scroller || !reelCount) {
      return;
    }

    hasRestoredRef.current = true;
    const reel = scroller.querySelector(`[data-reel-index="${activeIndex}"]`);
    if (!reel) {
      return;
    }

    const reelTop = reel.getBoundingClientRect().top;
    const scrollerTop = scroller.getBoundingClientRect().top;
    scroller.scrollTop += reelTop - scrollerTop;
  }, [scrollerRef, reelCount, activeIndex]);
}
