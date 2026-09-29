import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { useMyListings } from '@/features/my-listings/api/get-my-listings';
import { getTabForStatus, includesListing } from '@/features/my-listings/utils/my-listing';
import { productDetailQueryOptions } from '@/features/products/api/get-product-detail';
import { useMyListingsStore } from '@/stores/my-listings';
import { warnInDev } from '@/utils/dev-log';

/**
 * Keeps My listings on the listing the seller just posted or saved. The media worker can
 * publish (or fail) it before the open tab's list loads, or while "Đang xử lý" shows it:
 * when the list comes back without it, the page asks for the listing and opens its tab.
 */
export function useFollowListing(
  listingsQuery: ReturnType<typeof useMyListings>,
  viewerId: string | null,
) {
  const queryClient = useQueryClient();
  const followedId = useMyListingsStore((state) => state.followedId);
  const selectTab = useMyListingsStore((state) => state.selectTab);

  // A list fetched since the tab opened; a cached one may be older than the save.
  const missingId =
    followedId !== null &&
    listingsQuery.isFetchedAfterMount &&
    !listingsQuery.isFetching &&
    !includesListing(listingsQuery.data, followedId)
      ? followedId
      : null;

  useEffect(() => {
    if (missingId === null) {
      return;
    }
    let isCurrent = true;
    queryClient
      .fetchQuery({ ...productDetailQueryOptions(missingId, viewerId), staleTime: 0 })
      .then((listing) => {
        if (isCurrent) {
          selectTab(getTabForStatus(listing.status));
        }
      })
      // Still followed: the next fetch of the list asks again.
      .catch((error: unknown) =>
        warnInDev('my-listings', 'finding the followed listing failed', error),
      );
    return () => {
      isCurrent = false;
    };
  }, [missingId, viewerId, queryClient, selectTab]);
}
