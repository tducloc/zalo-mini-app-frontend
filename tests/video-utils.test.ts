import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RejectReason } from '@/features/media/media-utils';
import {
  videoLengthProblem,
  MAX_VIDEO_BYTES,
  originalVideoProblem,
  readVideoMetadata,
  shouldConvertVideo,
  type VideoFacts,
  VideoFormat,
} from '@/features/media/video/video-utils';

const MB = 1024 * 1024;

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
      format: VideoFormat.Mp4,
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

    expect(meta.format).toBe(VideoFormat.QuickTime);
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

const IPHONE_1080P: VideoFacts = {
  bytes: 108 * MB,
  videoCodec: 'avc',
  videoCodecString: 'avc1.640028',
  audioCodecs: ['aac'],
  durationMs: 60_000,
  width: 1080,
  height: 1920,
};

describe('videoLengthProblem', () => {
  it('allows the half second phones add to a 60 s recording', () => {
    expect(videoLengthProblem(60_400)).toBeNull();
    expect(videoLengthProblem(60_600)).toBe(RejectReason.VideoTooLong);
    expect(videoLengthProblem(null)).toBeNull();
  });
});

describe('originalVideoProblem', () => {
  it('accepts H.264 up to 1080p in either orientation, with AAC or no sound', () => {
    expect(originalVideoProblem(IPHONE_1080P)).toBeNull();
    expect(originalVideoProblem({ ...IPHONE_1080P, width: 1920, height: 1080 })).toBeNull();
    expect(originalVideoProblem({ ...IPHONE_1080P, audioCodecs: [] })).toBeNull();
    expect(originalVideoProblem({ ...IPHONE_1080P, videoCodecString: 'avc1.42E01E' })).toBeNull();
  });

  it('names HEVC on its own: iPhones record it by default and a setting changes that', () => {
    expect(originalVideoProblem({ ...IPHONE_1080P, videoCodec: 'hevc' })).toBe(
      RejectReason.VideoHevc,
    );
  });

  it('refuses what buyers’ phones may not play', () => {
    expect(originalVideoProblem({ ...IPHONE_1080P, videoCodec: 'mp4v' })).toBe(
      RejectReason.VideoNotPlayable,
    );
    // High 10 and 4:4:4 H.264 are valid files many phone decoders cannot play.
    for (const codecString of ['avc1.6E0028', 'avc1.F40028']) {
      expect(originalVideoProblem({ ...IPHONE_1080P, videoCodecString: codecString })).toBe(
        RejectReason.VideoNotPlayable,
      );
    }
    // The server refuses the file if any audio track is not AAC, not just the first.
    expect(originalVideoProblem({ ...IPHONE_1080P, audioCodecs: ['aac', 'opus'] })).toBe(
      RejectReason.VideoNotPlayable,
    );
  });

  it('refuses 4K and files over 150 MB', () => {
    expect(originalVideoProblem({ ...IPHONE_1080P, width: 2160, height: 3840 })).toBe(
      RejectReason.VideoResolution,
    );
    expect(originalVideoProblem({ ...IPHONE_1080P, bytes: MAX_VIDEO_BYTES + 1 })).toBe(
      RejectReason.VideoTooLarge,
    );
  });
});

describe('shouldConvertVideo', () => {
  it('converts anything above 720p, and what the server would refuse', () => {
    expect(shouldConvertVideo(IPHONE_1080P)).toBe(true);
    expect(shouldConvertVideo({ ...IPHONE_1080P, videoCodec: 'hevc' })).toBe(true);
  });

  it('keeps a 720p clip unless its bitrate is high', () => {
    const small = { ...IPHONE_1080P, width: 720, height: 1280, bytes: 20 * MB };
    expect(shouldConvertVideo(small)).toBe(false);
    expect(shouldConvertVideo({ ...small, bytes: 60 * MB })).toBe(true);
  });
});
