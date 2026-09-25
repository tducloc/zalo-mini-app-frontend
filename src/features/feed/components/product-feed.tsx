import { useEffect, useRef } from 'react';

import FeedbackState from '@/components/feedback-state';
import InlineRetry from '@/components/inline-retry';
import type { useProductFeed } from '@/features/products/api/get-product-feed';

import ListingCard from './listing-card';
import ListingGridSkeleton from './listing-grid-skeleton';
import { listingGridClass, loadMoreButtonClass } from '../styles';

type FeedQuery = ReturnType<typeof useProductFeed>;

// Two rows of two cards fill the first viewport on a 390×844 phone.
const ABOVE_FOLD_CARDS = 4;
const INITIAL_SKELETON_CARDS = 6;
const NEXT_PAGE_SKELETON_CARDS = 2;
// Start the next request about one screen before the user reaches the end.
const PREFETCH_MARGIN = '0px 0px 800px 0px';
// zmp-ui scrolls inside the Page element, not the window.
const SCROLL_CONTAINER_SELECTOR = '.zaui-page';

export default function ProductFeed({
  feed,
  hasActiveCriteria,
  onClearCriteria,
  onOpenProduct,
}: {
  feed: FeedQuery;
  hasActiveCriteria: boolean;
  onClearCriteria: () => void;
  onOpenProduct: (productId: string) => void;
}) {
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

  const products = feed.data?.pages.flatMap((page) => page.data) ?? [];

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
            key={product.id}
            product={product}
            onOpen={onOpenProduct}
          />
        ))}
      </div>
      <FeedFooter feed={feed} />
    </>
  );
}

function FeedFooter({ feed }: { feed: FeedQuery }) {
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
      { root: sentinel.closest(SCROLL_CONTAINER_SELECTOR), rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [canAutoLoad, fetchNextPage]);

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
