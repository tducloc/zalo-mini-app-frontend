/**
 * What the page and the image worker send each other. Imported by both sides; the worker
 * gets its own bundled copy (see vite-plugins/worker-source.ts), so keep this file free of
 * anything that touches the DOM.
 */

/** Long edge of the uploaded photo. The server scales anything larger to the same size. */
export const MAX_EDGE = 1280;

/** JPEG only, decided 2026-09-24: WebP was not smaller at the quality product photos need. */
export const JPEG_QUALITY = 0.85;

export enum PipelineStep {
  Decode = 'decode',
  Draw = 'draw',
  Encode = 'encode',
}

export interface ImageJobOptions {
  /** Decode straight to this width (createImageBitmap resizeWidth). */
  decodeWidth?: number;
  /** Force the draw to finish before timing it. Media lab only. */
  flushDraw?: boolean;
}

export interface ImageJob {
  id: number;
  file: Blob;
  options: ImageJobOptions;
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
