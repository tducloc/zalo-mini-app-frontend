import { useEffect, useRef } from 'react';

import FeedbackState from '@/components/feedback/feedback-state';
import InlineRetry from '@/components/feedback/inline-retry';
import type { useMyListings } from '@/features/my-listings/api/get-my-listings';
import MyListingCard from '@/features/my-listings/components/list/my-listing-card';
import MyListingSkeleton from '@/features/my-listings/components/list/my-listing-skeleton';
import { myListingStackClass } from '@/features/my-listings/constants/styles';
import type { ListingAction, MyListing } from '@/features/my-listings/types/my-listing';

type MyListingsQuery = ReturnType<typeof useMyListings>;

const INITIAL_SKELETON_CARDS = 4;
const NEXT_PAGE_SKELETON_CARDS = 2;
// Start the next request about one screen before the user reaches the end.
const PREFETCH_MARGIN = '0px 0px 800px 0px';
// zmp-ui scrolls inside the Page element, not the window.
const SCROLL_CONTAINER_SELECTOR = '.zaui-page';
const loadMoreButtonClass =
  'block min-h-11 w-full rounded-[10px] border border-solid border-marketplace-line bg-white font-semibold text-marketplace-blue';

export default function MyListingList({
  query,
  isWaitingForSession,
  empty,
  onOpen,
  onOpenActions,
  onAction,
}: {
  query: MyListingsQuery;
  /** Signing in still runs: the list cannot be asked for yet. */
  isWaitingForSession: boolean;
  /** What an empty tab says, with its call to action if any. */
  empty: { title: string; description: string; actionLabel?: string; onAction?: () => void };
  onOpen: (listingId: string) => void;
  onOpenActions: (listing: MyListing) => void;
  onAction: (listingId: string, action: ListingAction) => void;
}) {
  if (isWaitingForSession || (query.isPending && query.fetchStatus !== 'idle')) {
    return <MyListingSkeleton count={INITIAL_SKELETON_CARDS} />;
  }

  if (!query.data) {
    return (
      <FeedbackState
        type="error"
        title="Không tải được tin của bạn"
        description="Vui lòng kiểm tra kết nối mạng và thử lại."
        onAction={() => query.refetch()}
      />
    );
  }

  const listings = query.data.pages.flatMap((page) => page.data);

  if (!listings.length) {
    return <FeedbackState type="empty" {...empty} />;
  }

  return (
    <>
      <div className={myListingStackClass}>
        {listings.map((listing) => (
          <MyListingCard
            key={listing.id}
            listing={listing}
            onAction={onAction}
            onOpen={onOpen}
            onOpenActions={onOpenActions}
          />
        ))}
      </div>
      <ListFooter query={query} />
    </>
  );
}

function ListFooter({ query }: { query: MyListingsQuery }) {
  const { fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isFetchNextPageError } =
    query;

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
        <MyListingSkeleton count={NEXT_PAGE_SKELETON_CARDS} />
      </div>
    );
  }

  if (isFetchNextPageError) {
    return <InlineRetry message="Không tải thêm được tin." onRetry={handleLoadMore} />;
  }

  if (!hasNextPage) {
    return null;
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
