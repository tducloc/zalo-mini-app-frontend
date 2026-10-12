import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useCategories } from '@/features/categories/api/get-categories';
import { useLocations } from '@/features/locations/api/get-locations';
import {
  getProductFeed,
  refreshProductFeed,
  useProductFeed,
} from '@/features/products/api/get-product-feed';
import { productKeys } from '@/features/products/api/keys';
import type { ProductFeedPage, ProductFeedParams } from '@/features/products/types/product';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));

const filteredParams: ProductFeedParams = {
  q: 'xe',
  categoryId: 'cat_vehicles',
  locationId: 'loc_hcm',
  minPrice: 1_000_000,
  maxPrice: 5_000_000,
  sortBy: 'price',
  order: 'asc',
};

const LOADED_PAGES = 3;

function feedPage(label: string, cursor: string | undefined): ProductFeedPage {
  const pageNumber = cursor ? Number(cursor.replace('c', '')) : 1;
  return {
    data: [{ id: `${label}-${pageNumber}` } as ProductFeedPage['data'][number]],
    meta: { nextCursor: `c${pageNumber + 1}`, hasNextPage: true },
  };
}

function answerFeedWith(label: string) {
  vi.mocked(apiClient.get).mockImplementation(async (path) => {
    if (path === '/products') {
      return { data: feedPage(label, undefined) };
    }
    return { data: { data: [] } };
  });
}

/** Home's queries after the buyer scrolled through three pages of a filtered feed. */
async function renderHomeQueries() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const cursors = [undefined, 'c2', 'c3'];
  queryClient.setQueryData(productKeys.feed(filteredParams), {
    pages: cursors.map((cursor) => feedPage('old', cursor)),
    pageParams: cursors,
  });

  answerFeedWith('old');
  const { result } = renderHook(
    () => {
      const categories = useCategories();
      const locations = useLocations();
      return { feed: useProductFeed(filteredParams), categories, locations };
    },
    { wrapper },
  );

  await waitFor(() => {
    expect(result.current.categories.isSuccess).toBe(true);
    expect(result.current.locations.isSuccess).toBe(true);
  });
  expect(result.current.feed.data?.pages).toHaveLength(LOADED_PAGES);

  vi.mocked(apiClient.get).mockClear();
  return { queryClient, result };
}

describe('refreshProductFeed', () => {
  afterEach(() => vi.clearAllMocks());

  it('asks once for page one of the same search and filters', async () => {
    const { queryClient, result } = await renderHomeQueries();
    answerFeedWith('new');

    await act(() => refreshProductFeed(queryClient, filteredParams));

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/products', {
      params: { ...filteredParams, limit: 20, cursor: undefined },
      signal: expect.anything(),
    });
    await waitFor(() =>
      expect(result.current.feed.data?.pages.map((page) => page.data[0].id)).toEqual(['new-1']),
    );
    expect(result.current.feed.hasNextPage).toBe(true);
  });

  it('keeps the old first page on screen while page one reloads', async () => {
    const { queryClient, result } = await renderHomeQueries();
    let answer: (page: ProductFeedPage) => void = () => {};
    vi.mocked(apiClient.get).mockImplementation(
      () => new Promise((resolve) => (answer = (page) => resolve({ data: page }))),
    );

    let refresh: Promise<void> = Promise.resolve();
    act(() => {
      refresh = refreshProductFeed(queryClient, filteredParams);
    });

    await waitFor(() => expect(result.current.feed.isFetching).toBe(true));
    expect(result.current.feed.isPending).toBe(false);
    expect(result.current.feed.data?.pages.map((page) => page.data[0].id)).toEqual(['old-1']);

    await act(async () => {
      answer(feedPage('new', undefined));
      await refresh;
    });
    await waitFor(() =>
      expect(result.current.feed.data?.pages.map((page) => page.data[0].id)).toEqual(['new-1']),
    );
  });

  it('does not ask for categories or locations again', async () => {
    const { queryClient } = await renderHomeQueries();

    await act(() => refreshProductFeed(queryClient, filteredParams));

    expect(apiClient.get).not.toHaveBeenCalledWith('/categories', expect.anything());
    expect(apiClient.get).not.toHaveBeenCalledWith('/locations', expect.anything());
  });

  it('only marks other cached searches stale', async () => {
    const { queryClient } = await renderHomeQueries();
    const otherParams: ProductFeedParams = { sortBy: 'publishedAt', order: 'desc' };
    const otherKey = productKeys.feed(otherParams);
    await queryClient.prefetchInfiniteQuery({
      queryKey: otherKey,
      queryFn: ({ pageParam }) => getProductFeed(otherParams, pageParam),
      initialPageParam: undefined as string | undefined,
    });
    vi.mocked(apiClient.get).mockClear();

    await act(() => refreshProductFeed(queryClient, filteredParams));

    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
