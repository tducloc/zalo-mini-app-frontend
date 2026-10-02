import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { ProductDetail } from '@/features/products/types/product';
import { http } from '@/lib/http';
import ProductDetailPage from '@/pages/product-detail';

vi.mock('@/lib/http', () => ({ http: { get: vi.fn() } }));

vi.mock('zmp-sdk', () => ({
  openChat: vi.fn(),
  openPhone: vi.fn(),
  openProfile: vi.fn(),
  openShareSheet: vi.fn(),
}));

vi.mock('zmp-ui', () => {
  const Swiper = Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Slide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  });

  return {
    Button: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
    Header: () => null,
    Icon: () => null,
    Modal: () => null,
    Page: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Sheet: () => null,
    Swiper,
    useLocation: () => ({ pathname: '/reels' }),
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSnackbar: () => ({ openSnackbar: vi.fn(), closeSnackbar: vi.fn() }),
  };
});

const product = {
  id: 'prd_1',
  title: 'Cây cảnh để bàn',
  description: 'Mô tả sản phẩm.',
  price: 250_000,
  condition: 'NEW',
  status: 'PUBLISHED',
  location: { id: null, name: 'Quận 3, Hồ Chí Minh' },
  category: { id: 'cat_home', name: 'Nhà cửa', slug: 'home' },
  media: [
    {
      id: 'media_cover',
      role: 'MAIN',
      type: 'IMAGE',
      thumbnailUrl: 'https://example.com/cover-thumb.webp',
      mediumUrl: 'https://example.com/cover.webp',
      durationMs: null,
      sortOrder: 0,
    },
    {
      id: 'media_video',
      role: 'GALLERY',
      type: 'VIDEO',
      thumbnailUrl: 'https://example.com/poster.webp',
      mediumUrl: 'https://example.com/video.mp4',
      durationMs: 5_000,
      sortOrder: 1,
    },
  ],
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

function renderEmbeddedDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const detail = (canLoadMedia: boolean) => (
    <QueryClientProvider client={queryClient}>
      <ProductDetailPage
        mode="embedded"
        productId={product.id}
        canLoadMedia={canLoadMedia}
        onBack={vi.fn()}
      />
    </QueryClientProvider>
  );
  const view = render(detail(false));
  return { ...view, allowMedia: () => view.rerender(detail(true)) };
}

const mediaUrls = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('img[src], video[src], video[poster]')).flatMap((element) =>
    ['src', 'poster'].flatMap((name) => element.getAttribute(name) ?? []),
  );

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.mocked(http.get).mockResolvedValue({ data: { data: product } });
});

describe('embedded product detail in reels', () => {
  it('shows the fetched text but requests no gallery media until the viewer heads for it', async () => {
    const { container, allowMedia } = renderEmbeddedDetail();

    expect(await screen.findByRole('heading', { level: 1, name: product.title })).toBeTruthy();
    expect(screen.getByText(/250\.000/)).toBeTruthy();
    expect(mediaUrls(container)).toEqual([]);

    allowMedia();

    expect(mediaUrls(container)).toEqual([
      'https://example.com/cover.webp',
      'https://example.com/poster.webp',
    ]);
  });
});
