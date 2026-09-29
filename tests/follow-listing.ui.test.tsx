import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
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

/** The server as the page finds it: its lists by status, and the listing's detail. */
function serve(lists: Partial<Record<ProductStatus, string[]>>, status: ProductStatus) {
  vi.mocked(http.get).mockImplementation(async (url, config) => {
    if (url === '/me/products') {
      const { status: listed } = config?.params as { status: ProductStatus };
      const page: MyListingsPage = {
        data: (lists[listed] ?? []).map((id) => ({ id, status: listed }) as MyListing),
        meta: {
          nextCursor: null,
          hasNextPage: false,
          counts: { PROCESSING: 0, FAILED: 0, PUBLISHED: 0, SOLD: 0, ARCHIVED: 0 },
        },
      };
      return { data: page };
    }
    return { data: { data: { id: LISTING_ID, status } } };
  });
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
  useMyListingsStore.setState({ tab: 'published', followedId: null });
});

afterEach(() => vi.clearAllMocks());

describe('useFollowListing', () => {
  it('opens the tab the listing is on now when its list comes back without it', async () => {
    // Saved with a new photo (PROCESSING); the worker published it before the list loaded.
    serve({ PUBLISHED: [LISTING_ID] }, 'PUBLISHED');
    useMyListingsStore.getState().follow(LISTING_ID, 'PROCESSING');

    renderMyListings();

    await waitFor(() => expect(useMyListingsStore.getState().tab).toBe('published'));
    expect(useMyListingsStore.getState().followedId).toBeNull();
  });

  it('stays on the tab while its list shows the listing', async () => {
    serve({ PROCESSING: [LISTING_ID] }, 'PROCESSING');
    useMyListingsStore.getState().follow(LISTING_ID, 'PROCESSING');

    const { result } = renderMyListings();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(useMyListingsStore.getState()).toMatchObject({
      tab: 'processing',
      followedId: LISTING_ID,
    });
    expect(detailRequests()).toHaveLength(0);
  });
});
