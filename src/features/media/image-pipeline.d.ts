export declare const MAX_EDGE: number;
export declare const QUALITY: number;
export declare const THUMB_EDGE: number;
export declare const THUMB_QUALITY: number;
export declare const hasOffscreenCanvas: boolean;

export type OptimizeResult = {
  blob: Blob;
  width: number;
  height: number;
  format: string;
  /** True when the original was already smaller and we kept it untouched. */
  keptOriginal: boolean;
  thumbnail?: { blob: Blob; width: number; height: number };
  /** Wall time of each step inside the pipeline, in ms. */
  timings: { decodeMs: number; drawMs: number; encodeMs: number };
};

export type PipelineStep = 'decode' | 'draw' | 'encode';

export type OptimizeOptions = {
  isMain: boolean;
  /** Decode straight to this width (createImageBitmap resizeWidth). */
  decodeWidth?: number;
  /** Force the draw to finish before timing it. Media lab only. */
  flushDraw?: boolean;
};

export declare function sniffFormat(blob: Blob): Promise<string>;
export declare function detectFormat(): Promise<'image/webp' | 'image/jpeg'>;
/** Rejects with an Error carrying `step` when decoding or drawing fails. */
export declare function optimizeImage(
  file: Blob,
  options: OptimizeOptions,
): Promise<OptimizeResult>;
