import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readImageDimensions } from '@/features/media/image-dimensions';

// Fixtures were encoded by sharp (libvips), so they are real files, not hand-built headers.
function fixture(name: string) {
  const path = fileURLToPath(new URL(`./fixtures/images/${name}`, import.meta.url));
  return new Uint8Array(readFileSync(path));
}

describe('readImageDimensions', () => {
  it.each([
    ['baseline-37x23.jpg', 37, 23],
    ['progressive-41x29.jpg', 41, 29],
    ['image-45x31.png', 45, 31],
    ['lossy-51x19.webp', 51, 19],
    ['lossless-53x17.webp', 53, 17],
    ['alpha-57x13.webp', 57, 13],
  ])('reads %s', (name, width, height) => {
    expect(readImageDimensions(fixture(name))).toEqual({ width, height });
  });

  it('finds the JPEG frame size after a 40 KB EXIF segment', () => {
    // The stored size, before the Orientation tag (6 = rotate 90°) is applied.
    expect(readImageDimensions(fixture('big-exif-33x21.jpg'))).toEqual({ width: 33, height: 21 });
  });

  it('returns null when the head is cut before the JPEG frame header', () => {
    const head = fixture('big-exif-33x21.jpg').subarray(0, 1024);
    expect(readImageDimensions(head)).toBeNull();
  });

  it('returns null for formats it does not read', () => {
    const heic = new Uint8Array([0, 0, 0, 24, ...Array.from('ftypheic', (c) => c.charCodeAt(0))]);
    expect(readImageDimensions(heic)).toBeNull();
    expect(readImageDimensions(new Uint8Array())).toBeNull();
  });
});
