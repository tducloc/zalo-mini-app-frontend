import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import ProductActionsSheet from '@/features/products/components/detail/actions-sheet';
import ProductDescription from '@/features/products/components/detail/description';
import MediaLightbox from '@/features/products/components/gallery/media-lightbox';
import ProductMediaGallery from '@/features/products/components/gallery/media-gallery';
import { ProductDetail } from '@/features/products/types/product';
import { videoPool } from '@/lib/video-pool';
import { useDetailSoundStore } from '@/stores/detail-sound';

vi.mock('zmp-sdk', () => ({ openShareSheet: vi.fn() }));

vi.mock('zmp-ui', () => ({
  Icon: () => null,
  Sheet: ({ children, visible }: { children: ReactNode; visible: boolean }) =>
    visible ? <section>{children}</section> : null,
}));

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

const SLIDE_WIDTH_PX = 375;
const VIDEO_URL = 'https://example.com/video.mp4';

let observerCallbacks = new Set<IntersectionObserverCallback>();
let parking: HTMLElement;

function showVideoOnScreen(ratio: number) {
  act(() =>
    observerCallbacks.forEach((callback) =>
      callback(
        [{ intersectionRatio: ratio } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    ),
  );
}

function scrollToSlide(track: HTMLElement, index: number) {
  track.scrollLeft = index * SLIDE_WIDTH_PX;
  fireEvent.scroll(track);
}

/** The pool drops the source and parks the element one microtask after a release. */
const settleRelease = () => act(async () => {});

const galleryVideo = (track: HTMLElement) => track.querySelector('video');

function renderGallery() {
  const view = render(
    <ProductMediaGallery media={product.media} productTitle={product.title} canLoadMedia />,
  );
  const track = view.container.querySelector<HTMLElement>('[data-gallery-track]');
  if (!track) {
    throw new Error('gallery track missing');
  }
  return { ...view, track };
}

function renderPlayingVideo() {
  const view = renderGallery();
  scrollToSlide(view.track, 1);
  showVideoOnScreen(1);
  const video = galleryVideo(view.track);
  if (!video) {
    throw new Error('the video slide holds no video');
  }
  return { ...view, video };
}

beforeEach(() => {
  observerCallbacks = new Set();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe() {
        observerCallbacks.add(this.callback);
      }
      disconnect() {
        observerCallbacks.delete(this.callback);
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(SLIDE_WIDTH_PX);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  parking = document.createElement('div');
  videoPool.setParking(parking);
  useDetailSoundStore.setState({ isMuted: false });
});

afterEach(async () => {
  // Unmount first: the gallery gives its video back to the pool, through the mocked pause.
  cleanup();
  await settleRelease();
  videoPool.setParking(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('product detail UI', () => {
  it('counts the slide the gallery is scrolled to', () => {
    const { track } = renderGallery();

    expect(screen.getByText('1 / 2')).toBeTruthy();
    scrollToSlide(track, 1);
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('plays the video with sound, without controls, only while its slide is shown on screen', async () => {
    const { track } = renderGallery();
    const play = vi.mocked(HTMLMediaElement.prototype.play);

    scrollToSlide(track, 1);
    expect(galleryVideo(track)).toBeNull();

    showVideoOnScreen(1);
    const video = galleryVideo(track);
    expect(video?.getAttribute('src')).toBe(VIDEO_URL);
    expect(video?.muted).toBe(false);
    expect(video?.controls).toBe(false);
    expect(play).toHaveBeenCalledOnce();

    // Reels slid its detail pane away, or the page scrolled past the gallery.
    showVideoOnScreen(0.2);
    await settleRelease();
    expect(galleryVideo(track)).toBeNull();
    expect(video?.hasAttribute('src')).toBe(false);

    showVideoOnScreen(1);
    expect(galleryVideo(track)).toBe(video);
    expect(play).toHaveBeenCalledTimes(2);

    scrollToSlide(track, 0);
    await settleRelease();
    expect(galleryVideo(track)).toBeNull();
  });

  it('gives the video back while the app is in the background', async () => {
    const { track } = renderPlayingVideo();

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    await settleRelease();
    expect(galleryVideo(track)).toBeNull();
  });

  it('plays muted when the WebView refuses sound before a tap', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('', 'NotAllowedError'),
    );
    const { video } = renderPlayingVideo();
    await act(async () => {});

    expect(video.muted).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Bật âm thanh' })).toBeTruthy();
  });

  it('turns the sound off and on from its button, without opening the lightbox', () => {
    const { video } = renderPlayingVideo();

    fireEvent.click(screen.getByRole('button', { name: 'Tắt âm thanh' }));
    expect(video.muted).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Bật âm thanh' }));
    expect(video.muted).toBe(false);
    // Played again within the tap, so WebKit keeps the sound on.
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("keeps the viewer's sound choice for the next video", async () => {
    const first = renderPlayingVideo();
    fireEvent.click(screen.getByRole('button', { name: 'Tắt âm thanh' }));
    first.unmount();
    await settleRelease();

    const { video } = renderPlayingVideo();
    expect(video.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Bật âm thanh' })).toBeTruthy();
  });

  it('goes back to muted when the WebView refuses sound from the button', async () => {
    useDetailSoundStore.setState({ isMuted: true });
    const { video } = renderPlayingVideo();
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('', 'NotAllowedError'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bật âm thanh' }));
    await act(async () => {});
    expect(video.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Bật âm thanh' })).toBeTruthy();
  });

  it('opens the tapped video full screen and stops it in the gallery', async () => {
    const { track } = renderPlayingVideo();

    fireEvent.click(screen.getByRole('button', { name: 'Xem video toàn màn hình' }));
    const lightbox = screen.getByRole('dialog', { name: `Ảnh và video: ${product.title}` });
    expect(lightbox.textContent).toContain('2 / 2');
    await settleRelease();
    expect(galleryVideo(track)).toBeNull();

    showVideoOnScreen(1);
    expect(galleryVideo(track)).toBeNull();
  });

  it('opens every photo and video full screen, counted as the gallery counts them', () => {
    renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh' }));
    const lightbox = screen.getByRole('dialog', { name: `Ảnh và video: ${product.title}` });
    expect(lightbox.textContent).toContain('1 / 2');
    expect(lightbox.querySelectorAll('img')).toHaveLength(1);
    expect(lightbox.querySelectorAll('video')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns the gallery to the slide the lightbox closes on', () => {
    const { track } = renderGallery();

    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh' }));
    const lightboxTrack = screen.getByRole('dialog').querySelector<HTMLElement>('.snap-x');
    if (!lightboxTrack) {
      throw new Error('lightbox track missing');
    }
    scrollToSlide(lightboxTrack, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));

    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(track.scrollLeft).toBe(SLIDE_WIDTH_PX);
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
