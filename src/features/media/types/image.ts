/** Photos: formats, sizes, and the messages to and from the image worker. */

/**
 * The photo formats the app takes (plans/create-listing.md, "Supported formats"): every
 * WebView the app supports decodes them, so the phone can shrink them in the worker, and
 * the server's sharp reads them. HEIC is left out: Android cannot decode it and sharp's
 * prebuilt libvips has no HEVC decoder. Also the Content-Type of the upload.
 */
export enum ImageFormat {
  Jpeg = 'image/jpeg',
  Png = 'image/png',
  Webp = 'image/webp',
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface PhotoHeader extends ImageDimensions {
  /** Null for an image in a format the app does not take (HEIC, GIF, …). */
  format: ImageFormat | null;
}

// ---- Messages between the page and the worker thread ----

export type PipelineStep = 'decode' | 'draw' | 'encode';

export interface ImageSettings {
  maxEdge: number;
  quality: number;
  /** Decode straight to this width (createImageBitmap resizeWidth). Media lab only. */
  decodeWidth?: number;
  /** Force the draw to finish before timing it. Media lab only. */
  shouldFlushDraw?: boolean;
}

export interface ImageJob {
  id: number;
  file: Blob;
  settings: ImageSettings;
}

export interface OptimizedImage {
  /** A 1280 px JPEG, or the file itself when the JPEG was not smaller. */
  blob: Blob;
  width: number;
  height: number;
  keptOriginal: boolean;
  /** Wall time of each step inside the worker, in ms. */
  timings: { decodeMs: number; drawMs: number; encodeMs: number };
}

export type ImageReply =
  | { id: number; ok: true; result: OptimizedImage }
  | { id: number; ok: false; error: string; step: PipelineStep | null };
