import { type RefObject, useEffect, useState } from 'react';

const ACTIVE_SHARE = 0.6;

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
