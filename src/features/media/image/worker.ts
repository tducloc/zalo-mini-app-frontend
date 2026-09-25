/**
 * Runs inside the image worker thread, never on the main thread: decode the photo upright,
 * scale it down and encode it as JPEG, with the settings image-worker.ts sends each time.
 *
 * Bundled on its own into a string (vite-plugins/worker-source.ts), so it imports types
 * only and must not touch the DOM.
 */

import type {
  ImageJob,
  ImageReply,
  ImageSettings,
  OptimizedImage,
  PipelineStep,
} from '@/features/media/image/image-worker';

/** The parts of DedicatedWorkerGlobalScope used here; the project is typed with the DOM lib. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ImageJob>) => void) | null;
  postMessage: (reply: ImageReply) => void;
}

class StepError extends Error {
  constructor(
    readonly step: PipelineStep,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

function decode(file: Blob, decodeWidth?: number) {
  const options: ImageBitmapOptions = { imageOrientation: 'from-image' };
  if (decodeWidth) {
    // Asks the decoder for a smaller bitmap, so the full-size one is never allocated.
    options.resizeWidth = decodeWidth;
    options.resizeQuality = 'high';
  }
  return createImageBitmap(file, options);
}

function draw(bitmap: ImageBitmap, width: number, height: number, flush?: boolean) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2d context unavailable');
  }
  context.imageSmoothingQuality = 'high';
  // JPEG has no transparency: the encoder would turn transparent pixels black. White
  // matches what the server does with a transparent original.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if (flush) {
    // Chrome records drawImage and runs it at encode time; reading one pixel forces it to
    // finish now, so the lab times the real draw. It costs a sync readback.
    context.getImageData(0, 0, 1, 1);
  }
  return canvas;
}

/** Safari keeps canvases alive after they go out of scope, so shrink before dropping. */
function release(canvas: OffscreenCanvas) {
  canvas.width = 1;
  canvas.height = 1;
}

async function encode(canvas: OffscreenCanvas, quality: number) {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  // blob.type cannot be trusted: a platform that cannot encode a type silently returns PNG,
  // and Safari has been seen labelling it with the requested type. Check the bytes.
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (head[0] !== 0xff || head[1] !== 0xd8) {
    throw new Error(`encoder returned ${blob.type || 'unknown'} bytes, not JPEG`);
  }
  return blob;
}

async function timed<T>(step: PipelineStep, work: () => Promise<T> | T) {
  const started = performance.now();
  try {
    return { value: await work(), ms: performance.now() - started };
  } catch (error) {
    throw new StepError(step, error);
  }
}

async function optimizeImage(file: Blob, settings: ImageSettings): Promise<OptimizedImage> {
  const decoded = await timed('decode', () => decode(file, settings.decodeWidth));
  const bitmap = decoded.value;

  try {
    const scale = Math.min(1, settings.maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const drawn = await timed('draw', () => draw(bitmap, width, height, settings.flushDraw));
    const encoded = await timed('encode', () => encode(drawn.value, settings.quality)).finally(() =>
      release(drawn.value),
    );

    const timings = { decodeMs: decoded.ms, drawMs: drawn.ms, encodeMs: encoded.ms };
    // Never upload more than the seller picked: a small, well-compressed photo can come
    // back larger. The server still scales it and strips its metadata.
    if (encoded.value.size >= file.size) {
      return {
        blob: file,
        width: bitmap.width,
        height: bitmap.height,
        keptOriginal: true,
        timings,
      };
    }
    return { blob: encoded.value, width, height, keptOriginal: false, timings };
  } finally {
    bitmap.close();
  }
}

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event) => {
  const { id, file, settings } = event.data;
  try {
    scope.postMessage({ id, ok: true, result: await optimizeImage(file, settings) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      step: error instanceof StepError ? error.step : null,
    });
  }
};
