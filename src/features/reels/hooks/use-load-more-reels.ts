import { useEffect } from 'react';

const REELS_LEFT_TO_LOAD_MORE = 3;

/** Fetches the next page once the viewer is within a few reels of the end. */
export function useLoadMoreReels(
  reelCount: number,
  activeIndex: number,
  hasNextPage: boolean,
  isFetching: boolean,
  isFetchNextPageError: boolean,
  fetchNextPage: () => Promise<unknown>,
) {
  const reelsLeft = reelCount - 1 - activeIndex;
  const isNearEnd = reelsLeft <= REELS_LEFT_TO_LOAD_MORE;
  const canLoadMore = hasNextPage && !isFetching && !isFetchNextPageError;

  useEffect(() => {
    if (isNearEnd && canLoadMore) {
      void fetchNextPage();
    }
  }, [isNearEnd, canLoadMore, fetchNextPage]);
}
