/**
 * Reads what media-limits.ts needs to know about a picked video.
 *
 * mediabunny reads only the boxes it needs (a few KB of a 150 MB file), so this is instant
 * and never loads the video into memory. A <video> element cannot do this on iPhone:
 * WebKit does not load one outside a user gesture, so loadedmetadata never fires. The
 * library (~100 KB gzip) is imported on demand to keep it out of the main bundle.
 */

export interface VideoMetadata {
  /** e.g. "video/mp4" or "video/quicktime". */
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

interface CodecTrack {
  getCodec(): Promise<string | null>;
  getInternalCodecId(): Promise<string | number | Uint8Array | null>;
}

async function codecName(track: CodecTrack | null) {
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
 * is not an MP4/MOV at all.
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
