import { describe, expect, it } from 'vitest';

import { MAX_SCALE, NO_OFFSET } from '@/features/products/constants/zoom';
import { clampOffset, clampScale, zoomAt } from '@/features/products/utils/zoom';

const box = { width: 400, height: 300 };

describe('zoomAt', () => {
  it('keeps the point under the fingers in place', () => {
    const focus = { x: 100, y: -50 };
    const offset = zoomAt(focus, NO_OFFSET, 1, 2);
    // The photo point that was under the fingers: (focus - offset) / scale.
    expect({ x: (focus.x - offset.x) / 2, y: (focus.y - offset.y) / 2 }).toEqual(focus);
  });

  it('zooms around the centre without moving it', () => {
    expect(zoomAt(NO_OFFSET, NO_OFFSET, 1, 3)).toEqual({ x: 0, y: 0 });
  });

  it('continues from a zoom already under way', () => {
    const first = zoomAt({ x: 50, y: 0 }, NO_OFFSET, 1, 2);
    expect(zoomAt({ x: 50, y: 0 }, first, 2, 4)).toEqual(zoomAt({ x: 50, y: 0 }, NO_OFFSET, 1, 4));
  });
});

describe('clampOffset', () => {
  it('lets a fitted photo not move at all', () => {
    const offset = clampOffset({ x: 80, y: -40 }, 1, box);
    expect(offset.x).toBeCloseTo(0);
    expect(offset.y).toBeCloseTo(0);
  });

  it('stops a zoomed photo at its edges', () => {
    // At 2×, the photo is 800 × 600: it can move 200 px sideways and 150 px up or down.
    expect(clampOffset({ x: 500, y: -500 }, 2, box)).toEqual({ x: 200, y: -150 });
    expect(clampOffset({ x: 120, y: 60 }, 2, box)).toEqual({ x: 120, y: 60 });
  });
});

describe('clampScale', () => {
  it('keeps the zoom between fit and the maximum', () => {
    expect(clampScale(0.5)).toBe(1);
    expect(clampScale(10)).toBe(MAX_SCALE);
    expect(clampScale(2)).toBe(2);
  });
});
