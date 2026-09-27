import { useCallback, useEffect, useRef, useState } from 'react';

import { canAutoplay, pickActiveCard } from '@/features/feed/utils/autoplay';

/** A card must rest near the centre this long, so a fast fling plays nothing. */
const DWELL_MS = 300;

// zmp-ui scrolls inside the Page element, not the window.
const SCROLL_CONTAINER_SELECTOR = '.zaui-page';

/** Off with VITE_FEED_AUTOPLAY=false until it is measured on devices (plans/home-feed.md). */
const isFlagOn = import.meta.env.VITE_FEED_AUTOPLAY !== 'false';

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

function isAutoplayAllowed() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return canAutoplay({
    isEnabled: isFlagOn,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  });
}

/**
 * The one feed card whose preview plays: the card with a preview nearest the middle of
 * the screen, once it has rested there. None while `isPaused` (a sheet over the feed) or
 * while the app is in the background. The cards in `previewIds` register their element
 * with `cardRef(id)`; a new page of cards is looked at without waiting for a scroll.
 */
export function useFeedAutoplay(previewIds: string[], isPaused: boolean) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const previewKey = previewIds.join();

  // registered card elements, and the scroll container they sit in
  const cards = useRef(new Map<string, HTMLElement>());
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  // The card chosen last, kept when a new page arrives so the playing one goes on.
  const candidate = useRef<string | null>(null);

  const cardRef = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) {
        cards.current.set(id, element);
        setScroller(
          (current) => current ?? element.closest<HTMLElement>(SCROLL_CONTAINER_SELECTOR),
        );
      } else {
        cards.current.delete(id);
      }
    },
    [],
  );

  useEffect(() => {
    if (!scroller || isPaused || !isAutoplayAllowed()) {
      candidate.current = null;
      setActiveId(null);
      return;
    }

    let frame = 0;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let isDwelling = false;

    const choose = () => {
      frame = 0;
      const viewport = scroller.getBoundingClientRect();
      const next = document.hidden
        ? null
        : pickActiveCard(
            [...cards.current].map(([id, element]) => ({
              id,
              rect: element.getBoundingClientRect(),
            })),
            viewport,
          );
      if (next === candidate.current) {
        return;
      }

      // The playing card stops at once; the next one waits until it rests.
      candidate.current = next;
      clearTimeout(dwell);
      isDwelling = false;
      setActiveId(null);
      if (next) {
        isDwelling = true;
        dwell = setTimeout(() => {
          isDwelling = false;
          setActiveId(next);
        }, DWELL_MS);
      }
    };
    const scheduleChoose = () => {
      frame ||= requestAnimationFrame(choose);
    };

    scheduleChoose();
    scroller.addEventListener('scroll', scheduleChoose, { passive: true });
    window.addEventListener('resize', scheduleChoose);
    document.addEventListener('visibilitychange', scheduleChoose);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(dwell);
      // A card still resting is chosen again by the next run, not skipped as unchanged.
      if (isDwelling) {
        candidate.current = null;
      }
      scroller.removeEventListener('scroll', scheduleChoose);
      window.removeEventListener('resize', scheduleChoose);
      document.removeEventListener('visibilitychange', scheduleChoose);
    };
    // previewKey: new cards on screen are looked at even before the next scroll.
  }, [scroller, isPaused, previewKey]);

  return { activeId, cardRef };
}
