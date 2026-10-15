import {
  type QueryClient,
  skipToken,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useLayoutEffect } from 'react';

import { myListingKeys } from '@/features/my-listings/api/keys';
import type {
  ListingCounts,
  MyListingsPage,
  MyListingsTab,
} from '@/features/my-listings/types/my-listing';
import { tabConfigs } from '@/features/my-listings/constants/tabs';
import { http } from '@/lib/http';
import { LISTING_STALE_TIME_MS } from '@/lib/query-client';
import {
  keepFirstPage,
  restartIfStale,
  reloadEmptyListOnReconnect,
} from '@/lib/restart-stale-query';

const MY_LISTINGS_PAGE_SIZE = 20;
/**
 * "Đang xử lý" asks again this often while it lists anything: its listings leave as the
 * worker finishes them.
 */
const PROCESSING_REFRESH_MS = 3_000;
// The first page has no cursor; typed so later pages can pass one.
const FIRST_PAGE_CURSOR: string | undefined = undefined;

export async function getMyListings(
  tab: MyListingsTab,
  cursor: string | undefined,
  signal?: AbortSignal,
) {
  const response = await http.get<MyListingsPage>('/me/products', {
    params: { status: tabConfigs[tab].status, limit: MY_LISTINGS_PAGE_SIZE, cursor },
    signal,
  });
  return response.data;
}

/**
 * After the owner's own change (a post, an edit, a status change): marks every list stale and
 * loads the one on screen again. Each list drops to page one first, so that is one request, not
 * one per loaded page.
 */
export function invalidateMyListings(queryClient: QueryClient) {
  keepFirstPage<MyListingsPage>(queryClient, { queryKey: myListingKeys.lists() });

  return queryClient.invalidateQueries({ queryKey: myListingKeys.all() });
}

/**
 * One tab's listings, page by page; waits for the signed-in session. A list that is stale when
 * the page opens or the tab changes starts again from page one.
 */
export function useMyListings(tab: MyListingsTab, viewerId: string | null) {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: myListingKeys.list(tab, viewerId),
    queryFn: async ({ pageParam, signal }) => {
      const page = await getMyListings(tab, pageParam, signal);
      // Every page carries the counts of all tabs: keep the newest for the tab badges.
      queryClient.setQueryData(myListingKeys.counts(viewerId), page.meta.counts);
      return page;
    },
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: Boolean(viewerId),
    staleTime: LISTING_STALE_TIME_MS,
    // A stale infinite query would refetch every loaded page; the layout effect below reloads
    // page one instead.
    refetchOnMount: false,
    refetchOnReconnect: reloadEmptyListOnReconnect,
    refetchInterval: (query) =>
      tab === 'processing' && query.state.data?.pages[0]?.data.length
        ? PROCESSING_REFRESH_MS
        : false,
  });

  // A layout effect, so it runs before the query's own effects, which would refetch every
  // cached page of a stale list.
  useLayoutEffect(() => {
    if (viewerId) {
      restartIfStale(queryClient, myListingKeys.list(tab, viewerId), LISTING_STALE_TIME_MS);
    }
  }, [queryClient, tab, viewerId]);

  return query;
}

/** The newest counts any tab's list brought, so badges stay put while another tab loads. */
export function useMyListingCounts(viewerId: string | null) {
  return useQuery<ListingCounts>({ queryKey: myListingKeys.counts(viewerId), queryFn: skipToken })
    .data;
}
