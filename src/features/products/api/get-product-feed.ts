import { type InfiniteData, type QueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { productKeys } from '@/features/products/api/keys';
import type { ProductFeedPage, ProductFeedParams } from '@/features/products/types/product';
import { apiClient } from '@/lib/api-client';
import { LISTING_GC_TIME_MS, LISTING_STALE_TIME_MS } from '@/lib/query-client';

const FEED_PAGE_SIZE = 20;
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

/**
 * Pull to refresh: loads page one of this feed again and drops the other pages first, so one
 * request runs and later pages load on scroll with the new cursor. The old first page stays on
 * screen until the new one arrives. Other searches and filters are only marked stale.
 */
export async function refreshProductFeed(queryClient: QueryClient, params: ProductFeedParams) {
  queryClient.setQueryData<InfiniteData<ProductFeedPage, string | undefined>>(
    productKeys.feed(params),
    (data) => data && { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
  );

  await queryClient.invalidateQueries({ queryKey: productKeys.feeds() });
}

export function useProductFeed(params: ProductFeedParams) {
  return useInfiniteQuery({
    queryKey: productKeys.feed(params),
    queryFn: ({ pageParam, signal }) => getProductFeed(params, pageParam, signal),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: LISTING_STALE_TIME_MS,
    gcTime: LISTING_GC_TIME_MS,
  });
}
