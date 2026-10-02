import { useInfiniteQuery } from '@tanstack/react-query';

import { productKeys } from '@/features/products/api/keys';
import type { ProductFeedPage, ProductFeedParams } from '@/features/products/types/product';
import { apiClient } from '@/lib/api-client';

const FEED_PAGE_SIZE = 20;
const FEED_STALE_TIME_MS = 5 * 60_000;
const FEED_GC_TIME_MS = 10 * 60_000;
// The first page has no cursor; typed so later pages can pass one.
const FIRST_PAGE_CURSOR: string | undefined = undefined;

declare global {
  interface Window {
    /** Started from index.html, before the app script runs. Consumed once. */
    __feedPrefetch?: Promise<ProductFeedPage>;
  }
}

function isDefaultFirstPage(params: ProductFeedParams, cursor: string | undefined) {
  return (
    cursor === undefined &&
    params.sortBy === 'publishedAt' &&
    params.order === 'desc' &&
    params.q === undefined &&
    params.categoryId === undefined &&
    params.locationId === undefined &&
    params.condition === undefined &&
    params.hasVideo === undefined &&
    params.minPrice === undefined &&
    params.maxPrice === undefined
  );
}

// The feed is public; it uses the unauthenticated client so an expired token
// never triggers a Zalo re-login just to browse.
export async function getProductFeed(
  params: ProductFeedParams,
  cursor: string | undefined,
  signal?: AbortSignal,
) {
  const prefetched = window.__feedPrefetch;

  if (isDefaultFirstPage(params, cursor) && prefetched) {
    window.__feedPrefetch = undefined;

    try {
      return await prefetched;
    } catch {
      // The early request failed. Ask again with the normal client.
    }
  }

  const response = await apiClient.get<ProductFeedPage>('/products', {
    params: { ...params, limit: FEED_PAGE_SIZE, cursor },
    signal,
  });
  return response.data;
}

export function useProductFeed(params: ProductFeedParams) {
  return useInfiniteQuery({
    queryKey: productKeys.feed(params),
    queryFn: ({ pageParam, signal }) => getProductFeed(params, pageParam, signal),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: FEED_STALE_TIME_MS,
    gcTime: FEED_GC_TIME_MS,
  });
}
