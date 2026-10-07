import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type RefObject,
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import ListingCard from '@/features/feed/components/grid/listing-card';
import { listingGridClass } from '@/features/feed/constants/styles';
import {
  aboveFoldCards,
  CARD_GAP_PX,
  cardHeight,
  cardsInRow,
  gridColumnsStyle,
  overscanRows,
  rowCount,
} from '@/features/feed/utils/feed-grid';
import type { ProductCard } from '@/features/products/types/product';

const OVERSCAN_PX = 1000;
const FIRST_RENDER_ROWS = 1;

// Only the app's first feed render is split; a list coming back from another page renders whole.
let hasRenderedAllRows = false;

export default function VirtualListingGrid({
  products,
  columns,
  width,
  isComplete,
  activeId,
  cardRef,
  scrollerRef,
  onOpen,
  onPreviewRefused,
  onPreviewFinished,
}: {
  products: ProductCard[];
  columns: number;
  width: number;
  isComplete: boolean;
  activeId: string | null;
  cardRef: (productId: string) => (element: HTMLElement | null) => void;
  scrollerRef: RefObject<HTMLElement>;
  onOpen: (productId: string) => void;
  onPreviewRefused: () => void;
  onPreviewFinished: (productId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Rendering every card the moment the feed arrives is one long task right after the first paint.
  // The first row (the LCP card) renders now, and the rest in a transition React splits into slices.
  const [isShowingAllRows, setIsShowingAllRows] = useState(hasRenderedAllRows);
  const hasProducts = products.length > 0;
  useEffect(() => {
    if (!hasProducts || hasRenderedAllRows) {
      return;
    }
    hasRenderedAllRows = true;
    startTransition(() => setIsShowingAllRows(true));
  }, [hasProducts]);

  const rowHeight = cardHeight(width, columns);
  const virtualizer = useVirtualizer({
    count: rowCount(products.length, columns),
    // zmp-ui's Page fills its ref in useImperativeHandle, after this list's layout effects.
    getScrollElement: () => listRef.current?.closest<HTMLElement>('.zaui-page') ?? null,
    estimateSize: () => rowHeight,
    gap: CARD_GAP_PX,
    overscan: overscanRows(rowHeight + CARD_GAP_PX, OVERSCAN_PX),
    scrollMargin,
    // TanStack Virtual assumes a 0x0 scroller until it measures one, so the first frame would
    // hold no rows and no eager LCP images.
    initialRect: { width: window.innerWidth, height: window.innerHeight },
    // TanStack Virtual scrolls the page to this offset when it attaches, and a new search mounts
    // the list into a page that is already scrolled.
    initialOffset: () => scrollerRef.current?.scrollTop ?? 0,
  });

  // TanStack Virtual does not re-read estimateSize until measure().
  const measuredRowHeight = useRef(rowHeight);
  useLayoutEffect(() => {
    if (measuredRowHeight.current !== rowHeight) {
      measuredRowHeight.current = rowHeight;
      virtualizer.measure();
    }
  }, [virtualizer, rowHeight]);

  // Runs after every render because the filter chips above the list can change its offset.
  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = virtualizer.scrollElement;
    if (!list || !scroller) {
      return;
    }

    const top =
      list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    if (Math.abs(top - scrollMargin) > 0.5) {
      setScrollMargin(top);
    }
  });

  const firstLazyCard = aboveFoldCards(columns);
  // WAI-ARIA reads aria-setsize -1 as an unknown size.
  const setSize = isComplete ? products.length : -1;

  return (
    <div
      ref={listRef}
      aria-label="Tin đăng"
      className="relative"
      role="list"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer
        .getVirtualItems()
        .filter((row) => isShowingAllRows || row.index < FIRST_RENDER_ROWS)
        .map((row) => (
          <div
            key={row.key}
            className={`${listingGridClass} absolute inset-x-0 top-0`}
            role="none"
            style={{
              ...gridColumnsStyle(columns),
              transform: `translateY(${row.start - scrollMargin}px)`,
            }}
          >
            {cardsInRow(products, row.index, columns).map((product, column) => {
              const index = row.index * columns + column;
              return (
                <div
                  key={product.id}
                  aria-posinset={index + 1}
                  aria-setsize={setSize}
                  role="listitem"
                >
                  <ListingCard
                    isAboveFold={index < firstLazyCard}
                    isPreviewActive={product.id === activeId}
                    cardRef={product.previewUrl ? cardRef(product.id) : undefined}
                    product={product}
                    onOpen={onOpen}
                    onPreviewRefused={onPreviewRefused}
                    onPreviewFinished={onPreviewFinished}
                  />
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
