import { infiniteQueryOptions, type QueryClient, useInfiniteQuery } from '@tanstack/react-query';

import type { ReelsPage } from '@/features/reels/types/reel';
import { apiClient } from '@/lib/api-client';
import { LISTING_GC_TIME_MS, LISTING_STALE_TIME_MS } from '@/lib/query-client';

const REELS_PAGE_SIZE = 10;
const FIRST_PAGE_CURSOR: string | undefined = undefined;

export const reelKeys = {
  all: () => ['reels'] as const,
};

export async function getReels(cursor: string | undefined, signal?: AbortSignal) {
  const response = await apiClient.get<ReelsPage>('/reels', {
    params: { limit: REELS_PAGE_SIZE, cursor },
    signal,
  });
  return response.data;
}

export const reelsQueryOptions = infiniteQueryOptions({
  queryKey: reelKeys.all(),
  queryFn: ({ pageParam, signal }) => getReels(pageParam, signal),
  initialPageParam: FIRST_PAGE_CURSOR,
  getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  staleTime: LISTING_STALE_TIME_MS,
  gcTime: LISTING_GC_TIME_MS,
  // A stale infinite query would refetch every loaded page. The Reels tab reloads page one
  // itself when the viewer comes back to it (restart-stale-reels.ts).
  refetchOnMount: false,
  refetchOnReconnect: false,
});

/** Page one only: a stale cache must not make the prefetch load every cached page again. */
export function prefetchFirstReelsPage(queryClient: QueryClient) {
  return queryClient.prefetchInfiniteQuery({ ...reelsQueryOptions, pages: 1 });
}

export function useReels() {
  return useInfiniteQuery(reelsQueryOptions);
}
