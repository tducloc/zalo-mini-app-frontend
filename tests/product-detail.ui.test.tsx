import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import ProductActionsSheet from '@/features/products/components/detail/actions-sheet';
import ProductDescription from '@/features/products/components/detail/description';
import MediaLightbox from '@/features/products/components/gallery/media-lightbox';
import ProductMediaGallery from '@/features/products/components/gallery/media-gallery';
import { ProductDetail } from '@/features/products/types/product';

vi.mock('zmp-sdk', () => ({ openShareSheet: vi.fn() }));

vi.mock('zmp-ui', () => {
  const Swiper = Object.assign(
    ({ afterChange, children }: { afterChange?: (index: number) => void; children: ReactNode }) => (
      <div data-testid="swiper">
        {children}
        <button onClick={() => afterChange?.(1)}>Slide tiếp theo</button>
      </div>
    ),
    { Slide: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  );

  return {
    Icon: () => null,
    Sheet: ({ children, visible }: { children: ReactNode; visible: boolean }) =>
      visible ? <section>{children}</section> : null,
    Swiper,
  };
});

const product: ProductDetail = {
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
      id: 'media_image',
      role: 'MAIN',
      type: 'IMAGE',
      thumbnailUrl: 'https://example.com/image-thumb.webp',
      mediumUrl: 'https://example.com/image.webp',
      durationMs: null,
      sortOrder: 0,
    },
    {
      id: 'media_video',
      role: 'GALLERY',
      type: 'VIDEO',
      thumbnailUrl: null,
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
};

afterEach(() => vi.restoreAllMocks());

describe('product detail UI', () => {
  it('shows and updates the gallery position chip for image and video media', () => {
    render(<ProductMediaGallery media={product.media} productTitle={product.title} />);

    expect(screen.getByText('1 / 2')).toBeTruthy();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Slide tiếp theo' }));
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('opens every photo and video full screen, counted as the gallery counts them', () => {
    render(<ProductMediaGallery media={product.media} productTitle={product.title} />);

    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh' }));
    const lightbox = screen.getByRole('dialog', { name: `Ảnh và video: ${product.title}` });
    expect(lightbox.textContent).toContain('1 / 2');
    expect(lightbox.querySelectorAll('img')).toHaveLength(1);
    expect(lightbox.querySelectorAll('video')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hands the slide it closes on back to the gallery', () => {
    const onClose = vi.fn();
    render(
      <MediaLightbox media={product.media} startIndex={1} productTitle="x" onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledWith(1);
  });

  it('shows a disabled reported state instead of allowing a duplicate report', () => {
    const onClose = vi.fn();
    const onReport = vi.fn();

    render(
      <ProductActionsSheet
        hasReported
        isReportAvailable
        isOwner={false}
        product={product}
        visible
        isOwnerActionPending={false}
        onClose={onClose}
        onError={vi.fn()}
        onOwnerAction={vi.fn()}
        onReport={onReport}
      />,
    );

    const reportButton = screen.getByRole('button', { name: 'Bạn đã báo cáo tin này' });
    expect((reportButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(reportButton);
    expect(onClose).not.toHaveBeenCalled();
    expect(onReport).not.toHaveBeenCalled();
  });

  it('opens the report flow for a listing that has not been reported', () => {
    const onClose = vi.fn();
    const onReport = vi.fn();

    render(
      <ProductActionsSheet
        hasReported={false}
        isReportAvailable
        isOwner={false}
        product={product}
        visible
        isOwnerActionPending={false}
        onClose={onClose}
        onError={vi.fn()}
        onOwnerAction={vi.fn()}
        onReport={onReport}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo tin đăng' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onReport).toHaveBeenCalledOnce();
  });

  it('collapses a long description and lets the user expand it', () => {
    render(<ProductDescription description={'Nội dung '.repeat(30)} />);

    expect(screen.getByRole('button', { name: 'Xem thêm' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(screen.getByRole('button', { name: 'Thu gọn' })).toBeTruthy();
  });
});

it('disables reporting until the viewer-specific detail has loaded', () => {
  render(
    <ProductActionsSheet
      product={product}
      visible
      isOwner={false}
      hasReported={false}
      isReportAvailable={false}
      isOwnerActionPending={false}
      onClose={vi.fn()}
      onReport={vi.fn()}
      onOwnerAction={vi.fn()}
      onError={vi.fn()}
    />,
  );

  const reportButton = screen.getByRole('button', { name: 'Báo cáo tin đăng' });
  expect((reportButton as HTMLButtonElement).disabled).toBe(true);
});

it("gives the owner the listing's status actions instead of reporting", () => {
  const onClose = vi.fn();
  const onOwnerAction = vi.fn();

  render(
    <ProductActionsSheet
      product={{ ...product, viewer: { isOwner: true, hasReported: false } }}
      visible
      isOwner
      hasReported={false}
      isReportAvailable
      isOwnerActionPending={false}
      onClose={onClose}
      onReport={vi.fn()}
      onOwnerAction={onOwnerAction}
      onError={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Sửa tin' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ẩn tin' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Báo cáo tin đăng' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã bán' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onOwnerAction).toHaveBeenCalledWith('MARK_SOLD');
});
