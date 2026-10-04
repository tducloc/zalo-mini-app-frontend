import { useVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

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

/** Rows stay mounted this far past each edge of the screen, so a fast fling meets no empty row. */
const OVERSCAN_PX = 1000;

/**
 * The feed's cards, one row of `columns` at a time, with only the rows near the screen in the
 * DOM. Rows are absolutely placed inside a box as tall as the whole list, so the page keeps its
 * real scroll height (scroll restore, the next-page sentinel after it).
 */
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
  /** The feed's width; with `columns` it sets the card height. */
  width: number;
  /** Every page is loaded, so the list size is known. */
  isComplete: boolean;
  activeId: string | null;
  cardRef: (productId: string) => (element: HTMLElement | null) => void;
  /** The page the feed scrolls in. */
  scrollerRef: RefObject<HTMLElement>;
  onOpen: (productId: string) => void;
  onPreviewRefused: () => void;
  onPreviewFinished: (productId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Where the list starts in the page: the header, categories and chips come first.
  const [scrollMargin, setScrollMargin] = useState(0);

  const rowHeight = cardHeight(width, columns);
  const virtualizer = useVirtualizer({
    count: rowCount(products.length, columns),
    // Found from the list: the Page sets `scrollerRef` only after this mounts.
    getScrollElement: () => listRef.current?.closest<HTMLElement>('.zaui-page') ?? null,
    estimateSize: () => rowHeight,
    gap: CARD_GAP_PX,
    overscan: overscanRows(rowHeight + CARD_GAP_PX, OVERSCAN_PX),
    scrollMargin,
    // The screen before the page is laid out: the first render already holds the first rows
    // and their eager images, with no empty frame while the virtualizer measures.
    initialRect: { width: window.innerWidth, height: window.innerHeight },
    // Mounting into a page that is already scrolled (a new search) must not scroll it to 0.
    initialOffset: () => scrollerRef.current?.scrollTop ?? 0,
  });

  // The virtualizer caches row offsets; a new width (rotation) changes every row's height.
  const measuredRowHeight = useRef(rowHeight);
  useLayoutEffect(() => {
    if (measuredRowHeight.current !== rowHeight) {
      measuredRowHeight.current = rowHeight;
      virtualizer.measure();
    }
  }, [virtualizer, rowHeight]);

  // Content above the list changes height (filter chips), so look again after each render.
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
  // -1: more pages may come, the size is not known yet.
  const setSize = isComplete ? products.length : -1;

  return (
    <div
      ref={listRef}
      aria-label="Tin đăng"
      className="relative"
      role="list"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => (
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
