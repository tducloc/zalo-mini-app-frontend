import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FileFormat, readImageDimensions, sniffFormat } from '@/features/media/file-header';

function bytes(...parts: (number[] | string)[]) {
  return new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? Array.from(part, (char) => char.charCodeAt(0)) : part,
    ),
  );
}

/** An ISO-BMFF file starts with a box size, then "ftyp" and the major brand. */
const ftyp = (brand: string) => bytes([0, 0, 0, 0x18], 'ftyp', brand, [0, 0, 0, 0]);

describe('sniffFormat', () => {
  it.each([
    ['JPEG', bytes([0xff, 0xd8, 0xff, 0xe1]), FileFormat.Jpeg],
    ['PNG', bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]), FileFormat.Png],
    ['WebP', bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '), FileFormat.Webp],
    ['GIF', bytes('GIF89a'), FileFormat.Gif],
    ['iPhone HEIC', ftyp('heic'), FileFormat.Heic],
    ['Samsung HEIF', ftyp('mif1'), FileFormat.Heic],
    ['AVIF', ftyp('avif'), FileFormat.Avif],
    ['iPhone MOV', ftyp('qt  '), FileFormat.QuickTime],
    ['Android MP4', ftyp('isom'), FileFormat.Mp4],
    ['3GP', ftyp('3gp4'), FileFormat.Mp4],
  ])('recognises %s', (_name, head, format) => {
    expect(sniffFormat(head)).toBe(format);
  });

  it('does not trust a name or type, only the bytes', () => {
    expect(sniffFormat(bytes('%PDF-1.7'))).toBe(FileFormat.Unknown);
    expect(sniffFormat(new Uint8Array())).toBe(FileFormat.Unknown);
  });
});

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
