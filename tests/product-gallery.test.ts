import { describe, expect, it } from 'vitest';

import { getViewerIndex } from '@/features/products/utils/gallery';

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
