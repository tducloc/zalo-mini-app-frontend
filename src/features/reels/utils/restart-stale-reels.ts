import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { reelKeys } from '@/features/reels/api/get-reels';
import type { ReelsPage } from '@/features/reels/types/reel';
import { LISTING_STALE_TIME_MS } from '@/lib/query-client';
import { restartIfStale } from '@/lib/restart-stale-query';
import { useReelsStore } from '@/stores/reels';

/**
 * Called as the viewer taps the Reels tab, before the page mounts: a stale list starts again from
 * page one, and the viewer starts at its first reel. The page then mounts on the short list, so
 * the reel it restores always exists. Before the first visit nothing is restored, so the first
 * reel is left alone and the tap can start it with sound.
 */
export function restartStaleReels(queryClient: QueryClient) {
  if (!restartIfStale(queryClient, reelKeys.all(), LISTING_STALE_TIME_MS)) {
    return;
  }

  const { activeProductId, setActiveProductId } = useReelsStore.getState();
  const firstReel = queryClient.getQueryData<InfiniteData<ReelsPage>>(reelKeys.all())?.pages[0]
    ?.data[0];
  if (activeProductId !== null && firstReel) {
    setActiveProductId(firstReel.id);
  }
}
