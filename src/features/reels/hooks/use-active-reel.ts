import { type RefObject, useEffect, useState } from 'react';

/** A reel is on screen once this share of it shows. */
const ACTIVE_SHARE = 0.6;

/**
 * The index of the reel on screen, among the scroller's children marked `data-reel-index`.
 * It stays on the last one while a swipe shows no reel enough, so the reel below keeps
 * loading. `itemCount` changes when a page of reels arrives, to watch the new ones.
 */
export function useActiveReel(
  scrollerRef: RefObject<HTMLElement>,
  itemCount: number,
  initialIndex: number,
) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !itemCount || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= ACTIVE_SHARE) {
            setActiveIndex(Number((entry.target as HTMLElement).dataset.reelIndex));
          }
        }
      },
      { root: scroller, threshold: ACTIVE_SHARE },
    );
    scroller
      .querySelectorAll<HTMLElement>('[data-reel-index]')
      .forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [scrollerRef, itemCount]);

  return activeIndex;
}
