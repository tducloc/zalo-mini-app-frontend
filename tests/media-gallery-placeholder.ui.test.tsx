import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ProductMediaGallery from '@/features/products/components/gallery/media-gallery';
import type { ProductDetail } from '@/features/products/types/product';

type Media = ProductDetail['media'][number];

const PLACEHOLDER = '1QcSHQRnh493V4dIh4eXh1h4kJUI';
const PLACEHOLDER_SELECTOR = 'img[src^="data:image/png"]';

function photo(id: string, placeholder: string | null): Media {
  return {
    id,
    role: id === 'cover' ? 'MAIN' : 'GALLERY',
    type: 'IMAGE',
    thumbnailUrl: `https://example.com/${id}-thumb.webp`,
    mediumUrl: `https://example.com/${id}.jpg`,
    placeholder,
    durationMs: null,
    sortOrder: 0,
  };
}

const video: Media = {
  id: 'video',
  role: 'GALLERY',
  type: 'VIDEO',
  thumbnailUrl: 'https://example.com/poster.jpg',
  mediumUrl: 'https://example.com/video.mp4',
  placeholder: PLACEHOLDER,
  durationMs: 5_000,
  sortOrder: 1,
};

function renderGallery(media: Media[]) {
  return render(<ProductMediaGallery media={media} productTitle="Xe đạp" canLoadMedia />);
}

const blurIn = (slide: Element | null) => slide?.querySelector(PLACEHOLDER_SELECTOR) ?? null;

describe('detail gallery placeholder', () => {
  afterEach(() => cleanup());

  it('blurs a photo until it has loaded', () => {
    const { container } = renderGallery([photo('cover', PLACEHOLDER)]);
    const image = container.querySelector('img[src="https://example.com/cover.jpg"]');
    expect(blurIn(image?.parentElement ?? null)).not.toBeNull();

    fireEvent.load(image as HTMLImageElement);

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).toBeNull();
  });

  it('blurs a video poster until it has loaded', () => {
    const { container } = renderGallery([photo('cover', null), video]);
    const poster = container.querySelector('img[src="https://example.com/poster.jpg"]');
    expect(blurIn(poster?.parentElement ?? null)).not.toBeNull();

    fireEvent.load(poster as HTMLImageElement);

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).toBeNull();
  });

  it('shows no blur for an old photo without a placeholder', () => {
    const { container } = renderGallery([photo('cover', null)]);

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).toBeNull();
  });

  it('decodes no blur for a slide far from the one shown', () => {
    const { container } = renderGallery([
      photo('cover', null),
      photo('second', null),
      photo('far', PLACEHOLDER),
    ]);

    expect(container.querySelector(PLACEHOLDER_SELECTOR)).toBeNull();
  });
});
