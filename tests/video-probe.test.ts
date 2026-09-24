import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { inspectMp4 } from '@/features/media/video-probe';

// Encoded by ffmpeg: the rotated clip carries a 90° display matrix, as phones write for
// portrait video, and keeps its moov after mdat.
function inspectFixture(name: string) {
  const bytes = readFileSync(fileURLToPath(new URL(`./fixtures/videos/${name}`, import.meta.url)));
  const read = async (start: number, end: number) => {
    const slice = bytes.subarray(start, end);
    return slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength);
  };
  return inspectMp4(read, bytes.length);
}

describe('inspectMp4', () => {
  it('reads length, codecs and the displayed size of a rotated clip from moov', async () => {
    const info = await inspectFixture('rotated-90-320x240-2.5s.mp4');

    expect(info).toMatchObject({
      videoCodecs: ['avc1'],
      audioCodecs: ['mp4a'],
      faststart: false,
      width: 240,
      height: 320,
    });
    expect([90, 270]).toContain(info.rotation);
    expect(info.durationMs).toBeGreaterThanOrEqual(2400);
    expect(info.durationMs).toBeLessThanOrEqual(2600);
  });

  it('reads a MOV without audio or rotation', async () => {
    const info = await inspectFixture('plain-176x144-1.2s.mov');

    expect(info).toMatchObject({
      brand: 'qt  ',
      videoCodecs: ['avc1'],
      audioCodecs: [],
      faststart: true,
      width: 176,
      height: 144,
      rotation: 0,
    });
    expect(info.durationMs).toBe(1200);
  });
});
