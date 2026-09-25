/**
 * What the app accepts before uploading. The numbers mirror the server
 * (backend/src/media/media-limits.ts and the media worker), which checks everything again;
 * checking here only tells the seller early, before a long upload.
 */

import {
  FileFormat,
  IMAGE_FORMATS,
  type ImageDimensions,
  VIDEO_FORMATS,
} from '@/features/media/file-header';

export const MIB = 1024 * 1024;

export const MAX_IMAGES_PER_LISTING = 10;
export const MAX_VIDEOS_PER_LISTING = 1;

/** iPhone photos are at most ~5 MB; the app uploads a ~200 KB JPEG. */
export const MAX_IMAGE_BYTES = 10 * MIB;
/** The server refuses a photo whose shorter side is below this. */
export const MIN_IMAGE_EDGE = 500;

export const MAX_VIDEO_BYTES = 150 * MIB;
export const MAX_VIDEO_DURATION_MS = 60_000;
/** The server allows the same slack: phones round a 60 s recording up. */
const VIDEO_DURATION_TOLERANCE_MS = 500;
export const MAX_VIDEO_LONG_EDGE = 1920;
export const MAX_VIDEO_SHORT_EDGE = 1080;

/** Conversion target (plans/create-listing.md, "Video on the client"). */
export const CONVERTED_SHORT_EDGE = 720;
export const CONVERTED_BITRATE = 3_000_000;
/** A clip already at or below 720p is converted only when its bitrate is above this. */
const CONVERT_ABOVE_BITRATE = 4_000_000;

export enum MediaKind {
  Image = 'IMAGE',
  Video = 'VIDEO',
}

export enum RejectReason {
  UnsupportedFormat = 'UNSUPPORTED_FORMAT',
  ImageTooLarge = 'IMAGE_TOO_LARGE',
  ImageTooSmall = 'IMAGE_TOO_SMALL',
  TooManyImages = 'TOO_MANY_IMAGES',
  TooManyVideos = 'TOO_MANY_VIDEOS',
  /** The file could not be read, or is not a video mediabunny can open. */
  Unreadable = 'UNREADABLE',
  VideoTooLong = 'VIDEO_TOO_LONG',
  VideoTooLarge = 'VIDEO_TOO_LARGE',
  VideoResolution = 'VIDEO_RESOLUTION',
  /** HEVC this phone could not convert: iPhones record it by default. */
  VideoHevc = 'VIDEO_HEVC',
  VideoNotPlayable = 'VIDEO_NOT_PLAYABLE',
}

/** H.264 profiles phone decoders all play: Baseline, Main, Extended, High (8-bit 4:2:0). */
const PLAYABLE_H264_PROFILES = new Set([66, 77, 88, 100]);

/** The kind a picked file is treated as; unknown bytes count as the photo they claim to be. */
export function mediaKindOf(format: FileFormat, declaredType: string) {
  if (VIDEO_FORMATS.includes(format)) {
    return MediaKind.Video;
  }
  return format === FileFormat.Unknown && declaredType.startsWith('video/')
    ? MediaKind.Video
    : MediaKind.Image;
}

/** Known from the first bytes, so a file in a format we cannot use never takes a slot. */
export function formatProblem(kind: MediaKind, format: FileFormat | null) {
  if (format === null) {
    return RejectReason.Unreadable;
  }

  const accepted = kind === MediaKind.Video ? VIDEO_FORMATS : IMAGE_FORMATS;
  return accepted.includes(format) ? null : RejectReason.UnsupportedFormat;
}

/** `dimensions` is null when the header could not be read; the server then decides. */
export function checkImage(bytes: number, dimensions: ImageDimensions | null) {
  if (bytes > MAX_IMAGE_BYTES) {
    return RejectReason.ImageTooLarge;
  }

  if (dimensions && Math.min(dimensions.width, dimensions.height) < MIN_IMAGE_EDGE) {
    return RejectReason.ImageTooSmall;
  }
  return null;
}

/** A picked file as far as its first bytes tell. */
export interface PickedMedia {
  kind: MediaKind;
  /** Null when the file could not be read at all. */
  format: FileFormat | null;
  bytes: number;
  /** Photos only; null when the header does not say. */
  dimensions: ImageDimensions | null;
}

/**
 * For each picked file, in order, the reason it cannot go on the listing, or null. What the
 * first bytes already rule out (format, photo size) is refused first, so a file that would
 * be refused anyway never takes one of the ten photo slots. `accepted` counts the draft's
 * files of each kind that are not rejected.
 */
export function refusePicked(picked: PickedMedia[], accepted: Record<MediaKind, number>) {
  const counts = { ...accepted };
  return picked.map((file) => {
    const early =
      formatProblem(file.kind, file.format) ??
      (file.kind === MediaKind.Image ? checkImage(file.bytes, file.dimensions) : null);
    if (early) {
      return early;
    }

    const isImage = file.kind === MediaKind.Image;
    if (counts[file.kind] >= (isImage ? MAX_IMAGES_PER_LISTING : MAX_VIDEOS_PER_LISTING)) {
      return isImage ? RejectReason.TooManyImages : RejectReason.TooManyVideos;
    }
    counts[file.kind] += 1;
    return null;
  });
}

export interface VideoFacts {
  bytes: number;
  /** mediabunny's codec name: "avc" is H.264. */
  videoCodec: string | null;
  /** The full codec string, e.g. "avc1.640028"; it carries the H.264 profile. */
  videoCodecString: string | null;
  /** Every audio track: the server refuses the file if any is not AAC. */
  audioCodecs: string[];
  durationMs: number | null;
  /** Display size, after the rotation stored in the file. */
  width: number | null;
  height: number | null;
}

/** A length the file does not state passes; the server measures it. */
export function checkVideoLength(durationMs: number | null) {
  return durationMs !== null && durationMs > MAX_VIDEO_DURATION_MS + VIDEO_DURATION_TOLERANCE_MS
    ? RejectReason.VideoTooLong
    : null;
}

/**
 * False for High 10, 4:2:2 and 4:4:4 H.264, which many phones cannot play. The profile is
 * the first byte after "avc1."; an unknown string passes and the server decides.
 */
function isPlayableH264Profile(codecString: string | null) {
  const match = codecString?.match(/^avc[13]\.([0-9a-f]{2})/i);
  return !match || PLAYABLE_H264_PROFILES.has(parseInt(match[1], 16));
}

/** Why the server would refuse this file as it is, or null when it would take it. */
export function originalVideoProblem(video: VideoFacts) {
  if (video.videoCodec === 'hevc') {
    return RejectReason.VideoHevc;
  }

  const isPlayableVideo =
    video.videoCodec === 'avc' && isPlayableH264Profile(video.videoCodecString);
  if (!isPlayableVideo || video.audioCodecs.some((codec) => codec !== 'aac')) {
    return RejectReason.VideoNotPlayable;
  }

  if (video.width !== null && video.height !== null) {
    const longEdge = Math.max(video.width, video.height);
    const shortEdge = Math.min(video.width, video.height);
    if (longEdge > MAX_VIDEO_LONG_EDGE || shortEdge > MAX_VIDEO_SHORT_EDGE) {
      return RejectReason.VideoResolution;
    }
  }
  if (video.bytes > MAX_VIDEO_BYTES) {
    return RejectReason.VideoTooLarge;
  }
  return null;
}

/**
 * Whether converting to 720p is worth it: larger than 720p, a format buyers' phones may not
 * play, or a 720p clip with a bitrate high enough that converting still saves a lot.
 */
export function shouldConvertVideo(video: VideoFacts) {
  if (originalVideoProblem(video) !== null) {
    return true;
  }

  if (video.width !== null && video.height !== null) {
    if (Math.min(video.width, video.height) > CONVERTED_SHORT_EDGE) {
      return true;
    }
  }
  if (video.durationMs) {
    return (video.bytes * 8 * 1000) / video.durationMs > CONVERT_ABOVE_BITRATE;
  }
  return false;
}

/** 720p on the short side, same shape, even sides as H.264 needs. Never upscales. */
export function convertedVideoSize(width: number, height: number) {
  const scale = Math.min(1, CONVERTED_SHORT_EDGE / Math.min(width, height));
  const even = (side: number) => Math.max(2, Math.round((side * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}
