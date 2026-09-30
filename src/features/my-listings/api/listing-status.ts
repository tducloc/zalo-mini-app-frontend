import {
  type InfiniteData,
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { myListingKeys } from '@/features/my-listings/api/keys';
import { MY_LISTINGS_TABS } from '@/features/my-listings/constants/tabs';
import {
  ListingAction,
  type MyListingsPage,
  type StatusChange,
} from '@/features/my-listings/types/my-listing';
import { getTabForStatus, withoutListing } from '@/features/my-listings/utils/my-listing';
import { reelKeys } from '@/features/reels/api/get-reels';
import type { ReelsPage } from '@/features/reels/types/reel';
import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail, ProductFeedPage } from '@/features/products/types/product';
import { http } from '@/lib/http';

const statusChangePaths: Record<StatusChange, string> = {
  [ListingAction.MarkSold]: 'sold',
  [ListingAction.Archive]: 'archive',
  [ListingAction.Unarchive]: 'unarchive',
};

/** `POST /products/:id/sold|archive|unarchive`; answers the listing's new detail. */
export async function changeListingStatus(productId: string, change: StatusChange) {
  const response = await http.post<{ data: ProductDetail }>(
    `/products/${encodeURIComponent(productId)}/${statusChangePaths[change]}`,
  );
  return response.data.data;
}

interface StatusChangeInput {
  productId: string;
  change: StatusChange;
}

/** One id taken out of every loaded page. The next cursor stays, so the following page is unchanged. */
function withoutProduct<Page extends { data: { id: string }[] }>(
  data: InfiniteData<Page>,
  productId: string,
): InfiniteData<Page> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.filter((item) => item.id !== productId),
    })),
  };
}

/** Hide or sold: the listing leaves the feed and reels already on screen, without refetching them. */
function dropFromPublicLists(queryClient: QueryClient, productId: string) {
  const drop = <Page extends { data: { id: string }[] }>(data: InfiniteData<Page> | undefined) =>
    data && withoutProduct(data, productId);

  queryClient.setQueriesData<InfiniteData<ProductFeedPage>>(
    { queryKey: productKeys.feeds() },
    drop,
  );
  queryClient.setQueriesData<InfiniteData<ReelsPage>>({ queryKey: reelKeys.all() }, drop);
}

/**
 * Changes a listing's status, then brings every copy up to date: the owner's detail at once,
 * the card out of the tab it left, and the owner's lists refetched.
 * Hiding or selling takes the card out of the feed and reels in memory.
 * Showing it again refetches those lists, because it has to land in the active sort.
 */
export function useChangeListingStatus(viewerId: string | null) {
  const queryClient = useQueryClient();

  const showNewStatus = (product: ProductDetail) => {
    queryClient.setQueryData(productKeys.detail(product.id, viewerId), product);

    const newTab = getTabForStatus(product.status);
    for (const tab of MY_LISTINGS_TABS.filter((other) => other !== newTab)) {
      queryClient.setQueryData<InfiniteData<MyListingsPage, string | undefined>>(
        myListingKeys.list(tab, viewerId),
        (data) => data && withoutListing(data, product.id),
      );
    }
  };

  return useMutation({
    mutationFn: ({ productId, change }: StatusChangeInput) =>
      changeListingStatus(productId, change),
    onSuccess: (product) => {
      showNewStatus(product);
      // The owner's copy was just written; the others refetch when next shown.
      void queryClient.invalidateQueries({
        queryKey: productKeys.detailForAllViewers(product.id),
        refetchType: 'none',
      });
    },
    onError: (_error, { productId }) => {
      // 404/409: the listing changed elsewhere; show what the server has now.
      void queryClient.invalidateQueries({ queryKey: productKeys.detailForAllViewers(productId) });
    },
    // Not awaited: the toast should not wait for the refetches.
    onSettled: (product, _error, { change }) => {
      void queryClient.invalidateQueries({ queryKey: myListingKeys.all() });
      if (!product) {
        return;
      }
      if (change === ListingAction.Unarchive) {
        void queryClient.invalidateQueries({ queryKey: productKeys.feeds() });
        void queryClient.invalidateQueries({ queryKey: reelKeys.all() });
        return;
      }
      dropFromPublicLists(queryClient, product.id);
    },
  });
}
