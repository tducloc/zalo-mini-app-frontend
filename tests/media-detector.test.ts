import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MediaDetector } from '@/features/media/media-detector';
import { ImageFormat } from '@/features/media/image/image-utils';
import { MediaKind, RejectReason } from '@/features/media/media-utils';

function fixture(folder: string, name: string) {
  const path = fileURLToPath(new URL(`./fixtures/${folder}/${name}`, import.meta.url));
  return new Uint8Array(readFileSync(path));
}

const pick = (bytes: Uint8Array, type = '') => new File([bytes], 'picked', { type });

/** A 64 KB APP1 segment: the most one metadata segment can hold. */
const APP1 = new Uint8Array(2 + 0xffff);
APP1.set([0xff, 0xe1, 0xff, 0xff]);

/** `jpeg` with `count` full metadata segments right after its start marker. */
function withMetadata(jpeg: Uint8Array, count: number) {
  const parts = [
    jpeg.subarray(0, 2),
    ...Array.from({ length: count }, () => APP1),
    jpeg.subarray(2),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const mp4Head = (brand: string) =>
  new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode(`ftyp${brand}`), 0, 0, 0, 0]);

describe('MediaDetector', () => {
  it('takes a photo it can read, with its format and size', async () => {
    const detected = await new MediaDetector(pick(fixture('images', 'image-45x31.png'))).detect();
    expect(detected).toMatchObject({
      kind: MediaKind.Image,
      photo: { format: ImageFormat.Png, width: 45, height: 31 },
    });
  });

  it('reads further for a JPEG whose metadata pushes its size past the first 256 KB', async () => {
    const jpeg = withMetadata(fixture('images', 'baseline-37x23.jpg'), 5);
    const detected = await new MediaDetector(pick(jpeg)).detect();
    expect(detected.photo).toEqual({ format: ImageFormat.Jpeg, width: 37, height: 23 });
  });

  it('leaves an MP4 or MOV to the video checks, even with no file.type', async () => {
    for (const brand of ['isom', 'qt  ']) {
      expect(await new MediaDetector(pick(mp4Head(brand))).detect()).toEqual({
        kind: MediaKind.Video,
        photo: null,
        problem: null,
      });
    }
  });

  it('refuses anything else without taking a video slot: WebM, PDF, an unknown file', async () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
    const pdf = new TextEncoder().encode('%PDF-1.7');
    for (const [bytes, type] of [
      [webm, 'video/webm'],
      [pdf, 'application/pdf'],
      [new Uint8Array(300 * 1024), ''],
    ] as const) {
      expect((await new MediaDetector(pick(bytes, type)).detect()).problem).toBe(
        RejectReason.UnsupportedFormat,
      );
    }
  });

  it('refuses a photo format the app does not take', async () => {
    const gif = new TextEncoder().encode('GIF89a\x0a\x00\x14\x00\x00\x00\x00');
    expect(await new MediaDetector(pick(gif, 'image/gif')).detect()).toMatchObject({
      kind: MediaKind.Image,
      problem: RejectReason.UnsupportedFormat,
    });
  });
});
