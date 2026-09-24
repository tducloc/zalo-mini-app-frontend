import { describe, expect, it } from 'vitest';

import { FileFormat, sniffFormat } from '@/features/media/file-format';

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
