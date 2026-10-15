import {
  InfiniteQueryObserver,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode, RefObject } from 'react';

import { useRestartStaleFeed } from '@/features/feed/hooks/use-restart-stale-feed';
import { getProductFeed, useProductFeed } from '@/features/products/api/get-product-feed';
import { productKeys } from '@/features/products/api/keys';
import type { ProductFeedPage, ProductFeedParams } from '@/features/products/types/product';
import { apiClient } from '@/lib/api-client';
import { createQueryClient } from '@/lib/query-client';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));

let locationKey = '';
vi.mock('zmp-ui', () => ({ useLocation: () => ({ key: locationKey }) }));

const homeParams: ProductFeedParams = { sortBy: 'publishedAt', order: 'desc' };
const carParams: ProductFeedParams = { ...homeParams, q: 'xe' };

const LOADED_PAGES = 3;
// Listings go stale after a minute.
const JUST_STALE_MS = 61_000;
const JUST_FRESH_MS = 59_000;

function feedPage(label: string, cursor: string | undefined): ProductFeedPage {
  const pageNumber = cursor ? Number(cursor.replace('c', '')) : 1;
  return {
    data: [{ id: `${label}-${pageNumber}` } as ProductFeedPage['data'][number]],
    meta: { nextCursor: `c${pageNumber + 1}`, hasNextPage: true },
  };
}

function cursorOf(config: { params?: unknown } | undefined) {
  const params = config?.params;
  const hasCursor =
    typeof params === 'object' && params !== null && 'cursor' in params && !!params.cursor;
  return hasCursor ? String(params.cursor) : undefined;
}

function answerFeedWith(label: string) {
  vi.mocked(apiClient.get).mockImplementation(async (_path, config) => ({
    data: feedPage(label, cursorOf(config)),
  }));
}

/** A feed the buyer scrolled through three pages of, loaded the way Home loads it. */
async function cacheScrolledFeed(
  queryClient: QueryClient,
  params: ProductFeedParams,
  ageMs: number,
) {
  answerFeedWith('old');
  const observer = new InfiniteQueryObserver(queryClient, {
    queryKey: productKeys.feed(params),
    queryFn: ({ pageParam, signal }) => getProductFeed(params, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await observer.refetch();
  for (let page = 1; page < LOADED_PAGES; page += 1) {
    await observer.fetchNextPage();
  }
  unsubscribe();
  answerFeedWith('new');
  vi.mocked(apiClient.get).mockClear();

  ageFeed(queryClient, params, ageMs);
}

function ageFeed(queryClient: QueryClient, params: ProductFeedParams, ageMs: number) {
  queryClient.setQueryData(productKeys.feed(params), (data: unknown) => data, {
    updatedAt: Date.now() - ageMs,
  });
}

const loadedIds = (queryClient: QueryClient, params: ProductFeedParams) =>
  queryClient
    .getQueryData<{ pages: ProductFeedPage[] }>(productKeys.feed(params))
    ?.pages.map((page) => page.data[0].id);

function setUp() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const scrollTo = vi.fn();
  const scrollerRef = { current: { scrollTo } } as unknown as RefObject<HTMLElement>;

  // Home's order: the feed query first, then the hook.
  const mountHome = (params: ProductFeedParams) =>
    renderHook(
      ({ feedParams }) => {
        const feed = useProductFeed(feedParams);
        useRestartStaleFeed(feedParams, scrollerRef);
        return feed;
      },
      { wrapper, initialProps: { feedParams: params } },
    );

  return { queryClient, scrollTo, mountHome };
}

// The hook remembers the last Home entry between mounts, so each test gets its own history entries.
let entryNumber = 0;
const openNewEntry = () => {
  entryNumber += 1;
  locationKey = `entry-${entryNumber}`;
};

describe('Home feed freshness', () => {
  beforeEach(openNewEntry);
  afterEach(() => vi.clearAllMocks());

  it('loads page one alone when a stale feed comes back from a tab', async () => {
    const { queryClient, scrollTo, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_STALE_MS);

    const { result } = mountHome(homeParams);

    await waitFor(() => expect(loadedIds(queryClient, homeParams)).toEqual(['new-1']));
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/products', {
      params: { ...homeParams, limit: 20, cursor: undefined },
      signal: expect.anything(),
    });
    expect(result.current.hasNextPage).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('shows the cache without a request when the feed is fresh on return', async () => {
    const { queryClient, scrollTo, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_FRESH_MS);

    mountHome(homeParams);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(loadedIds(queryClient, homeParams)).toEqual(['old-1', 'old-2', 'old-3']);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps a stale list when the buyer comes back from a listing', async () => {
    const { queryClient, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_FRESH_MS);
    mountHome(homeParams).unmount();

    ageFeed(queryClient, homeParams, JUST_STALE_MS);
    mountHome(homeParams);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(loadedIds(queryClient, homeParams)).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('does not reload a feed that turns stale while the buyer is on Home', async () => {
    const { queryClient, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_FRESH_MS);
    const { rerender } = mountHome(homeParams);

    ageFeed(queryClient, homeParams, JUST_STALE_MS);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    rerender({ feedParams: homeParams });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(loadedIds(queryClient, homeParams)).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('loads page one alone when the filters change to a stale cached feed', async () => {
    const { queryClient, scrollTo, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_FRESH_MS);
    await cacheScrolledFeed(queryClient, carParams, JUST_STALE_MS);
    const { rerender } = mountHome(homeParams);
    expect(scrollTo).not.toHaveBeenCalled();

    rerender({ feedParams: carParams });

    await waitFor(() => expect(loadedIds(queryClient, carParams)).toEqual(['new-1']));
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/products', {
      params: { ...carParams, limit: 20, cursor: undefined },
      signal: expect.anything(),
    });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(loadedIds(queryClient, homeParams)).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('shows a fresh cached feed on a filter change without a request', async () => {
    const { queryClient, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_FRESH_MS);
    await cacheScrolledFeed(queryClient, carParams, JUST_FRESH_MS);
    const { rerender } = mountHome(homeParams);

    rerender({ feedParams: carParams });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(loadedIds(queryClient, carParams)).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('loads page one alone on the next tab visit after a posted listing marked the feed', async () => {
    const { queryClient, mountHome } = setUp();
    await cacheScrolledFeed(queryClient, homeParams, JUST_FRESH_MS);

    await queryClient.invalidateQueries({ queryKey: productKeys.feeds(), refetchType: 'none' });
    expect(apiClient.get).not.toHaveBeenCalled();

    mountHome(homeParams);

    await waitFor(() => expect(loadedIds(queryClient, homeParams)).toEqual(['new-1']));
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
