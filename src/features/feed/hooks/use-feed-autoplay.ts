import { type RefObject, useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { type Box, canAutoplay, pickActiveCard, visibleArea } from '@/features/feed/utils/autoplay';
import { getConnection } from '@/utils/network';

const DWELL_MS = 300;

/** Off unless VITE_FEED_AUTOPLAY=true, until it is measured on devices (plans/home-feed.md). */
const isFlagOn = import.meta.env.VITE_FEED_AUTOPLAY === 'true';

/** A WebView that refused one preview refuses them all; no more tries this session. */
let wasRefused = false;

function isAutoplayAllowed() {
  const connection = getConnection();
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
  const candidateRow = useRef<string | null>(null);
  const finished = useRef<ReadonlySet<string>>(new Set());

  const [choiceCount, chooseAgain] = useReducer((count: number) => count + 1, 0);

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
    chooseAgain();
  }, []);

  const handleFinished = useCallback((id: string) => {
    finished.current = new Set(finished.current).add(id);
    chooseAgain();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || isPaused) {
      candidate.current = null;
      candidateRow.current = null;
      setActiveId(null);
      return;
    }

    let frame = 0;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let isDwelling = false;

    const choose = () => {
      frame = 0;
      let next: string | null = null;
      let row: string | null = null;
      // Asked each time: the connection or the motion setting may change on the page.
      if (!document.hidden && isAutoplayAllowed()) {
        const turn = pickActiveCard(
          [...cards.current].map(([id, element]) => ({
            id,
            rect: element.getBoundingClientRect(),
          })),
          areaOf(scroller, headerRef.current),
          finished.current,
        );
        next = turn.activeId;
        row = turn.rowKey;
        finished.current = turn.finished;
      }
      const isSameRow = row !== null && row === candidateRow.current;
      candidateRow.current = row;
      if (next === candidate.current) {
        return;
      }

      candidate.current = next;
      clearTimeout(dwell);
      isDwelling = false;
      if (isSameRow) {
        setActiveId(next);
        return;
      }
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
        candidateRow.current = null;
      }
      scroller.removeEventListener('scroll', scheduleChoose);
      window.removeEventListener('resize', scheduleChoose);
      document.removeEventListener('visibilitychange', scheduleChoose);
    };
    // previewKey: new cards on screen are looked at even before the next scroll.
  }, [scrollerRef, headerRef, isPaused, previewKey, choiceCount]);

  return { activeId, cardRef, onRefused: handleRefused, onFinished: handleFinished };
}
