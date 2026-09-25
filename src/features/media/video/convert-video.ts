/**
 * Converts a picked clip to 720p H.264 on the phone, so the seller uploads and buyers
 * stream about a fifth of a 1080p phone recording (plans/create-listing.md, "Video on the
 * client"). Needs WebCodecs: every supported Android WebView, iOS 16.4+.
 *
 * The encoder and decoder run on the phone's media hardware; mediabunny only moves frames
 * between them. Whether that stays smooth on the main thread is a device check (media lab).
 */

import { CONVERTED_SHORT_EDGE, VideoFormat } from '@/features/media/video/video-utils';

/** About a fifth of a 1080p phone recording, and still sharp at 720p for a product clip. */
const CONVERTED_BITRATE = 3_000_000;

/** Faster clips are converted at this rate: product clips do not need 60 fps, and it halves the work. */
const MAX_FRAME_RATE = 30;
/** Enough packets to know the frame rate without reading the whole index. */
const FRAME_RATE_SAMPLE_PACKETS = 60;
/**
 * No progress for this long means the encoder hung. Seen with WebKit's software encoder
 * (the iOS simulator, desktop WebKit), not on phones, which encode in hardware; the tile
 * must not wait forever if one ever does. The caller then falls back to the original.
 */
const STALL_TIMEOUT_MS = 20_000;

export const canConvertVideos =
  typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

interface ConvertVideoOptions {
  onProgress: (progress: number) => void;
  signal: AbortSignal;
}

export class ConversionStalledError extends Error {
  constructor() {
    super(`no conversion progress for ${STALL_TIMEOUT_MS / 1000} s`);
    this.name = 'ConversionStalledError';
  }
}

/**
 * Rejects with ConversionStalledError once `progressed` has not been called for
 * `timeoutMs`; `stop` ends the watch. A promise to race against the work, because a hung
 * encoder never lets the work itself settle.
 */
export function watchForStall(timeoutMs = STALL_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fail: (error: Error) => void = () => {};
  const stalled = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const restart = () => {
    clearTimeout(timer);
    timer = setTimeout(() => fail(new ConversionStalledError()), timeoutMs);
  };
  restart();
  return { stalled, progressed: restart, stop: () => clearTimeout(timer) };
}

/** 720p on the short side, same shape, even sides as H.264 needs. Never upscales. */
export function convertedVideoSize(width: number, height: number) {
  const scale = Math.min(1, CONVERTED_SHORT_EDGE / Math.min(width, height));
  const even = (side: number) => Math.max(2, Math.round((side * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/**
 * Resolves with the converted MP4 (index first). Rejects when this phone cannot decode the
 * clip or encode H.264/AAC, and with a cancellation error when `signal` aborts; the caller
 * falls back to the original either way.
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
        const [{ averagePacketRate }, displayWidth, displayHeight] = await Promise.all([
          track.computePacketStats(FRAME_RATE_SAMPLE_PACKETS),
          track.getDisplayWidth(),
          track.getDisplayHeight(),
        ]);
        return {
          ...convertedVideoSize(displayWidth, displayHeight),
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
      throw new Error(`cannot convert: ${reasons.join(', ') || 'no video'}`);
    }

    options.signal.throwIfAborted();
    const cancel = () => void conversion.cancel();
    options.signal.addEventListener('abort', cancel, { once: true });
    const watch = watchForStall();
    conversion.onProgress = (progress) => {
      watch.progressed();
      options.onProgress(progress);
    };
    try {
      await Promise.race([conversion.execute(), watch.stalled]);
    } catch (error) {
      if (error instanceof ConversionStalledError) {
        // Best effort: a hung encoder may never wind down.
        cancel();
      }
      throw error;
    } finally {
      watch.stop();
      options.signal.removeEventListener('abort', cancel);
    }

    if (!target.buffer) {
      throw new Error('conversion produced no file');
    }
    return new Blob([target.buffer], { type: VideoFormat.Mp4 });
  } finally {
    input.dispose();
  }
}
