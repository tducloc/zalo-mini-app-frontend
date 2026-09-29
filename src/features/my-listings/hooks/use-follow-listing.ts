import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { useMyListings } from '@/features/my-listings/api/get-my-listings';
import { getTabForStatus, includesListing } from '@/features/my-listings/utils/my-listing';
import { productDetailQueryOptions } from '@/features/products/api/get-product-detail';
import { useMyListingsStore } from '@/stores/my-listings';
import { warnInDev } from '@/utils/dev-log';

/** A failed lookup asks again this often: once "Đang xử lý" is empty, nothing refetches it. */
const LOOKUP_RETRY_MS = 3_000;

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
  const [lookupAttempt, setLookupAttempt] = useState(0);

  // A list loaded since the tab opened; a cached one may be older than the save, and a
  // failed load says nothing about where the listing is.
  const missingId =
    followedId !== null &&
    listingsQuery.isFetchedAfterMount &&
    listingsQuery.isSuccess &&
    !listingsQuery.isFetching &&
    !includesListing(listingsQuery.data, followedId)
      ? followedId
      : null;

  useEffect(() => {
    if (missingId === null) {
      return;
    }
    let isCurrent = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    queryClient
      .fetchQuery({ ...productDetailQueryOptions(missingId, viewerId), staleTime: 0 })
      .then((listing) => {
        if (isCurrent) {
          selectTab(getTabForStatus(listing.status));
        }
      })
      .catch((error: unknown) => {
        warnInDev('my-listings', 'finding the followed listing failed', error);
        if (isCurrent) {
          retryTimer = setTimeout(
            () => setLookupAttempt((attempt) => attempt + 1),
            LOOKUP_RETRY_MS,
          );
        }
      });
    return () => {
      isCurrent = false;
      clearTimeout(retryTimer);
    };
  }, [missingId, lookupAttempt, viewerId, queryClient, selectTab]);
}
