import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ImageFormat,
  MAX_IMAGE_BYTES,
  photoProblem,
  readPhotoHeader,
} from '@/features/media/image/image-utils';
import { RejectReason } from '@/features/media/media-utils';

const MB = 1024 * 1024;

// Fixtures were encoded by sharp (libvips), so they are real files, not hand-built headers.
function fixture(name: string) {
  const path = fileURLToPath(new URL(`./fixtures/images/${name}`, import.meta.url));
  return new Uint8Array(readFileSync(path));
}

function bytes(...parts: (number[] | string)[]) {
  return new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? Array.from(part, (char) => char.charCodeAt(0)) : part,
    ),
  );
}

describe('readPhotoHeader', () => {
  it.each([
    ['baseline-37x23.jpg', ImageFormat.Jpeg, 37, 23],
    ['progressive-41x29.jpg', ImageFormat.Jpeg, 41, 29],
    ['image-45x31.png', ImageFormat.Png, 45, 31],
    ['lossy-51x19.webp', ImageFormat.Webp, 51, 19],
    ['lossless-53x17.webp', ImageFormat.Webp, 53, 17],
    ['alpha-57x13.webp', ImageFormat.Webp, 57, 13],
  ])('reads %s', (name, format, width, height) => {
    expect(readPhotoHeader(fixture(name))).toEqual({ format, width, height });
  });

  it('finds the JPEG size after a 40 KB EXIF segment', () => {
    // The stored size, before the Orientation tag (6 = rotate 90°) is applied.
    expect(readPhotoHeader(fixture('big-exif-33x21.jpg'))).toMatchObject({ width: 33, height: 21 });
  });

  it('knows an image it does not take, and leaves its format empty', () => {
    const gif = bytes('GIF89a', [10, 0, 20, 0, 0, 0, 0]);
    expect(readPhotoHeader(gif)).toEqual({ format: null, width: 10, height: 20 });
  });

  it('returns null for what is not a readable image: a video, a cut header, a PDF', () => {
    const mp4 = bytes([0, 0, 0, 0x18], 'ftypisom', [0, 0, 0, 0], 'isomiso2');
    expect(readPhotoHeader(mp4)).toBeNull();
    expect(readPhotoHeader(fixture('big-exif-33x21.jpg').subarray(0, 1024))).toBeNull();
    expect(readPhotoHeader(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
    expect(readPhotoHeader(new Uint8Array())).toBeNull();
  });
});

describe('photoProblem', () => {
  const phone = { format: ImageFormat.Jpeg, width: 4032, height: 3024 };

  it('accepts a normal phone photo', () => {
    expect(photoProblem(phone, 3 * MB)).toBeNull();
  });

  it('refuses what the server would refuse', () => {
    expect(photoProblem({ ...phone, format: null }, MB)).toBe(RejectReason.UnsupportedFormat);
    expect(photoProblem(phone, MAX_IMAGE_BYTES + 1)).toBe(RejectReason.ImageTooLarge);
    expect(photoProblem({ ...phone, width: 800, height: 499 }, MB)).toBe(
      RejectReason.ImageTooSmall,
    );
  });
});
