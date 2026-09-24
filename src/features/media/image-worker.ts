/**
 * Runs inside the image worker, never on the main thread: decode the photo upright, scale
 * it to 1280 px on the long side and encode it as JPEG. The page starts it from a string
 * (optimize-image.ts), so this file is bundled on its own and must not touch the DOM.
 */

import {
  type ImageJob,
  type ImageJobOptions,
  type ImageReply,
  JPEG_QUALITY,
  MAX_EDGE,
  type OptimizedImage,
  PipelineStep,
} from '@/features/media/image-worker-protocol';

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

async function encode(canvas: OffscreenCanvas) {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
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

async function optimizeImage(file: Blob, options: ImageJobOptions): Promise<OptimizedImage> {
  const decoded = await timed(PipelineStep.Decode, () => decode(file, options.decodeWidth));
  const bitmap = decoded.value;

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const drawn = await timed(PipelineStep.Draw, () =>
      draw(bitmap, width, height, options.flushDraw),
    );
    const encoded = await timed(PipelineStep.Encode, () => encode(drawn.value)).finally(() =>
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
  const { id, file, options } = event.data;
  try {
    scope.postMessage({ id, ok: true, result: await optimizeImage(file, options) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      step: error instanceof StepError ? error.step : null,
    });
  }
};
