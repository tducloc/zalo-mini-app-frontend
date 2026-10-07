import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ListingCard from '@/features/feed/components/grid/listing-card';
import type { ProductCard } from '@/features/products/types/product';

vi.mock('zmp-ui', () => ({ Icon: () => null }));

const THUMBNAIL_URL = 'https://example.com/thumb.webp';
const PLACEHOLDER_SELECTOR = 'img[src^="data:image/png"]';

const product: ProductCard = {
  id: 'prd_1',
  title: 'Xe đạp',
  price: 1_200_000,
  condition: 'USED',
  category: { id: 'cat_bike', name: 'Xe', slug: 'bike' },
  thumbnailUrl: THUMBNAIL_URL,
  placeholder: '1QcSHQRnh493V4dIh4eXh1h4kJUI',
  previewUrl: null,
  hasVideo: false,
  location: { id: null, name: 'Quận 1' },
  publishedAt: '2026-09-28T00:00:00.000Z',
};

function renderCard(card: ProductCard) {
  return render(
    <ListingCard
      isAboveFold
      isPreviewActive={false}
      product={card}
      onOpen={() => {}}
      onPreviewFinished={() => {}}
      onPreviewRefused={() => {}}
    />,
  );
}

describe('feed card placeholder', () => {
  afterEach(() => cleanup());

  it('shows while the photo loads and is dropped once it has loaded', () => {
    const { container } = renderCard(product);
    expect(container.querySelector(PLACEHOLDER_SELECTOR)).not.toBeNull();

    fireEvent.load(container.querySelector(`img[src="${THUMBNAIL_URL}"]`) as HTMLImageElement);

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).toBeNull();
  });

  it('comes back for a new photo until that one loads', () => {
    const { container, rerender } = renderCard(product);
    fireEvent.load(container.querySelector(`img[src="${THUMBNAIL_URL}"]`) as HTMLImageElement);

    const nextUrl = 'https://example.com/thumb-2.webp';
    rerender(
      <ListingCard
        isAboveFold
        isPreviewActive={false}
        product={{ ...product, thumbnailUrl: nextUrl }}
        onOpen={() => {}}
        onPreviewFinished={() => {}}
        onPreviewRefused={() => {}}
      />,
    );

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).not.toBeNull();
  });
});
