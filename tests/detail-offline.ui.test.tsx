import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { ProductDetail } from '@/features/products/types/product';
import { http } from '@/lib/http';
import { createQueryClient } from '@/lib/query-client';
import ProductDetailPage from '@/pages/product-detail';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/lib/http', () => ({ http: { get: vi.fn() } }));

vi.mock('zmp-sdk', () => ({
  openChat: vi.fn(),
  openPhone: vi.fn(),
  openProfile: vi.fn(),
  openShareSheet: vi.fn(),
}));

vi.mock('zmp-ui', () => ({
  Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  Header: () => null,
  Icon: () => null,
  Modal: () => null,
  Page: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Sheet: () => null,
  useLocation: () => ({ pathname: '/products/prd_1' }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ productId: 'prd_1' }),
  useSnackbar: () => ({ openSnackbar: vi.fn(), closeSnackbar: vi.fn() }),
}));

const RETRY_WAIT_MS = 3_000;

const product = {
  id: 'prd_1',
  title: 'Tai nghe JBL Tune 510BT',
  description: 'Còn mới.',
  price: 1_500_000,
  condition: 'LIKE_NEW',
  status: 'PUBLISHED',
  location: { id: 'loc_hanoi', name: 'Hà Nội' },
  category: { id: 'cat_electronics', name: 'Điện tử', slug: 'electronics' },
  media: [],
  seller: {
    id: 'seller_1',
    name: 'Quang Minh',
    avatarUrl: null,
    contact: { zaloProfileId: 'zalo_seller', phoneNumber: null },
  },
  viewer: { isOwner: false, hasReported: false },
  createdAt: '2026-09-21T00:00:00.000Z',
  publishedAt: '2026-09-21T00:00:00.000Z',
} satisfies ProductDetail;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  onlineManager.setOnline(true);
});

it('shows the load error while offline, then the listing once the network is back', async () => {
  // Signed in earlier; the network dropped afterwards.
  useAuthStore.setState({ isBootstrapping: false });
  onlineManager.setOnline(false);
  vi.mocked(http.get).mockRejectedValue(new Error('Network Error'));

  render(
    <QueryClientProvider client={createQueryClient()}>
      <ProductDetailPage />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByText('Không tải được tin', undefined, { timeout: RETRY_WAIT_MS }),
  ).toBeTruthy();

  vi.mocked(http.get).mockResolvedValue({ data: { data: product } });
  act(() => onlineManager.setOnline(true));

  expect(await screen.findByRole('heading', { level: 1, name: product.title })).toBeTruthy();
});
