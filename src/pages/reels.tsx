import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { useShallow } from 'zustand/react/shallow';

import FeedbackState from '@/components/feedback/feedback-state';
import InlineRetry from '@/components/feedback/inline-retry';
import Skeleton from '@/components/feedback/skeleton';
import { useReels } from '@/features/reels/api/get-reels';
import ReelItem from '@/features/reels/components/reel-item';
import { reelHeightClass, spinnerClass } from '@/features/reels/constants/styles';
import { useActiveReel } from '@/features/reels/hooks/use-active-reel';
import { slotOf } from '@/features/reels/utils/reel-slot';
import { useReelsStore } from '@/stores/reels';
import { getConnection, isSavingData } from '@/utils/network';

/** The next page loads once this many reels or fewer are left below the one on screen. */
const REELS_LEFT_TO_LOAD_MORE = 3;

// The scroller is the page; its bottom padding (the tab bar) lets the last reel reach the top.
const scrollerClass = 'snap-y snap-mandatory bg-black pb-[74px] text-white';
const centredClass = `flex flex-col items-center justify-center ${reelHeightClass}`;

export default function ReelsPage() {
  const navigate = useNavigate();
  const reelsQuery = useReels();
  const { activeId, setActiveId } = useReelsStore(
    useShallow((state) => ({ activeId: state.activeId, setActiveId: state.setActiveId })),
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isAppVisible = useIsDocumentVisible();

  const reels = reelsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = reelsQuery;

  // Back from detail (the page remounts): the reel that was on screen, if still listed.
  const restoredIndex = Math.max(
    0,
    reels.findIndex((reel) => reel.id === activeId),
  );
  const activeIndex = useActiveReel(scrollerRef, reels.length + 1, restoredIndex);
  // Undefined on the footer after the last reel.
  const activeReelId = reels[activeIndex]?.id;
  // Asked each render: the connection may change while the viewer swipes.
  const canPreload = !isSavingData(getConnection());

  const hasRestoredRef = useRef(false);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (hasRestoredRef.current || !scroller || !reels.length) {
      return;
    }
    hasRestoredRef.current = true;
    const reel = scroller.querySelector(`[data-reel-index="${activeIndex}"]`);
    if (reel) {
      scroller.scrollTop += reel.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    }
  }, [reels.length, activeIndex]);

  useEffect(() => {
    if (activeReelId) {
      setActiveId(activeReelId);
    }
  }, [activeReelId, setActiveId]);

  const isNearEnd = reels.length - 1 - activeIndex <= REELS_LEFT_TO_LOAD_MORE;
  // Never while any fetch runs, and not again after a failed page until the viewer retries.
  const canLoadMore = hasNextPage && !isFetching && !isFetchNextPageError;
  useEffect(() => {
    if (isNearEnd && canLoadMore) {
      void fetchNextPage();
    }
  }, [isNearEnd, canLoadMore, fetchNextPage]);

  let content: ReactNode;
  if (reelsQuery.isPending) {
    content = <ReelSkeleton />;
  } else if (reelsQuery.isError && !reelsQuery.data) {
    content = (
      <div className={centredClass}>
        <FeedbackState
          type="error"
          title="Không tải được video"
          description="Vui lòng kiểm tra kết nối mạng và thử lại."
          onAction={() => reelsQuery.refetch()}
        />
      </div>
    );
  } else if (!reels.length) {
    content = (
      <div className={centredClass}>
        <FeedbackState
          type="empty"
          title="Chưa có video nào"
          description="Vui lòng quay lại sau."
        />
      </div>
    );
  } else {
    content = (
      <>
        {reels.map((reel, index) => (
          <ReelItem
            key={reel.id}
            reel={reel}
            index={index}
            slot={slotOf(index, activeIndex, canPreload)}
            isAppVisible={isAppVisible}
            onOpen={(productId) => navigate(`/products/${productId}`)}
          />
        ))}
        {/* After the last reel, and watched like one so that no video plays behind it. */}
        <div className={`snap-start ${centredClass}`} data-reel-index={reels.length}>
          {isFetchNextPageError ? (
            <InlineRetry message="Không tải thêm được video." onRetry={() => fetchNextPage()} />
          ) : hasNextPage ? (
            <span className={spinnerClass} />
          ) : (
            <p className="m-0 text-sm text-white/70">Bạn đã xem hết video.</p>
          )}
        </div>
      </>
    );
  }

  return (
    // No reset to the top: it would land after the restore when StrictMode runs effects twice.
    <Page ref={scrollerRef} className={scrollerClass} hideScrollbar resetScroll={false}>
      {content}
    </Page>
  );
}

/** The shape of a reel's details while the first page loads. */
function ReelSkeleton() {
  return (
    <div className={`relative ${reelHeightClass}`} role="status" aria-label="Đang tải video">
      <div className="absolute inset-x-4 bottom-5 flex flex-col gap-2 opacity-20">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-6 w-24 rounded-md" />
      </div>
    </div>
  );
}

function useIsDocumentVisible() {
  const [isVisible, setIsVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const update = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return isVisible;
}
