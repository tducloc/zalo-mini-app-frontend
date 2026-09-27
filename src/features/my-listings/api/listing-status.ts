import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';

import { myListingKeys } from '@/features/my-listings/api/keys';
import { MY_LISTINGS_TABS } from '@/features/my-listings/constants/tabs';
import {
  ListingAction,
  type MyListingsPage,
  type StatusChange,
} from '@/features/my-listings/types/my-listing';
import { getTabForStatus, withoutListing } from '@/features/my-listings/utils/my-listing';
import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types/product';
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

/**
 * Changes a listing's status, then brings every copy up to date: the owner's detail at once,
 * the card out of the tab it left, and the lists, counts, other detail copies and the public
 * feed refetched.
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
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: myListingKeys.all() });
      void queryClient.invalidateQueries({ queryKey: productKeys.feeds() });
    },
  });
}
