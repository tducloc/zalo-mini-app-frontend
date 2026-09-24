import { describe, expect, it } from 'vitest';

import { getViewerIndex, isNearSlide } from '@/features/products/utils/gallery';

describe('getViewerIndex', () => {
  it('opens the tapped photo when every slide is a photo', () => {
    const media = [{ type: 'IMAGE' }, { type: 'IMAGE' }, { type: 'IMAGE' }] as const;
    expect(getViewerIndex(media, 0)).toBe(0);
    expect(getViewerIndex(media, 2)).toBe(2);
  });

  it('skips videos, which the viewer does not list', () => {
    const media = [{ type: 'IMAGE' }, { type: 'VIDEO' }, { type: 'IMAGE' }] as const;
    expect(getViewerIndex(media, 2)).toBe(1);
  });
});

describe('isNearSlide', () => {
  it('treats the active slide and its neighbours as near', () => {
    expect(isNearSlide(1, 1, 4)).toBe(true);
    expect(isNearSlide(2, 1, 4)).toBe(true);
    expect(isNearSlide(3, 1, 5)).toBe(false);
  });

  it('wraps around the loop seam', () => {
    expect(isNearSlide(3, 0, 4)).toBe(true);
    expect(isNearSlide(0, 3, 4)).toBe(true);
  });
});
