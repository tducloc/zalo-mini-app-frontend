import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ListingCard from '@/features/feed/components/grid/listing-card';
import MyListingCard from '@/features/my-listings/components/list/my-listing-card';
import type { MyListing } from '@/features/my-listings/types/my-listing';
import type { ProductCard } from '@/features/products/types/product';

vi.mock('zmp-ui', () => ({ Icon: () => null }));

const THUMBNAIL_URL = 'https://example.com/thumb.webp';

const product: ProductCard = {
  id: 'prd_1',
  title: 'Xe đạp',
  price: 1_200_000,
  condition: 'USED',
  category: { id: 'cat_bike', name: 'Xe', slug: 'bike' },
  thumbnailUrl: THUMBNAIL_URL,
  placeholder: '1QcSHQRnh493V4dIh4eXh1h4kJUI',
  previewUrl: 'https://example.com/preview.mp4',
  hasVideo: true,
  location: { id: null, name: 'Quận 1' },
  publishedAt: '2026-09-28T00:00:00.000Z',
};

const myListing: MyListing = {
  id: 'prd_1',
  title: 'Xe đạp',
  price: 1_200_000,
  status: 'PUBLISHED',
  thumbnailUrl: THUMBNAIL_URL,
  hasVideo: false,
  failedMedia: [],
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
  publishedAt: '2026-09-28T00:00:00.000Z',
  soldAt: null,
  archivedAt: null,
};

function renderFeedCard(isPreviewActive: boolean) {
  return render(
    <ListingCard
      isAboveFold
      isPreviewActive={isPreviewActive}
      product={product}
      onOpen={() => {}}
      onPreviewFinished={() => {}}
      onPreviewRefused={() => {}}
    />,
  );
}

describe('card thumbnails show the whole photo in their square box', () => {
  afterEach(async () => {
    cleanup();
    // The pool parks the released element one microtask later.
    await Promise.resolve();
    vi.restoreAllMocks();
  });

  it('in the feed, over the blurred placeholder that fills the bars', () => {
    const { container } = renderFeedCard(false);

    const cover = container.querySelector(`img[src="${THUMBNAIL_URL}"]`);
    const placeholder = container.querySelector('img[src^="data:image/png"]');
    expect(cover?.classList).toContain('object-contain');
    expect(cover?.classList).not.toContain('object-cover');
    expect(placeholder?.classList).toContain('object-cover');
  });

  it('in the feed preview clip', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      () => new Promise<void>(() => {}),
    );
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const { container } = renderFeedCard(true);

    const video = container.querySelector('video');
    expect(video?.classList).toContain('object-contain');
    expect(video?.classList).not.toContain('object-cover');
  });

  it('in My listings', () => {
    const { container } = render(
      <MyListingCard
        listing={myListing}
        onAction={() => {}}
        onOpen={() => {}}
        onOpenActions={() => {}}
      />,
    );

    const cover = container.querySelector(`img[src="${THUMBNAIL_URL}"]`);
    expect(cover?.classList).toContain('object-contain');
    expect(cover?.classList).not.toContain('object-cover');
  });
});
