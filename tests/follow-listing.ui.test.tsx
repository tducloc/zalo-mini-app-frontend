import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';

import { useMyListings } from '@/features/my-listings/api/get-my-listings';
import { useFollowListing } from '@/features/my-listings/hooks/use-follow-listing';
import type { MyListing, MyListingsPage } from '@/features/my-listings/types/my-listing';
import type { ProductStatus } from '@/features/products/types/product';
import { http } from '@/lib/http';
import { useMyListingsStore } from '@/stores/my-listings';

vi.mock('@/lib/http', () => ({ http: { get: vi.fn() } }));

const VIEWER_ID = 'user_1';
const LISTING_ID = 'prd_1';

/** The server as the page finds it; a test changes it between requests. */
interface Server {
  /** The listing's status: its detail, and the list it is on. */
  status: ProductStatus;
  /** How many of the next requests fail, for the lists and for the detail. */
  failingLists: number;
  failingDetails: number;
  /** The listing was deleted: its detail answers 404. */
  isGone: boolean;
}

let server: Server;

function answer(url: string, config?: { params?: unknown }) {
  if (url === '/me/products') {
    if (server.failingLists > 0) {
      server.failingLists -= 1;
      throw new Error('network');
    }
    const { status: listed } = config?.params as { status: ProductStatus };
    const page: MyListingsPage = {
      data: listed === server.status ? [{ id: LISTING_ID, status: listed } as MyListing] : [],
      meta: {
        nextCursor: null,
        hasNextPage: false,
        counts: { PROCESSING: 0, FAILED: 0, PUBLISHED: 0, SOLD: 0, ARCHIVED: 0 },
      },
    };
    return { data: page };
  }
  if (server.isGone) {
    const headers = new AxiosHeaders();
    throw new AxiosError('Not found', 'ERR_BAD_REQUEST', { headers }, null, {
      status: 404,
      statusText: '',
      headers,
      config: { headers },
      data: { error: { code: 'NOT_FOUND', message: 'Product not found' } },
    });
  }
  if (server.failingDetails > 0) {
    server.failingDetails -= 1;
    throw new Error('network');
  }
  return { data: { data: { id: LISTING_ID, status: server.status } } };
}

function renderMyListings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => {
      const tab = useMyListingsStore((state) => state.tab);
      const query = useMyListings(tab, VIEWER_ID);
      useFollowListing(query, VIEWER_ID);
      return query;
    },
    { wrapper },
  );
}

const detailRequests = () =>
  vi.mocked(http.get).mock.calls.filter(([url]) => url === `/products/${LISTING_ID}`);

beforeEach(() => {
  server = { status: 'PROCESSING', failingLists: 0, failingDetails: 0, isGone: false };
  vi.mocked(http.get).mockImplementation(async (url, config) => answer(url, config));
  useMyListingsStore.setState({ tab: 'published', followedId: null });
  // Saved with a new photo: PROCESSING.
  useMyListingsStore.getState().follow(LISTING_ID, 'PROCESSING');
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useFollowListing', () => {
  it('opens the tab the listing is on now when its list comes back without it', async () => {
    // The worker published it before the list loaded.
    server.status = 'PUBLISHED';

    renderMyListings();

    await waitFor(() => expect(useMyListingsStore.getState().tab).toBe('published'));
    expect(useMyListingsStore.getState().followedId).toBeNull();
  });

  it('stays on the tab while its list shows the listing', async () => {
    const { result } = renderMyListings();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useMyListingsStore.getState()).toMatchObject({
      tab: 'processing',
      followedId: LISTING_ID,
    });
    expect(detailRequests()).toHaveLength(0);
  });

  it('takes a list that failed to load for no answer, and keeps following', async () => {
    server.failingLists = 1;

    const { result } = renderMyListings();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(detailRequests()).toHaveLength(0);
    expect(useMyListingsStore.getState().followedId).toBe(LISTING_ID);

    // Loaded again once the worker has published it: the page still follows it there.
    server.status = 'PUBLISHED';
    await result.current.refetch();

    await waitFor(() => expect(useMyListingsStore.getState().tab).toBe('published'));
  });

  it('asks for the listing again after that request fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.status = 'PUBLISHED';
    server.failingDetails = 1;

    renderMyListings();

    await waitFor(() => expect(detailRequests()).toHaveLength(1));
    expect(useMyListingsStore.getState().tab).toBe('processing');

    // Nothing else refetches the empty list; the lookup retries on its own.
    await vi.advanceTimersByTimeAsync(5_000);

    await waitFor(() => expect(useMyListingsStore.getState().tab).toBe('published'));
    expect(detailRequests()).toHaveLength(2);
  });

  it('stops following a listing that no longer exists', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.status = 'PUBLISHED';
    server.isGone = true;

    renderMyListings();

    await waitFor(() => expect(useMyListingsStore.getState().followedId).toBeNull());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(detailRequests()).toHaveLength(1);
    expect(useMyListingsStore.getState().tab).toBe('processing');
  });

  it('leaves the tab alone when the seller moves a published listing on', async () => {
    // Posted and published at once (201): nothing will move it on its own.
    server.status = 'PUBLISHED';
    useMyListingsStore.getState().follow(LISTING_ID, 'PUBLISHED');
    const { result } = renderMyListings();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // "Đánh dấu đã bán": the card leaves "Đang hiển thị".
    server.status = 'SOLD';
    await act(() => result.current.refetch());
    // Time for a lookup to answer, had the page asked.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(useMyListingsStore.getState().tab).toBe('published');
    expect(detailRequests()).toHaveLength(0);
  });
});
