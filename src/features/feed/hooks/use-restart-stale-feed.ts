import { useQueryClient } from '@tanstack/react-query';
import { type RefObject, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'zmp-ui';

import { productKeys } from '@/features/products/api/keys';
import type { ProductFeedParams } from '@/features/products/types/product';
import { LISTING_STALE_TIME_MS } from '@/lib/query-client';
import { restartIfStale } from '@/lib/restart-stale-query';

// Home unmounts whenever another page is on top. It comes back either through history (the
// listing's back button: the same history entry, so the same location key) or as a new entry
// (a tab replaces the page, so its key is new).
let lastHomeLocationKey: string | undefined;

/**
 * Starts a stale feed again from page one, with the list back at the top, when:
 * - the buyer comes back to Home from a tab, and
 * - the search or filters change to a feed that is already cached.
 * Coming back from a listing keeps the list and its position, however old it is.
 *
 * It uses layout effects so it runs before the feed query's own effects, which would refetch
 * every cached page of a stale feed. Call it after `useProductFeed`.
 */
export function useRestartStaleFeed(
  params: ProductFeedParams,
  scrollerRef: RefObject<HTMLElement>,
) {
  const queryClient = useQueryClient();
  const locationKey = useLocation().key;
  const feedKey = JSON.stringify(params);
  const shownFeedKeyRef = useRef(feedKey);

  const restartIfOld = () =>
    restartIfStale(queryClient, productKeys.feed(params), LISTING_STALE_TIME_MS);

  // The decision is made once per mount. In development StrictMode runs this effect twice, and
  // the page's own scroll restore runs again in between, so the scroll is repeated.
  const didRestartOnMountRef = useRef<boolean>();
  useLayoutEffect(() => {
    if (didRestartOnMountRef.current === undefined) {
      const isBackFromListing = locationKey === lastHomeLocationKey;
      lastHomeLocationKey = locationKey;
      didRestartOnMountRef.current = !isBackFromListing && restartIfOld();
    }

    if (didRestartOnMountRef.current) {
      scrollerRef.current?.scrollTo({ top: 0 });
    }
  }, []);

  // New search/filters start at the top. Not on mount: returning from a listing restores the
  // previous position.
  useLayoutEffect(() => {
    if (shownFeedKeyRef.current === feedKey) {
      return;
    }

    shownFeedKeyRef.current = feedKey;
    scrollerRef.current?.scrollTo({ top: 0 });
    restartIfOld();
  }, [feedKey]);
}
