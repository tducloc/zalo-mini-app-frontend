import { describe, expect, it } from 'vitest';

import { isNearSlide } from '@/features/products/utils/gallery';

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
