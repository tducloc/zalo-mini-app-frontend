import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { originalVideoProblem, RejectReason } from '@/features/media/media-limits';
import { readVideoMetadata } from '@/features/media/video-metadata';

// Half-second 96×64 clips made with the backend's ffmpeg-static (testsrc2): H.264 + AAC,
// the same stored landscape with a 90° flag as MOV, MPEG-4 Part 2, H.264 High 10, HEVC,
// and H.264 with an AAC and an Opus track.
function fixture(name: string) {
  const path = fileURLToPath(new URL(`./fixtures/videos/${name}`, import.meta.url));
  return new Blob([readFileSync(path)]);
}

describe('readVideoMetadata', () => {
  it('reads codecs, length and size of a phone-style clip', async () => {
    const meta = await readVideoMetadata(fixture('h264-aac.mp4'));

    expect(meta).toMatchObject({
      videoCodec: 'avc',
      audioCodecs: ['aac'],
      width: 96,
      height: 64,
      rotation: 0,
    });
    expect(meta.videoCodecString).toMatch(/^avc1\./);
    expect(meta.durationMs).toBeGreaterThan(400);
    expect(meta.durationMs).toBeLessThan(700);
  });

  it('gives the size as played for a clip stored sideways', async () => {
    const meta = await readVideoMetadata(fixture('rotated.mov'));

    expect(meta.mimeType).toContain('quicktime');
    // ffmpeg's -display_rotation 90 turns counter-clockwise, which is 270° clockwise.
    expect(meta).toMatchObject({ width: 64, height: 96, rotation: 270 });
  });

  it('names a codec mediabunny does not decode by its container code', async () => {
    expect((await readVideoMetadata(fixture('mp4v.mp4'))).videoCodec).toBe('mp4v');
  });

  it('gives what the upload checks need to refuse a file the server would refuse', async () => {
    const problemOf = async (name: string) => {
      const meta = await readVideoMetadata(fixture(name));
      return originalVideoProblem({ ...meta, bytes: 10_000 });
    };

    expect(await problemOf('h264-aac.mp4')).toBeNull();
    expect(await problemOf('hevc.mp4')).toBe(RejectReason.VideoHevc);
    expect(await problemOf('high10.mp4')).toBe(RejectReason.VideoNotPlayable);
    expect(await problemOf('two-audio.mp4')).toBe(RejectReason.VideoNotPlayable);
  });

  it('rejects a file that is not MP4 or MOV', async () => {
    await expect(readVideoMetadata(new Blob(['not a video']))).rejects.toThrow();
  });
});
