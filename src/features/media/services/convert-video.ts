/**
 * Converts a picked clip to 720p H.264 on the phone, so the seller uploads and buyers
 * stream about a fifth of a 1080p phone recording (plans/create-listing.md, "Video on the
 * client"). Needs WebCodecs: every supported Android WebView, iOS 16.4+.
 *
 * The encoder and decoder run on the phone's media hardware; mediabunny only moves frames
 * between them. Whether that stays smooth on the main thread is a device check (media lab).
 */

import type { Conversion, InputTrack } from 'mediabunny';

import { CONVERTED_SHORT_EDGE } from '@/features/media/constants/limits';
import { VideoFormat } from '@/features/media/types/video';

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
/**
 * Once the shortest track is done, progress stands still while the longer ones encode:
 * each second of them gets this many seconds before the watch gives up. Phones encode
 * faster than real time; this leaves room for a slow one.
 */
const SLOW_ENCODE_FACTOR = 3;
/** Tracks ending within this of each other (in seconds) end together. */
const TRACK_END_TOLERANCE_S = 0.05;

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
 * Rejects with ConversionStalledError once `progressed` has not been called for the
 * timeout. `progressed(ms)` also changes the timeout from then on; `pause` stops the clock
 * until the next `progressed`; `stop` ends the watch for good. A promise to race against
 * the work, because a hung encoder never lets the work itself settle.
 */
export function watchForStall(timeoutMs = STALL_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentTimeoutMs = timeoutMs;
  let isStopped = false;
  let fail: (error: Error) => void = () => {};
  const stalled = new Promise<never>((_, reject) => {
    fail = reject;
  });

  const pause = () => clearTimeout(timer);
  const progressed = (nextTimeoutMs = currentTimeoutMs) => {
    if (isStopped) {
      return;
    }
    currentTimeoutMs = nextTimeoutMs;
    pause();
    timer = setTimeout(() => fail(new ConversionStalledError()), currentTimeoutMs);
  };
  const stop = () => {
    isStopped = true;
    pause();
  };

  progressed();
  return { stalled, progressed, pause, stop };
}

/**
 * When the stall watch changes pace, from each track's first and end timestamps (seconds):
 * progress is the slowest track's, so it stops at the shortest track's end (relative to
 * the conversion's start, as mediabunny reports it), and from there the watch allows for
 * the rest of the longer tracks, the encoder's flush and writing the file. Empty tracks
 * are left out.
 */
export function stallWatchPlan(
  tracks: { start: number; end: number }[],
  timeoutMs = STALL_TIMEOUT_MS,
) {
  const conversionStart = Math.max(0, Math.min(...tracks.map((track) => track.start)));
  const ends = tracks
    .filter((track) => track.end > track.start)
    .map((track) => track.end - conversionStart);
  const shortestEnd = Math.min(...ends);
  const spreadSeconds = Math.max(...ends) - shortestEnd;
  return {
    finalFrom: shortestEnd - TRACK_END_TOLERANCE_S,
    finalTimeoutMs: timeoutMs + spreadSeconds * 1000 * SLOW_ENCODE_FACTOR,
  };
}

async function planFor(tracks: InputTrack[]) {
  const timestamps = await Promise.all(
    tracks.map(async (track) => ({
      start: await track.getFirstTimestamp(),
      end: await track.computeDuration(),
    })),
  );
  return stallWatchPlan(timestamps);
}

/**
 * Runs the conversion under the stall watch; cancels it when `signal` aborts or it stalls.
 * A hidden WebView (Zalo in the background) runs timers late and may still report a frame
 * or two, so the watch pauses while hidden and counts again from the return.
 */
async function executeWatched(conversion: Conversion, { onProgress, signal }: ConvertVideoOptions) {
  const plan = await planFor(conversion.utilizedTracks);
  signal.throwIfAborted();

  const cancel = () => void conversion.cancel();
  signal.addEventListener('abort', cancel, { once: true });

  const watch = watchForStall();
  conversion.onProgress = (progress, processedTime) => {
    if (!document.hidden) {
      watch.progressed(processedTime >= plan.finalFrom ? plan.finalTimeoutMs : undefined);
    }
    onProgress(progress);
  };
  const handleVisibility = () => {
    if (document.hidden) {
      watch.pause();
    } else {
      watch.progressed();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

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
    document.removeEventListener('visibilitychange', handleVisibility);
    signal.removeEventListener('abort', cancel);
  }
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

    await executeWatched(conversion, options);

    if (!target.buffer) {
      throw new Error('conversion produced no file');
    }
    return new Blob([target.buffer], { type: VideoFormat.Mp4 });
  } finally {
    input.dispose();
  }
}
