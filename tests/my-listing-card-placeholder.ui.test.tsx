import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MyListingCard from '@/features/my-listings/components/list/my-listing-card';
import type { MyListing } from '@/features/my-listings/types/my-listing';

vi.mock('zmp-ui', () => ({ Icon: () => null }));

const THUMBNAIL_URL = 'https://example.com/thumb.webp';
const PLACEHOLDER_SELECTOR = 'img[src^="data:image/png"]';

const listing: MyListing = {
  id: 'prd_1',
  title: 'iPhone 13',
  price: 6_990_000,
  status: 'PUBLISHED',
  thumbnailUrl: THUMBNAIL_URL,
  placeholder: '1QcSHQRnh493V4dIh4eXh1h4kJUI',
  hasVideo: false,
  failedMedia: [],
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
  publishedAt: '2026-09-27T00:00:00.000Z',
  soldAt: null,
  archivedAt: null,
};

function renderCard(card: MyListing) {
  return render(
    <MyListingCard listing={card} onAction={() => {}} onOpen={() => {}} onOpenActions={() => {}} />,
  );
}

describe('my listing card placeholder', () => {
  afterEach(() => cleanup());

  it('shows while the photo loads and is dropped once it has loaded', () => {
    const { container } = renderCard(listing);
    expect(container.querySelector(PLACEHOLDER_SELECTOR)).not.toBeNull();

    fireEvent.load(container.querySelector(`img[src="${THUMBNAIL_URL}"]`) as HTMLImageElement);

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).toBeNull();
  });

  it('is not shown without a thumbnail', () => {
    const { container } = renderCard({ ...listing, thumbnailUrl: null });

    expect(container.querySelector('img')).toBeNull();
  });
});
