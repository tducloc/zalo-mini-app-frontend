import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Page, useLocation } from 'zmp-ui';
import { useShallow } from 'zustand/react/shallow';

import FeedbackState from '@/components/feedback/feedback-state';
import InlineRetry from '@/components/feedback/inline-retry';
import Skeleton from '@/components/feedback/skeleton';
import { useReels } from '@/features/reels/api/get-reels';
import ReelItem from '@/features/reels/components/reel-item';
import { reelHeightClass, spinnerClass } from '@/features/reels/constants/styles';
import { useActiveReel } from '@/features/reels/hooks/use-active-reel';
import { useLoadMoreReels } from '@/features/reels/hooks/use-load-more-reels';
import { useRemovedReels } from '@/features/reels/hooks/use-removed-reels';
import { useRestoreReelScroll } from '@/features/reels/hooks/use-restore-reel-scroll';
import type { ReelItem as Reel } from '@/features/reels/types/reel';
import { slotOf } from '@/features/reels/utils/reel-slot';
import { useReelsStore } from '@/stores/reels';
import ProductDetailPage from '@/pages/product-detail';

const scrollerClass = 'snap-y snap-mandatory bg-black pb-[74px] text-white';
const centredClass = `flex flex-col items-center justify-center ${reelHeightClass}`;

export default function ReelsPage() {
  const isCurrentRoute = useLocation().pathname === '/reels';
  const reelsQuery = useReels();
  const { activeProductId, setActiveProductId, setTabbarHost, setPagerInteractive } = useReelsStore(
    useShallow((state) => ({
      activeProductId: state.activeProductId,
      setActiveProductId: state.setActiveProductId,
      setTabbarHost: state.setTabbarHost,
      setPagerInteractive: state.setPagerInteractive,
    })),
  );
  const pagerRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const [isFeedVisible, setFeedVisible] = useState(true);
  const [isDetailShowing, setDetailShowing] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isAppVisible = useIsDocumentVisible();

  useCancelPagerReturnOnRouteChange(pagerRef, isCurrentRoute, setPagerInteractive);

  useEffect(() => {
    if (!isDetailShowing) {
      detailPanelRef.current?.querySelectorAll('video').forEach((video) => video.pause());
    }
  }, [isDetailShowing]);

  const updatePager = () => {
    const pager = pagerRef.current;
    if (!pager || !isCurrentRoute) {
      return;
    }
    setPagerInteractive(pager.scrollLeft > 0);
    setFeedVisible(pager.scrollLeft < 12);
    setDetailShowing(pager.scrollLeft >= pager.clientWidth / 2);
  };

  const showDetail = () => {
    setPagerInteractive(true);
    pagerRef.current?.scrollTo({ left: pagerRef.current.clientWidth, behavior: 'smooth' });
  };
  const showReels = () => pagerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });

  const reels = reelsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = reelsQuery;

  const restoredIndex = Math.max(
    0,
    reels.findIndex((reel) => reel.id === activeProductId),
  );
  const [activeIndex, setActiveIndex] = useActiveReel(scrollerRef, reels.length + 1, restoredIndex);
  const activeReelId = reels[activeIndex]?.id;

  useRemovedReels(reels, activeIndex, activeReelId, setActiveIndex);
  useRestoreReelScroll(scrollerRef, reels.length, activeIndex);
  useLoadMoreReels(
    reels.length,
    activeIndex,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    fetchNextPage,
  );

  useEffect(() => {
    if (activeReelId) {
      setActiveProductId(activeReelId);
    }
  }, [activeReelId, setActiveProductId]);

  const content = (
    <ReelFeed
      isPending={reelsQuery.isPending}
      isError={reelsQuery.isError}
      hasData={Boolean(reelsQuery.data)}
      reels={reels}
      activeIndex={activeIndex}
      isAppVisible={isAppVisible && isFeedVisible}
      hasNextPage={hasNextPage}
      isFetchNextPageError={isFetchNextPageError}
      onRetry={() => reelsQuery.refetch()}
      onRetryNext={() => fetchNextPage()}
      onOpen={showDetail}
    />
  );

  return (
    <div
      ref={pagerRef}
      className="fixed inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-reels-pager
      onScroll={updatePager}
      // Nothing on screen may change on touchstart: iOS then drops the tap's click, and no
      // button in a reel would work. The tab bar joins the pane once the pager scrolls.
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onTouchEnd={() => {
        if (pagerRef.current?.scrollLeft === 0) setPagerInteractive(false);
      }}
    >
      <div className="relative h-full w-full shrink-0 snap-start">
        {/* No reset to the top: it would land after the restore when StrictMode runs effects twice. */}
        <Page ref={scrollerRef} className={scrollerClass} hideScrollbar resetScroll={false}>
          {content}
        </Page>
        <div
          ref={setTabbarHost}
          className="pointer-events-none absolute inset-0 z-[900] transform-gpu"
        />
      </div>
      <div
        ref={detailPanelRef}
        className="relative h-full w-full shrink-0 transform-gpu snap-start overflow-hidden bg-white"
      >
        {activeReelId && (
          <ProductDetailPage
            key={activeReelId}
            mode="embedded"
            productId={activeReelId}
            onBack={showReels}
          />
        )}
      </div>
    </div>
  );
}

function ReelFeed({
  isPending,
  isError,
  hasData,
  reels,
  activeIndex,
  isAppVisible,
  hasNextPage,
  isFetchNextPageError,
  onRetry,
  onRetryNext,
  onOpen,
}: {
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
  reels: Reel[];
  activeIndex: number;
  isAppVisible: boolean;
  hasNextPage: boolean;
  isFetchNextPageError: boolean;
  onRetry: () => void;
  onRetryNext: () => void;
  onOpen: () => void;
}) {
  if (isPending) {
    return <ReelSkeleton />;
  }

  if (isError && !hasData) {
    return (
      <div className={centredClass}>
        <FeedbackState
          type="error"
          title="Không tải được video"
          description="Vui lòng kiểm tra kết nối mạng và thử lại."
          onAction={onRetry}
        />
      </div>
    );
  }

  if (!reels.length) {
    return (
      <div className={centredClass}>
        <FeedbackState
          type="empty"
          title="Chưa có video nào"
          description="Vui lòng quay lại sau."
        />
      </div>
    );
  }

  return (
    <>
      {reels.map((reel, index) => (
        <ReelItem
          key={reel.id}
          reel={reel}
          index={index}
          slot={slotOf(index, activeIndex)}
          isAppVisible={isAppVisible}
          onOpen={onOpen}
        />
      ))}
      <div className={`snap-start ${centredClass}`} data-reel-index={reels.length}>
        {isFetchNextPageError ? (
          <InlineRetry message="Không tải thêm được video." onRetry={onRetryNext} />
        ) : hasNextPage ? (
          <span className={spinnerClass} />
        ) : (
          <p className="m-0 text-sm text-white/70">Bạn đã xem hết video.</p>
        )}
      </div>
    </>
  );
}

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

/** Back on the Reels pane whenever the route comes or goes, cutting short a smooth return. */
function useCancelPagerReturnOnRouteChange(
  pagerRef: RefObject<HTMLDivElement>,
  isCurrentRoute: boolean,
  setPagerInteractive: (isInteractive: boolean) => void,
) {
  useLayoutEffect(() => {
    const pager = pagerRef.current;
    if (!pager) {
      return;
    }
    pager.scrollLeft = 0;
    setPagerInteractive(false);
    return () => {
      pager.scrollLeft = 0;
      setPagerInteractive(false);
    };
  }, [pagerRef, isCurrentRoute, setPagerInteractive]);
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
