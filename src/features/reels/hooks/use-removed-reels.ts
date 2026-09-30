import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { reelKeys } from '@/features/reels/api/get-reels';
import type { ReelItem, ReelsPage } from '@/features/reels/types/reel';
import {
  forgetReelRemovals,
  indexAfterRemoval,
  neighborId,
  pendingReelIds,
  removalsAfterSwitch,
  setReelsMounted,
} from '@/features/reels/utils/pending-removal';
import { useReelsStore } from '@/stores/reels';

function dropRemovedReels(queryClient: ReturnType<typeof useQueryClient>, ids: readonly string[]) {
  const removed = new Set(ids);
  queryClient.setQueriesData<InfiniteData<ReelsPage>>({ queryKey: reelKeys.all() }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            data: page.data.filter((item) => !removed.has(item.id)),
          })),
        }
      : data,
  );
}

/**
 * Marked reels stay while the viewer is on them. They leave the list when the
 * viewer swipes to another reel, or when this page goes away.
 */
export function useRemovedReels(
  reels: ReelItem[],
  activeIndex: number,
  activeReelId: string | undefined,
  setActiveIndex: (index: number) => void,
) {
  const queryClient = useQueryClient();
  const reelsRef = useRef(reels);
  reelsRef.current = reels;

  useEffect(() => {
    setReelsMounted(true);
    return () => {
      setReelsMounted(false);
      const leaving = pendingReelIds();
      if (!leaving.length) {
        return;
      }
      const ids = reelsRef.current.map((reel) => reel.id);
      const current = useReelsStore.getState().activeProductId;
      const neighbor = current && leaving.includes(current) ? neighborId(ids, current) : undefined;
      if (neighbor) {
        useReelsStore.getState().setActiveProductId(neighbor);
      }
      dropRemovedReels(queryClient, leaving);
      forgetReelRemovals(leaving);
    };
  }, [queryClient]);

  useEffect(() => {
    const leaving = removalsAfterSwitch(activeReelId, pendingReelIds());
    if (!leaving.length) {
      return;
    }
    const ids = reelsRef.current.map((reel) => reel.id);
    const nextIndex = indexAfterRemoval(ids, activeIndex, new Set(leaving));
    dropRemovedReels(queryClient, leaving);
    forgetReelRemovals(leaving);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  }, [activeReelId, activeIndex, queryClient, setActiveIndex]);
}
