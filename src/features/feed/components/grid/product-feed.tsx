import { type RefObject, useEffect, useRef } from 'react';

import FeedbackState from '@/components/feedback/feedback-state';
import InlineRetry from '@/components/feedback/inline-retry';
import ListingGridSkeleton from '@/features/feed/components/grid/listing-grid-skeleton';
import VirtualListingGrid from '@/features/feed/components/grid/virtual-listing-grid';
import { surfaceClass } from '@/features/feed/constants/styles';
import { useFeedAutoplay } from '@/features/feed/hooks/use-feed-autoplay';
import { useFeedWidth } from '@/features/feed/hooks/use-feed-width';
import { columnsForWidth } from '@/features/feed/utils/feed-grid';
import type { useProductFeed } from '@/features/products/api/get-product-feed';

type FeedQuery = ReturnType<typeof useProductFeed>;

const INITIAL_SKELETON_ROWS = 3;
const loadMoreButtonClass = `block min-h-11 w-full rounded-[10px] font-semibold text-marketplace-blue ${surfaceClass}`;
// Start the next request about one screen before the user reaches the end.
const PREFETCH_MARGIN = '0px 0px 800px 0px';

interface ProductFeedProps {
  feed: FeedQuery;
  hasActiveCriteria: boolean;
  /** Something covers the feed (the filter sheet): no preview plays. */
  isAutoplayPaused: boolean;
  /** The page the feed scrolls in, and the fixed header over it: what is on screen. */
  scrollerRef: RefObject<HTMLElement>;
  headerRef: RefObject<HTMLElement>;
  onClearCriteria: () => void;
  onOpenProduct: (productId: string) => void;
}

export default function ProductFeed(props: ProductFeedProps) {
  const { ref, width } = useFeedWidth();

  return (
    <div ref={ref}>
      <FeedContent {...props} width={width} />
    </div>
  );
}

function FeedContent({
  feed,
  hasActiveCriteria,
  isAutoplayPaused,
  scrollerRef,
  headerRef,
  onClearCriteria,
  onOpenProduct,
  width,
}: ProductFeedProps & { width: number }) {
  const columns = columnsForWidth(width);

  const products = feed.data?.pages.flatMap((page) => page.data) ?? [];
  const previewIds = products.flatMap((product) => (product.previewUrl ? [product.id] : []));
  const { activeId, cardRef, onRefused, onFinished } = useFeedAutoplay({
    previewIds,
    isPaused: isAutoplayPaused,
    scrollerRef,
    headerRef,
  });

  if (feed.isPending) {
    return <ListingGridSkeleton columns={columns} count={INITIAL_SKELETON_ROWS * columns} />;
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
      <VirtualListingGrid
        products={products}
        columns={columns}
        width={width}
        isComplete={!feed.hasNextPage}
        activeId={activeId}
        cardRef={cardRef}
        scrollerRef={scrollerRef}
        onOpen={onOpenProduct}
        onPreviewRefused={onRefused}
        onPreviewFinished={onFinished}
      />
      <FeedFooter columns={columns} feed={feed} scrollerRef={scrollerRef} />
    </>
  );
}

function FeedFooter({
  columns,
  feed,
  scrollerRef,
}: {
  columns: number;
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
        <ListingGridSkeleton columns={columns} count={columns} />
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
