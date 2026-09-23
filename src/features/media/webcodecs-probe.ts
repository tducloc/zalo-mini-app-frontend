/**
 * WebCodecs feasibility probe.
 *
 * Answers "is a client-side transcode worth building" BEFORE building it, and without a
 * demuxer. Two questions:
 *
 *  1. Does this device support an H.264 720p encoder config at all, and is it hardware
 *     accelerated? isConfigSupported is async and per-config, so a boolean check is not
 *     enough - we ask about the exact config we would ship.
 *  2. How many frames per second can it actually encode and decode? That number decides
 *     everything: a 45s clip at 30fps is 1350 frames, so 200 fps means a 7 second
 *     transcode and 25 fps means 54 seconds.
 *
 * Synthetic frames are drawn on a canvas, so no mp4box and no real file are needed. The
 * encoder's own output is fed back into a decoder, which measures the decode leg too.
 */

export type ConfigProbe = {
  label: string;
  codec: string;
  supported: boolean;
  hardwareAcceleration?: string;
  note?: string;
};

export type EncodeBenchmark = {
  frames: number;
  encodeMs: number;
  encodeFps: number;
  decodeMs: number;
  decodeFps: number;
  bytes: number;
  /** Estimated seconds to transcode a 45s 30fps clip, both legs together. */
  estimate45sSeconds: number;
};

const WIDTH = 1280;
const HEIGHT = 720;
const BITRATE = 2_000_000;
const FRAMERATE = 30;
const BENCH_FRAMES = 120;

const CANDIDATES: { label: string; codec: string }[] = [
  { label: 'H.264 Baseline 3.1', codec: 'avc1.42001f' },
  { label: 'H.264 Main 3.1', codec: 'avc1.4d401f' },
  { label: 'H.264 High 4.0', codec: 'avc1.640028' },
  { label: 'VP8', codec: 'vp8' },
  { label: 'VP9', codec: 'vp09.00.10.08' },
];

export const hasWebCodecs =
  typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';

function baseConfig(codec: string): VideoEncoderConfig {
  return {
    codec,
    width: WIDTH,
    height: HEIGHT,
    bitrate: BITRATE,
    framerate: FRAMERATE,
    hardwareAcceleration: 'prefer-hardware',
  };
}

export async function probeConfigs(): Promise<ConfigProbe[]> {
  if (!hasWebCodecs) {
    return [{ label: 'WebCodecs', codec: '-', supported: false, note: 'API not available' }];
  }

  const results: ConfigProbe[] = [];
  for (const candidate of CANDIDATES) {
    try {
      const support = await VideoEncoder.isConfigSupported(baseConfig(candidate.codec));
      results.push({
        label: candidate.label,
        codec: candidate.codec,
        supported: Boolean(support.supported),
        hardwareAcceleration: support.config?.hardwareAcceleration,
      });
    } catch (error) {
      results.push({
        label: candidate.label,
        codec: candidate.codec,
        supported: false,
        note: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Audio matters as much as video - WebCodecs does not mux, and dropping the audio leg
  // is how naive transcoders silently ship muted video.
  if (typeof AudioEncoder !== 'undefined') {
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 44100,
        numberOfChannels: 2,
        bitrate: 96_000,
      });
      results.push({
        label: 'AAC audio',
        codec: 'mp4a.40.2',
        supported: Boolean(support.supported),
      });
    } catch {
      results.push({ label: 'AAC audio', codec: 'mp4a.40.2', supported: false });
    }
  } else {
    results.push({
      label: 'AAC audio',
      codec: 'mp4a.40.2',
      supported: false,
      note: 'AudioEncoder missing',
    });
  }

  return results;
}

/** Draws a moving pattern so the encoder has real motion to compress, not a static frame. */
function drawFrame(context: CanvasRenderingContext2D, index: number) {
  const shift = (index * 9) % WIDTH;
  context.fillStyle = '#123';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < 24; i += 1) {
    context.fillStyle = `hsl(${(i * 15 + index * 3) % 360} 70% 55%)`;
    context.fillRect((shift + i * 53) % WIDTH, (i * 31 + index) % HEIGHT, 90, 60);
  }
}

export async function benchmarkTranscode(codec: string): Promise<EncodeBenchmark> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2d context unavailable');

  const chunks: EncodedVideoChunk[] = [];
  let decoderConfig: VideoDecoderConfig | undefined;
  let bytes = 0;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      if (metadata?.decoderConfig) decoderConfig = metadata.decoderConfig;
      chunks.push(chunk);
      bytes += chunk.byteLength;
    },
    error: (error) => {
      throw error;
    },
  });
  encoder.configure(baseConfig(codec));

  const encodeStarted = performance.now();
  for (let i = 0; i < BENCH_FRAMES; i += 1) {
    drawFrame(context, i);
    const frame = new VideoFrame(canvas, { timestamp: (i * 1_000_000) / FRAMERATE });
    // Keyframe every 2 seconds, the same cadence a real transcode would use.
    encoder.encode(frame, { keyFrame: i % (FRAMERATE * 2) === 0 });
    frame.close();
    // Do not let the queue grow without bound - that is what blows up memory on mobile.
    if (encoder.encodeQueueSize > 8) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  await encoder.flush();
  const encodeMs = Math.round(performance.now() - encodeStarted);
  encoder.close();

  let decodeMs = 0;
  if (decoderConfig) {
    let decoded = 0;
    const decoder = new VideoDecoder({
      output: (frame) => {
        decoded += 1;
        frame.close();
      },
      error: (error) => {
        throw error;
      },
    });
    decoder.configure(decoderConfig);
    const decodeStarted = performance.now();
    for (const chunk of chunks) decoder.decode(chunk);
    await decoder.flush();
    decodeMs = Math.round(performance.now() - decodeStarted);
    decoder.close();
    if (decoded === 0) decodeMs = -1;
  }

  canvas.width = 1;
  canvas.height = 1;

  const encodeFps = Math.round((BENCH_FRAMES / encodeMs) * 1000);
  const decodeFps = decodeMs > 0 ? Math.round((BENCH_FRAMES / decodeMs) * 1000) : 0;
  const framesIn45s = 45 * FRAMERATE;
  const perFrameMs = encodeMs / BENCH_FRAMES + (decodeMs > 0 ? decodeMs / BENCH_FRAMES : 0);

  return {
    frames: BENCH_FRAMES,
    encodeMs,
    encodeFps,
    decodeMs,
    decodeFps,
    bytes,
    estimate45sSeconds: Math.round((framesIn45s * perFrameMs) / 100) / 10,
  };
}
