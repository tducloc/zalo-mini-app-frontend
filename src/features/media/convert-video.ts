/**
 * Converts a picked clip to 720p H.264 on the phone, so the seller uploads and buyers
 * stream about a fifth of a 1080p phone recording (plans/create-listing.md, "Video on the
 * client"). Needs WebCodecs: every supported Android WebView, iOS 16.4+.
 *
 * The encoder and decoder run on the phone's media hardware; mediabunny only moves frames
 * between them. Whether that stays smooth on the main thread is a device check (media lab).
 */

import { CONVERTED_BITRATE } from '@/features/media/media-limits';

/** Faster clips are converted at this rate: product clips do not need 60 fps, and it halves the work. */
const MAX_FRAME_RATE = 30;
/** Enough packets to know the frame rate without reading the whole index. */
const FRAME_RATE_SAMPLE_PACKETS = 60;

export const canConvertVideos =
  typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

export class VideoConversionError extends Error {}

export interface ConvertVideoOptions {
  /** Display size of the result, from convertedVideoSize. */
  width: number;
  height: number;
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}

/**
 * Resolves with the converted MP4 (index first). Rejects with VideoConversionError when this
 * phone cannot decode the clip or encode H.264/AAC, and with a cancellation error when
 * `signal` aborts.
 */
export async function convertVideo(file: Blob, options: ConvertVideoOptions): Promise<Blob> {
  const {
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    MP4,
    Mp4OutputFormat,
    Output,
    QTFF,
    Quality,
  } = await import('mediabunny');

  const input = new Input({ formats: [MP4, QTFF], source: new BlobSource(file) });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });

  try {
    const hasAudio = (await input.getPrimaryAudioTrack()) !== null;
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: async (track) => {
        const { averagePacketRate } = await track.computePacketStats(FRAME_RATE_SAMPLE_PACKETS);
        return {
          width: options.width,
          height: options.height,
          fit: 'fill',
          codec: 'avc',
          quality: new Quality({ bitrate: CONVERTED_BITRATE }),
          frameRate: averagePacketRate > MAX_FRAME_RATE ? MAX_FRAME_RATE : undefined,
        };
      },
      // Copied when it is AAC already (iOS 16.4 WebCodecs cannot encode audio).
      audio: { codec: 'aac' },
      // Drops the location and every other tag the camera wrote.
      tags: {},
      showWarnings: false,
    });

    const kept = conversion.utilizedTracks;
    const keptVideo = kept.some((track) => track.isVideoTrack());
    const keptAudio = kept.some((track) => track.isAudioTrack());
    // Never upload a clip that silently lost its sound.
    if (!conversion.isValid || !keptVideo || (hasAudio && !keptAudio)) {
      const reasons = conversion.discardedTracks.map((discarded) => discarded.reason);
      throw new VideoConversionError(`cannot convert: ${reasons.join(', ') || 'no video'}`);
    }

    options.signal.throwIfAborted();
    const cancel = () => void conversion.cancel();
    options.signal.addEventListener('abort', cancel, { once: true });
    conversion.onProgress = (progress) => options.onProgress(progress);
    try {
      await conversion.execute();
    } finally {
      options.signal.removeEventListener('abort', cancel);
    }

    if (!target.buffer) {
      throw new VideoConversionError('conversion produced no file');
    }
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
