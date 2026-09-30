// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useChangeListingStatus } from '@/features/my-listings/api/listing-status';
import { ListingAction } from '@/features/my-listings/types/my-listing';
import { productKeys } from '@/features/products/api/keys';
import type { ProductDetail } from '@/features/products/types/product';
import { reelKeys } from '@/features/reels/api/get-reels';
import { http } from '@/lib/http';

vi.mock('@/lib/http', () => ({ http: { post: vi.fn() } }));

const GONE = 'gone';
const feedParams = { sortBy: 'publishedAt', order: 'desc' } as const;
const otherFeedParams = { ...feedParams, hasVideo: true } as const;

function pages(ids: string[][]): {
  pages: { data: { id: string }[]; meta: object }[];
  pageParams: unknown[];
} {
  return {
    pages: ids.map((pageIds, index) => ({
      data: pageIds.map((id) => ({ id })),
      meta: {
        nextCursor: index === ids.length - 1 ? null : `cursor-${index}`,
        hasNextPage: index === 0,
      },
    })),
    pageParams: [undefined, 'cursor-0'],
  };
}

function idsOf(data: { pages: { data: { id: string }[] }[] } | undefined) {
  return data?.pages.map((page) => page.data.map((item) => item.id));
}

function detail(status: ProductDetail['status']): ProductDetail {
  return { id: GONE, status } as ProductDetail;
}

function renderStatus() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(productKeys.feed(feedParams), pages([['keep', GONE], ['later']]));
  queryClient.setQueryData(productKeys.feed(otherFeedParams), pages([[GONE]]));
  queryClient.setQueryData(reelKeys.all(), pages([['keep'], [GONE]]));

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useChangeListingStatus('user_1'), { wrapper });
  return { queryClient, ...hook };
}

describe('useChangeListingStatus', () => {
  it('takes a hidden listing out of every loaded feed and reels page', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { data: detail('ARCHIVED') } });
    const { result, queryClient } = renderStatus();

    await result.current.mutateAsync({ productId: GONE, change: ListingAction.Archive });

    expect(idsOf(queryClient.getQueryData(productKeys.feed(feedParams)))).toEqual([
      ['keep'],
      ['later'],
    ]);
    expect(idsOf(queryClient.getQueryData(productKeys.feed(otherFeedParams)))).toEqual([[]]);
    expect(idsOf(queryClient.getQueryData(reelKeys.all()))).toEqual([['keep'], []]);
    expect(queryClient.getQueryState(productKeys.feed(feedParams))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(reelKeys.all())?.isInvalidated).toBe(false);
    expect(
      queryClient.getQueryData<{ pageParams: unknown[] }>(productKeys.feed(feedParams))?.pageParams,
    ).toEqual([undefined, 'cursor-0']);
  });

  it('refetches the feed and reels when a listing is shown again', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { data: detail('PUBLISHED') } });
    const { result, queryClient } = renderStatus();

    await result.current.mutateAsync({ productId: GONE, change: ListingAction.Unarchive });

    await waitFor(() => {
      expect(queryClient.getQueryState(productKeys.feed(feedParams))?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(productKeys.feed(otherFeedParams))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(reelKeys.all())?.isInvalidated).toBe(true);
    expect(idsOf(queryClient.getQueryData(reelKeys.all()))).toEqual([['keep'], [GONE]]);
  });
});
