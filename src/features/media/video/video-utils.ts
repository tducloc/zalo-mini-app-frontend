/**
 * What the app checks on a picked video: its metadata, read by mediabunny, and whether the
 * server would take the file as it is or it should be converted to 720p first (the
 * conversion itself is convert-video.ts).
 *
 * mediabunny reads only the boxes it needs (a few KB of a 150 MB file), so this is instant
 * and never loads the video into memory. A <video> element cannot do this on iPhone:
 * WebKit does not load one outside a user gesture, so loadedmetadata never fires. The
 * library is imported on demand to keep it out of the main bundle.
 */

import type { InputTrack } from 'mediabunny';

import { MIB, RejectReason } from '@/features/media/media-utils';

export const MAX_VIDEO_BYTES = 150 * MIB;
export const MAX_VIDEO_DURATION_MS = 60_000;
/** The server allows the same slack: phones round a 60 s recording up. */
const VIDEO_DURATION_TOLERANCE_MS = 500;
const MAX_VIDEO_LONG_EDGE = 1920;
export const MAX_VIDEO_SHORT_EDGE = 1080;

/** Conversion target (plans/create-listing.md, "Video on the client"): 720p. */
export const CONVERTED_SHORT_EDGE = 720;
/** A clip already at or below 720p is converted only when its bitrate is above this. */
const CONVERT_ABOVE_BITRATE = 4_000_000;

/** H.264 profiles phone decoders all play: Baseline, Main, Extended, High (8-bit 4:2:0). */
const PLAYABLE_H264_PROFILES = new Set([66, 77, 88, 100]);

/**
 * The containers the app takes: what phone cameras record (Android MP4, iPhone MOV). Also
 * the Content-Type of the upload.
 */
export enum VideoFormat {
  Mp4 = 'video/mp4',
  QuickTime = 'video/quicktime',
}

export interface VideoMetadata {
  format: VideoFormat;
  /** mediabunny's full MIME type, which can carry codecs; for display. */
  mimeType: string;
  /**
   * mediabunny's name ("avc", "hevc", …), or the container's own code when mediabunny
   * does not know the codec (e.g. "mp4v", MPEG-4 Part 2, which some Android phones make).
   */
  videoCodec: string | null;
  /** Full codec string, e.g. "avc1.640028" (profile, constraints, level). */
  videoCodecString: string | null;
  /** Every audio track's codec, in the same naming as videoCodec. */
  audioCodecs: string[];
  /** From the file's metadata; null when the file does not say. */
  durationMs: number | null;
  /** Size as displayed, after the rotation stored in the file. */
  width: number | null;
  height: number | null;
  /** Clockwise degrees the player turns the picture: 0, 90, 180 or 270. */
  rotation: number;
}

async function codecName(track: InputTrack | null) {
  if (!track) {
    return null;
  }
  const codec = await track.getCodec();
  if (codec) {
    return codec;
  }
  const internal = await track.getInternalCodecId();
  return typeof internal === 'string' ? internal : null;
}

/**
 * Accepts a picked File, or a URL (read with HTTP range requests). Rejects when the file
 * is not an MP4 or MOV at all: mediabunny is given only those two, so it is also the
 * format check for videos.
 */
export async function readVideoMetadata(source: Blob | string): Promise<VideoMetadata> {
  const { BlobSource, Input, MP4, QTFF, UrlSource } = await import('mediabunny');
  const input = new Input({
    formats: [MP4, QTFF],
    source: typeof source === 'string' ? new UrlSource(source) : new BlobSource(source),
  });

  try {
    const [mimeType, video, audioTracks, duration] = await Promise.all([
      input.getMimeType(),
      input.getPrimaryVideoTrack(),
      input.getAudioTracks(),
      input.getDurationFromMetadata(),
    ]);
    const [videoCodec, videoCodecString, width, height, rotation, audioCodecs] = await Promise.all([
      codecName(video),
      video ? video.getCodecParameterString() : null,
      video ? video.getDisplayWidth() : null,
      video ? video.getDisplayHeight() : null,
      video ? video.getRotation() : 0,
      Promise.all(audioTracks.map(codecName)),
    ]);
    return {
      format: mimeType.startsWith(VideoFormat.QuickTime) ? VideoFormat.QuickTime : VideoFormat.Mp4,
      mimeType,
      videoCodec,
      videoCodecString,
      audioCodecs: audioCodecs.map((codec) => codec ?? 'unknown'),
      durationMs: duration === null ? null : Math.round(duration * 1000),
      width,
      height,
      rotation,
    };
  } finally {
    input.dispose();
  }
}

/** What the checks below need: the metadata plus the file's size. */
export type VideoFacts = Pick<
  VideoMetadata,
  'videoCodec' | 'videoCodecString' | 'audioCodecs' | 'durationMs' | 'width' | 'height'
> & { bytes: number };

/** A length the file does not state passes; the server measures it. */
export function videoLengthProblem(durationMs: number | null) {
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
