import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { type Box, canAutoplay, pickActiveCard, visibleArea } from '@/features/feed/utils/autoplay';

/** A card must rest near the centre this long, so a fast fling plays nothing. */
const DWELL_MS = 300;

/** Off unless VITE_FEED_AUTOPLAY=true, until it is measured on devices (plans/home-feed.md). */
const isFlagOn = import.meta.env.VITE_FEED_AUTOPLAY === 'true';

/** A WebView that refused one preview refuses them all; no more tries this session. */
let wasRefused = false;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

function isAutoplayAllowed() {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return canAutoplay({
    isEnabled: isFlagOn,
    wasRefused,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  });
}

function areaOf(scroller: HTMLElement, header: HTMLElement | null): Box {
  return visibleArea(
    scroller.getBoundingClientRect(),
    header?.getBoundingClientRect().bottom ?? 0,
    Number.parseFloat(getComputedStyle(scroller).paddingBottom) || 0,
  );
}

interface FeedAutoplayOptions {
  /** The cards that have a preview, in feed order. */
  previewIds: string[];
  /** Something covers the feed (a sheet): nothing plays. */
  isPaused: boolean;
  /** The page element the feed scrolls in. */
  scrollerRef: RefObject<HTMLElement>;
  /** The fixed header over the top of the page. */
  headerRef: RefObject<HTMLElement>;
}

/**
 * The one feed card whose preview plays: the card with a preview nearest the middle of
 * what is visible, once it has rested there. None while paused, while the app is in the
 * background, or once the WebView refused to play. The cards in `previewIds` register
 * their element with `cardRef(id)`; a new page of cards is looked at without a scroll.
 */
export function useFeedAutoplay({
  previewIds,
  isPaused,
  scrollerRef,
  headerRef,
}: FeedAutoplayOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const previewKey = previewIds.join();

  // registered card elements, and one stable ref callback per card
  const cards = useRef(new Map<string, HTMLElement>());
  const cardRefs = useRef(new Map<string, (element: HTMLElement | null) => void>());

  // The card chosen last, kept when a new page arrives so the playing one goes on.
  const candidate = useRef<string | null>(null);

  // Bumped when a play is refused, so the choice is made again (and finds none).
  const [refusals, setRefusals] = useState(0);

  const cardRef = useCallback((id: string) => {
    let ref = cardRefs.current.get(id);
    if (!ref) {
      ref = (element) => {
        if (element) {
          cards.current.set(id, element);
        } else {
          cards.current.delete(id);
        }
      };
      cardRefs.current.set(id, ref);
    }
    return ref;
  }, []);

  const handleRefused = useCallback(() => {
    wasRefused = true;
    setRefusals((count) => count + 1);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || isPaused) {
      candidate.current = null;
      setActiveId(null);
      return;
    }

    let frame = 0;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let isDwelling = false;

    const choose = () => {
      frame = 0;
      // Asked each time: the connection or the motion setting may change on the page.
      const next =
        document.hidden || !isAutoplayAllowed()
          ? null
          : pickActiveCard(
              [...cards.current].map(([id, element]) => ({
                id,
                rect: element.getBoundingClientRect(),
              })),
              areaOf(scroller, headerRef.current),
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
  }, [scrollerRef, headerRef, isPaused, previewKey, refusals]);

  return { activeId, cardRef, onRefused: handleRefused };
}
