import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import FeedbackState from '@/components/feedback/feedback-state';
import InlineRetry from '@/components/feedback/inline-retry';
import ListingCard from '@/features/feed/components/grid/listing-card';
import ListingGridSkeleton from '@/features/feed/components/grid/listing-grid-skeleton';
import { listingGridClass, surfaceClass } from '@/features/feed/constants/styles';
import type { useProductFeed } from '@/features/products/api/get-product-feed';

type FeedQuery = ReturnType<typeof useProductFeed>;

// Two rows of two cards fill the first viewport on a 390×844 phone.
const ABOVE_FOLD_CARDS = 4;
const INITIAL_SKELETON_CARDS = 6;
const NEXT_PAGE_SKELETON_CARDS = 2;
const loadMoreButtonClass = `block min-h-11 w-full rounded-[10px] font-semibold text-marketplace-blue ${surfaceClass}`;
// Start the next request about one screen before the user reaches the end.
const PREFETCH_MARGIN = '0px 0px 800px 0px';

export default function ProductFeed({
  feed,
  hasActiveCriteria,
  isAutoplayPaused,
  scrollerRef,
  headerRef,
  onClearCriteria,
  onOpenProduct,
}: {
  feed: FeedQuery;
  hasActiveCriteria: boolean;
  /** Something covers the feed (the filter sheet): no preview plays. */
  isAutoplayPaused: boolean;
  /** The page the feed scrolls in, and the fixed header over it: what is on screen. */
  scrollerRef: RefObject<HTMLElement>;
  headerRef: RefObject<HTMLElement>;
  onClearCriteria: () => void;
  onOpenProduct: (productId: string) => void;
}) {
  const products = feed.data?.pages.flatMap((page) => page.data) ?? [];
  const previewIds = products.flatMap((product) => (product.previewUrl ? [product.id] : []));
  const { activeId, cardRef, onRefused } = useFeedAutoplay({
    previewIds,
    isPaused: isAutoplayPaused,
    scrollerRef,
    headerRef,
  });

  if (feed.isPending) {
    return <ListingGridSkeleton count={INITIAL_SKELETON_CARDS} />;
  }

  if (feed.isError && !feed.data) {
    return (
      <FeedbackState
        type="error"
        title="Không tải được tin"
        description="Vui lòng kiểm tra kết nối mạng và thử lại."
        onAction={() => feed.refetch()}
      />
    );
  }

  if (!products.length) {
    return hasActiveCriteria ? (
      <FeedbackState
        type="empty"
        title="Không tìm thấy tin phù hợp"
        description="Vui lòng thử từ khoá khác hoặc bỏ bớt bộ lọc."
        actionLabel="Xoá tìm kiếm và bộ lọc"
        onAction={onClearCriteria}
      />
    ) : (
      <FeedbackState type="empty" title="Chưa có tin đăng" description="Vui lòng quay lại sau." />
    );
  }

  return (
    <>
      <div className={listingGridClass}>
        {products.map((product, index) => (
          <ListingCard
            isAboveFold={index < ABOVE_FOLD_CARDS}
            isPreviewActive={product.id === activeId}
            cardRef={product.previewUrl ? cardRef(product.id) : undefined}
            key={product.id}
            product={product}
            onOpen={onOpenProduct}
            onPreviewRefused={onRefused}
          />
        ))}
      </div>
      <FeedFooter feed={feed} scrollerRef={scrollerRef} />
    </>
  );
}

function FeedFooter({
  feed,
  scrollerRef,
}: {
  feed: FeedQuery;
  scrollerRef: RefObject<HTMLElement>;
}) {
  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } = feed;

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Manual loads must not cancel a refetch of the pages already shown.
  const handleLoadMore = () => fetchNextPage({ cancelRefetch: false });

  // Never while any fetch runs: fetchNextPage would cancel a full refetch of
  // stale pages. Paused after a failed page so a broken network does not loop.
  const canAutoLoad = hasNextPage && !isFetching && !isFetchNextPageError;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canAutoLoad || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { root: scrollerRef.current, rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [canAutoLoad, fetchNextPage, scrollerRef]);

  if (isFetchingNextPage) {
    return (
      <div className="mt-2.5">
        <ListingGridSkeleton count={NEXT_PAGE_SKELETON_CARDS} />
      </div>
    );
  }

  if (isFetchNextPageError) {
    return <InlineRetry message="Không tải thêm được tin." onRetry={handleLoadMore} />;
  }

  if (!hasNextPage) {
    return (
      <p className="mt-2.5 pb-2 pt-4 text-center text-caption text-marketplace-muted">
        Bạn đã xem hết tin đăng.
      </p>
    );
  }

  return (
    <div className="mt-2.5" ref={sentinelRef}>
      {/* Fallback for assistive tech and WebViews without IntersectionObserver. */}
      <button className={loadMoreButtonClass} type="button" onClick={handleLoadMore}>
        Xem thêm
      </button>
    </div>
  );
}

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
function useFeedAutoplay({ previewIds, isPaused, scrollerRef, headerRef }: FeedAutoplayOptions) {
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

/**
 * Which feed card plays its preview (plans/home-feed.md, Phase 4): one at a time, the one
 * nearest the middle of the screen, and never when the viewer asked for less motion or
 * less data.
 */

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A card must show this share of its height to be picked. */
const MIN_VISIBLE_SHARE = 0.6;

/** Networks too slow to spend on previews. */
const SLOW_NETWORKS = new Set(['slow-2g', '2g']);

const centre = (start: number, end: number) => (start + end) / 2;

/**
 * The part of the scroller the viewer really sees: the fixed header covers its top, and
 * its bottom padding is kept free for the tab bar (and the draft banner) over it.
 */
export function visibleArea(scroller: Box, headerBottom: number, bottomPadding: number): Box {
  return {
    ...scroller,
    top: Math.max(scroller.top, headerBottom),
    bottom: scroller.bottom - bottomPadding,
  };
}

/**
 * The card nearest the centre of the visible area among those mostly in it, else null.
 * Of two cards as near, the first (the left one of a row) wins.
 */
export function pickActiveCard(cards: { id: string; rect: Box }[], area: Box) {
  const middleY = centre(area.top, area.bottom);
  const middleX = centre(area.left, area.right);

  let best: { id: string; distance: number } | null = null;
  for (const { id, rect } of cards) {
    const height = rect.bottom - rect.top;
    const visible = Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top);
    // A zero-size box is a card that is not laid out (hidden), not a visible one.
    if (height <= 0 || visible < height * MIN_VISIBLE_SHARE) {
      continue;
    }

    const distance = Math.hypot(
      centre(rect.top, rect.bottom) - middleY,
      centre(rect.left, rect.right) - middleX,
    );
    if (!best || distance < best.distance) {
      best = { id, distance };
    }
  }
  return best?.id ?? null;
}

export function canAutoplay({
  isEnabled,
  wasRefused,
  prefersReducedMotion,
  saveData,
  effectiveType,
}: {
  isEnabled: boolean;
  /** The WebView refused to play a preview this session; it will refuse the next too. */
  wasRefused: boolean;
  prefersReducedMotion: boolean;
  /** From the Network Information API; undefined where the browser has none. */
  saveData: boolean | undefined;
  effectiveType: string | undefined;
}) {
  const isSlowNetwork = SLOW_NETWORKS.has(effectiveType ?? '');
  return isEnabled && !wasRefused && !prefersReducedMotion && !saveData && !isSlowNetwork;
}
