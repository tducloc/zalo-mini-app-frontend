import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';

import type { ReelsPage } from '@/features/reels/types/reel';
import { apiClient } from '@/lib/api-client';

const REELS_PAGE_SIZE = 10;
// Kept like the feed's, so coming back from detail finds the same reels in the same order.
const REELS_STALE_TIME_MS = 5 * 60_000;
const REELS_GC_TIME_MS = 10 * 60_000;
const FIRST_PAGE_CURSOR: string | undefined = undefined;

export const reelKeys = {
  all: () => ['reels'] as const,
};

// Public like the feed: the unauthenticated client, so browsing never asks for a re-login.
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
  staleTime: REELS_STALE_TIME_MS,
  gcTime: REELS_GC_TIME_MS,
});

export function useReels() {
  return useInfiniteQuery(reelsQueryOptions);
}
