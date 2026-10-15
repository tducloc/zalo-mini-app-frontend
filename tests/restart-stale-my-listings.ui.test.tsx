import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { invalidateMyListings, useMyListings } from '@/features/my-listings/api/get-my-listings';
import { myListingKeys } from '@/features/my-listings/api/keys';
import type {
  MyListing,
  MyListingsPage,
  MyListingsTab,
} from '@/features/my-listings/types/my-listing';
import { http } from '@/lib/http';
import { createQueryClient } from '@/lib/query-client';

vi.mock('@/lib/http', () => ({ http: { get: vi.fn() } }));

const VIEWER_ID = 'user_1';
const LOADED_PAGES = 3;
// Listings go stale after a minute.
const JUST_STALE_MS = 61_000;
const JUST_FRESH_MS = 59_000;

function cursorOf(config: { params?: unknown } | undefined) {
  const params = config?.params;
  const hasCursor =
    typeof params === 'object' && params !== null && 'cursor' in params && !!params.cursor;
  return hasCursor ? String(params.cursor) : undefined;
}

function answerWith(label: string) {
  vi.mocked(http.get).mockImplementation(async (_url, config) => {
    const cursor = cursorOf(config);
    const pageNumber = cursor ? Number(cursor.replace('c', '')) : 1;
    const page: MyListingsPage = {
      data: [{ id: `${label}-${pageNumber}` } as MyListing],
      meta: {
        nextCursor: `c${pageNumber + 1}`,
        hasNextPage: true,
        counts: {} as MyListingsPage['meta']['counts'],
      },
    };
    return { data: page };
  });
}

const idsOf = (queryClient: QueryClient, tab: MyListingsTab) =>
  queryClient
    .getQueryData<{ pages: MyListingsPage[] }>(myListingKeys.list(tab, VIEWER_ID))
    ?.pages.map((page) => page.data[0].id);

function ageList(queryClient: QueryClient, tab: MyListingsTab, ageMs: number) {
  queryClient.setQueryData(myListingKeys.list(tab, VIEWER_ID), (data: unknown) => data, {
    updatedAt: Date.now() - ageMs,
  });
}

function setUp() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const mountPage = (tab: MyListingsTab) =>
    renderHook(({ activeTab }) => useMyListings(activeTab, VIEWER_ID), {
      wrapper,
      initialProps: { activeTab: tab },
    });

  return { queryClient, mountPage };
}

/** A tab the seller scrolled through three pages of, loaded by the page itself. */
async function scrollThrough(
  { queryClient, mountPage }: ReturnType<typeof setUp>,
  tab: MyListingsTab,
  ageMs: number,
) {
  answerWith('old');
  const { result, unmount } = mountPage(tab);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  for (let page = 1; page < LOADED_PAGES; page += 1) {
    await act(() => result.current.fetchNextPage());
  }
  unmount();

  answerWith('new');
  vi.mocked(http.get).mockClear();
  ageList(queryClient, tab, ageMs);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('My listings freshness', () => {
  afterEach(() => vi.clearAllMocks());

  it('loads page one alone when the page opens on a stale list', async () => {
    const setup = setUp();
    await scrollThrough(setup, 'published', JUST_STALE_MS);

    setup.mountPage('published');

    await waitFor(() => expect(idsOf(setup.queryClient, 'published')).toEqual(['new-1']));
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(vi.mocked(http.get).mock.calls[0][1]).toMatchObject({
      params: { limit: 20, cursor: undefined },
    });
  });

  it('shows a fresh list without a request', async () => {
    const setup = setUp();
    await scrollThrough(setup, 'published', JUST_FRESH_MS);

    setup.mountPage('published');
    await act(settle);

    expect(http.get).not.toHaveBeenCalled();
    expect(idsOf(setup.queryClient, 'published')).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('does not reload a list that turns stale while the seller is on the page', async () => {
    const setup = setUp();
    await scrollThrough(setup, 'published', JUST_FRESH_MS);
    setup.mountPage('published');

    ageList(setup.queryClient, 'published', JUST_STALE_MS);
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await settle();
    });

    expect(http.get).not.toHaveBeenCalled();
    expect(idsOf(setup.queryClient, 'published')).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('loads page one alone when the tab changes to a stale cached list', async () => {
    const setup = setUp();
    await scrollThrough(setup, 'archived', JUST_STALE_MS);
    const { rerender } = setup.mountPage('published');
    await waitFor(() => expect(idsOf(setup.queryClient, 'published')).toEqual(['new-1']));
    vi.mocked(http.get).mockClear();

    rerender({ activeTab: 'archived' });

    await waitFor(() => expect(idsOf(setup.queryClient, 'archived')).toEqual(['new-1']));
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('loads page one alone after an owner action, and drops the pages of the other lists', async () => {
    const setup = setUp();
    await scrollThrough(setup, 'archived', JUST_FRESH_MS);
    await scrollThrough(setup, 'published', JUST_FRESH_MS);
    setup.mountPage('published');

    await act(() => invalidateMyListings(setup.queryClient));

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(idsOf(setup.queryClient, 'published')).toEqual(['new-1']);
    expect(idsOf(setup.queryClient, 'archived')).toEqual(['old-1']);
    expect(
      setup.queryClient.getQueryState(myListingKeys.list('archived', VIEWER_ID))?.isInvalidated,
    ).toBe(true);
  });

  it('starts a list an owner action marked from page one on the next visit', async () => {
    const setup = setUp();
    await scrollThrough(setup, 'published', JUST_FRESH_MS);
    await act(() => invalidateMyListings(setup.queryClient));
    expect(http.get).not.toHaveBeenCalled();

    setup.mountPage('published');

    await waitFor(() => expect(idsOf(setup.queryClient, 'published')).toEqual(['new-1']));
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
