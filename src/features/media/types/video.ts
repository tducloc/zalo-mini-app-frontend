/** Videos: formats and the metadata the checks read (utils/video.ts). */

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

/** What the video checks need: the metadata plus the file's size. */
export type VideoFacts = Pick<
  VideoMetadata,
  'videoCodec' | 'videoCodecString' | 'audioCodecs' | 'durationMs' | 'width' | 'height'
> & { bytes: number };
