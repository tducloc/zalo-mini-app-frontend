import {
  InfiniteQueryObserver,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  prefetchFirstReelsPage,
  reelKeys,
  reelsQueryOptions,
  useReels,
} from '@/features/reels/api/get-reels';
import type { ReelsPage } from '@/features/reels/types/reel';
import { restartStaleReels } from '@/features/reels/utils/restart-stale-reels';
import { apiClient } from '@/lib/api-client';
import { createQueryClient } from '@/lib/query-client';
import { useReelsStore } from '@/stores/reels';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));

const LOADED_PAGES = 3;
// Listings go stale after a minute.
const JUST_STALE_MS = 61_000;
const JUST_FRESH_MS = 59_000;

function reelsPage(label: string, cursor: string | undefined): ReelsPage {
  const pageNumber = cursor ? Number(cursor.replace('c', '')) : 1;
  return {
    data: [{ id: `${label}-${pageNumber}` } as ReelsPage['data'][number]],
    meta: { nextCursor: `c${pageNumber + 1}`, hasNextPage: true },
  };
}

function cursorOf(config: { params?: unknown } | undefined) {
  const params = config?.params;
  const hasCursor =
    typeof params === 'object' && params !== null && 'cursor' in params && !!params.cursor;
  return hasCursor ? String(params.cursor) : undefined;
}

function answerReelsWith(label: string) {
  vi.mocked(apiClient.get).mockImplementation(async (_path, config) => ({
    data: reelsPage(label, cursorOf(config)),
  }));
}

const loadedIds = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<{ pages: ReelsPage[] }>(reelKeys.all())
    ?.pages.map((page) => page.data[0].id);

function ageReels(queryClient: QueryClient, ageMs: number) {
  queryClient.setQueryData(reelKeys.all(), (data: unknown) => data, {
    updatedAt: Date.now() - ageMs,
  });
}

/** Reels the viewer swiped through three pages of, loaded the way the Reels page loads them. */
async function cacheSwipedReels(queryClient: QueryClient, ageMs: number) {
  answerReelsWith('old');
  const observer = new InfiniteQueryObserver(queryClient, reelsQueryOptions);
  const unsubscribe = observer.subscribe(() => undefined);
  await observer.refetch();
  for (let page = 1; page < LOADED_PAGES; page += 1) {
    await observer.fetchNextPage();
  }
  unsubscribe();
  answerReelsWith('new');
  vi.mocked(apiClient.get).mockClear();

  ageReels(queryClient, ageMs);
}

function newQueryClient() {
  return createQueryClient();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('Reels freshness', () => {
  beforeEach(() => {
    useReelsStore.setState({ activeProductId: null });
  });
  afterEach(() => vi.clearAllMocks());

  it('loads page one alone when the viewer comes back to stale reels', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_STALE_MS);

    restartStaleReels(queryClient);
    await vi.waitFor(() => expect(loadedIds(queryClient)).toEqual(['new-1']));

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/reels', {
      params: { limit: 10, cursor: undefined },
      signal: expect.anything(),
    });
  });

  it('starts a returning viewer at the first reel of the short list', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_STALE_MS);
    useReelsStore.setState({ activeProductId: 'old-3' });

    restartStaleReels(queryClient);

    expect(useReelsStore.getState().activeProductId).toBe('old-1');
  });

  it('leaves the first visit alone, so the tab tap can start the first reel', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_STALE_MS);

    restartStaleReels(queryClient);

    expect(useReelsStore.getState().activeProductId).toBeNull();
  });

  it('keeps fresh reels and the viewer’s place', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_FRESH_MS);
    useReelsStore.setState({ activeProductId: 'old-3' });

    restartStaleReels(queryClient);
    await settle();

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(loadedIds(queryClient)).toEqual(['old-1', 'old-2', 'old-3']);
    expect(useReelsStore.getState().activeProductId).toBe('old-3');
  });

  it('does not reload stale reels on mount or when the network returns', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_STALE_MS);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useReels(), { wrapper });
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await settle();
    });

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(loadedIds(queryClient)).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('marks reels stale without a request, and reloads page one on the next visit', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_FRESH_MS);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    renderHook(() => useReels(), { wrapper });

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: reelKeys.all(), refetchType: 'none' });
      await settle();
    });
    expect(apiClient.get).not.toHaveBeenCalled();

    await act(async () => {
      restartStaleReels(queryClient);
      await settle();
    });

    expect(loadedIds(queryClient)).toEqual(['new-1']);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('prefetches page one alone from a stale cache', async () => {
    const queryClient = newQueryClient();
    await cacheSwipedReels(queryClient, JUST_STALE_MS);

    await prefetchFirstReelsPage(queryClient);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(loadedIds(queryClient)).toEqual(['new-1']);
  });
});
