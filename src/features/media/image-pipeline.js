/**
 * Image optimisation pipeline. Types live in image-pipeline.d.ts.
 *
 * Deliberately PLAIN JAVASCRIPT, not TypeScript. The worker is built by reading this
 * file's own source with `?raw`, stripping the `export` keywords and handing it to a
 * Blob - which means the file has to be runnable as-is. That is also why it uses no
 * imports: everything it needs is in this one file.
 *
 * The result is one implementation running in two hosts: OffscreenCanvas inside the
 * worker, HTMLCanvasElement on the main thread.
 */

export const MAX_EDGE = 1280;
export const QUALITY = 0.82;
export const THUMB_EDGE = 400;
export const THUMB_QUALITY = 0.8;

export const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

/**
 * blob.type cannot be trusted. canvas.toBlob silently falls back to PNG for a format it
 * cannot encode, and Safari has been observed labelling those PNG bytes as image/avif.
 * The file's own magic bytes are the only reliable answer.
 */
export async function sniffFormat(blob) {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = (start, length) =>
    String.fromCharCode(...Array.from(head.slice(start, start + length)));

  if (head[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4);
    return brand === 'avif' || brand === 'avis' ? 'image/avif' : `iso-bmff/${brand}`;
  }
  return 'unknown';
}

function makeCanvas(width, height) {
  if (hasOffscreenCanvas) return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function toBlob(canvas, type, quality) {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality }).catch(() => null);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Safari keeps canvases alive after they go out of scope, so shrink before dropping. */
function releaseCanvas(canvas) {
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext('2d')?.clearRect(0, 0, 1, 1);
}

let cachedFormat = null;

/** Detect once per context, verified by magic bytes rather than blob.type. */
export async function detectFormat() {
  if (cachedFormat) return cachedFormat;
  const canvas = makeCanvas(8, 8);
  const probe = await toBlob(canvas, 'image/webp', 0.8);
  releaseCanvas(canvas);
  cachedFormat = probe && (await sniffFormat(probe)) === 'image/webp' ? 'image/webp' : 'image/jpeg';
  return cachedFormat;
}

async function drawScaled(bitmap, width, height, cover) {
  const canvas = makeCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2d context unavailable');
  context.imageSmoothingQuality = 'high';

  if (cover) {
    // Centre crop: take the largest centred square of the source.
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, width, height);
  } else {
    context.drawImage(bitmap, 0, 0, width, height);
  }
  return canvas;
}

export async function optimizeImage(file, options) {
  const format = await detectFormat();
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
    createImageBitmap(file),
  );

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = await drawScaled(bitmap, width, height, false);
    const encoded = await toBlob(canvas, format, QUALITY);
    releaseCanvas(canvas);

    let thumbnail;
    if (options.isMain) {
      const thumbCanvas = await drawScaled(bitmap, THUMB_EDGE, THUMB_EDGE, true);
      const thumbBlob = await toBlob(thumbCanvas, format, THUMB_QUALITY);
      releaseCanvas(thumbCanvas);
      if (thumbBlob) {
        thumbnail = { blob: thumbBlob, width: THUMB_EDGE, height: THUMB_EDGE };
      }
    }

    // Never ship a file bigger than the one we were handed. This has already caught a
    // real case where a failed WebP encode came back as a larger PNG.
    if (!encoded || encoded.size >= file.size) {
      return {
        blob: file,
        width: bitmap.width,
        height: bitmap.height,
        format: await sniffFormat(file),
        keptOriginal: true,
        thumbnail,
      };
    }

    return {
      blob: encoded,
      width,
      height,
      format: await sniffFormat(encoded),
      keptOriginal: false,
      thumbnail,
    };
  } finally {
    bitmap.close?.();
  }
}
