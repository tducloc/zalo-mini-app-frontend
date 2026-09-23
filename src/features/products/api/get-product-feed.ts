import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

import { productKeys } from './keys';
import type { ProductFeedPage, ProductFeedParams } from '../types';

const FEED_PAGE_SIZE = 20;
const FEED_STALE_TIME_MS = 5 * 60_000;
const FEED_GC_TIME_MS = 10 * 60_000;
// The first page has no cursor; typed so later pages can pass one.
const FIRST_PAGE_CURSOR: string | undefined = undefined;

// The feed is public; it uses the unauthenticated client so an expired token
// never triggers a Zalo re-login just to browse.
export async function getProductFeed(
  params: ProductFeedParams,
  cursor: string | undefined,
  signal?: AbortSignal,
) {
  const response = await apiClient.get<ProductFeedPage>('/products', {
    params: { ...params, limit: FEED_PAGE_SIZE, cursor },
    signal,
  });
  return response.data;
}

export function productFeedQueryOptions(params: ProductFeedParams) {
  return infiniteQueryOptions({
    queryKey: productKeys.feed(params),
    queryFn: ({ pageParam, signal }) => getProductFeed(params, pageParam, signal),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    staleTime: FEED_STALE_TIME_MS,
    gcTime: FEED_GC_TIME_MS,
  });
}

export function useProductFeed(params: ProductFeedParams) {
  return useInfiniteQuery(productFeedQueryOptions(params));
}
