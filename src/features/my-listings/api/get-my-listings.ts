import { skipToken, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { myListingKeys } from '@/features/my-listings/api/keys';
import type {
  ListingCounts,
  MyListingsPage,
  MyListingsTab,
} from '@/features/my-listings/types/my-listing';
import { tabConfigs } from '@/features/my-listings/constants/tabs';
import { http } from '@/lib/http';

const MY_LISTINGS_PAGE_SIZE = 20;
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

/** One tab's listings, page by page; waits for the signed-in session. */
export function useMyListings(tab: MyListingsTab, viewerId: string | null) {
  const queryClient = useQueryClient();

  return useInfiniteQuery({
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
  });
}

/** The newest counts any tab's list brought, so badges stay put while another tab loads. */
export function useMyListingCounts(viewerId: string | null) {
  return useQuery<ListingCounts>({ queryKey: myListingKeys.counts(viewerId), queryFn: skipToken })
    .data;
}
