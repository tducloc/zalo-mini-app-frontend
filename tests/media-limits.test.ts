import { describe, expect, it } from 'vitest';

import { FileFormat } from '@/features/media/file-header';
import {
  checkImage,
  checkVideoLength,
  convertedVideoSize,
  formatProblem,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MediaKind,
  mediaKindOf,
  originalVideoProblem,
  type PickedMedia,
  refusePicked,
  RejectReason,
  shouldConvertVideo,
  type VideoFacts,
} from '@/features/media/media-limits';

const MB = 1024 * 1024;
const PHOTO = { width: 4032, height: 3024 };

describe('mediaKindOf', () => {
  it('goes by the bytes, and by the declared type only when the bytes are unknown', () => {
    expect(mediaKindOf(FileFormat.QuickTime, '')).toBe(MediaKind.Video);
    expect(mediaKindOf(FileFormat.Jpeg, 'video/mp4')).toBe(MediaKind.Image);
    expect(mediaKindOf(FileFormat.Unknown, 'video/x-matroska')).toBe(MediaKind.Video);
    expect(mediaKindOf(FileFormat.Unknown, '')).toBe(MediaKind.Image);
  });
});

describe('refusePicked', () => {
  const none = { [MediaKind.Image]: 0, [MediaKind.Video]: 0 };
  const photo = (overrides: Partial<PickedMedia> = {}): PickedMedia => ({
    kind: MediaKind.Image,
    format: FileFormat.Jpeg,
    bytes: 3 * MB,
    dimensions: PHOTO,
    ...overrides,
  });
  const video: PickedMedia = {
    kind: MediaKind.Video,
    format: FileFormat.QuickTime,
    bytes: 90 * MB,
    dimensions: null,
  };

  it('takes photos up to ten and one video, in the order picked', () => {
    const reasons = refusePicked([video, ...Array(11).fill(photo()), video], none);

    expect(reasons.slice(0, 11)).toEqual(Array(11).fill(null));
    expect(reasons[11]).toBe(RejectReason.TooManyImages);
    expect(reasons[12]).toBe(RejectReason.TooManyVideos);
  });

  it('counts what the draft already holds', () => {
    const reasons = refusePicked([photo(), photo()], {
      [MediaKind.Image]: 9,
      [MediaKind.Video]: 1,
    });
    expect(reasons).toEqual([null, RejectReason.TooManyImages]);
  });

  it('refuses what the first bytes rule out before counting, so it takes no slot', () => {
    const picked = [
      ...Array(9).fill(photo()),
      photo({ format: FileFormat.Heic }),
      photo({ bytes: MAX_IMAGE_BYTES + 1 }),
      photo({ dimensions: { width: 400, height: 300 } }),
      photo(),
    ];

    expect(refusePicked(picked, none).slice(9)).toEqual([
      RejectReason.Heic,
      RejectReason.ImageTooLarge,
      RejectReason.ImageTooSmall,
      null,
    ]);
  });
});

describe('formatProblem', () => {
  it('takes JPEG, PNG and WebP photos, MP4 and MOV videos', () => {
    expect(formatProblem(MediaKind.Image, FileFormat.Webp)).toBeNull();
    expect(formatProblem(MediaKind.Video, FileFormat.QuickTime)).toBeNull();
  });

  it('names HEIC apart from other formats, so the message can say what to change', () => {
    expect(formatProblem(MediaKind.Image, FileFormat.Heic)).toBe(RejectReason.Heic);
    expect(formatProblem(MediaKind.Image, FileFormat.Gif)).toBe(RejectReason.UnsupportedFormat);
    expect(formatProblem(MediaKind.Video, FileFormat.Unknown)).toBe(RejectReason.UnsupportedFormat);
  });

  it('reports a file that could not be read', () => {
    expect(formatProblem(MediaKind.Image, null)).toBe(RejectReason.Unreadable);
  });
});

describe('checkImage', () => {
  it('accepts a normal phone photo', () => {
    expect(checkImage(3 * MB, PHOTO)).toBeNull();
  });

  it('refuses what the server would refuse', () => {
    expect(checkImage(MAX_IMAGE_BYTES + 1, PHOTO)).toBe(RejectReason.ImageTooLarge);
    expect(checkImage(MB, { width: 800, height: 499 })).toBe(RejectReason.ImageTooSmall);
  });

  it('leaves a photo with an unreadable header to the server', () => {
    expect(checkImage(MB, null)).toBeNull();
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

describe('checkVideoLength', () => {
  it('allows the half second phones add to a 60 s recording', () => {
    expect(checkVideoLength(60_400)).toBeNull();
    expect(checkVideoLength(60_600)).toBe(RejectReason.VideoTooLong);
    expect(checkVideoLength(null)).toBeNull();
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

describe('convertedVideoSize', () => {
  it('brings the short side to 720 and keeps the shape', () => {
    expect(convertedVideoSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(convertedVideoSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
  });

  it('rounds to even sides and never upscales', () => {
    expect(convertedVideoSize(1080, 1350)).toEqual({ width: 720, height: 900 });
    expect(convertedVideoSize(1440, 1080)).toEqual({ width: 960, height: 720 });
    expect(convertedVideoSize(480, 853)).toEqual({ width: 480, height: 854 });
  });
});
