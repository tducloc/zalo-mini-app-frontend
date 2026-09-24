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
};

export declare function sniffFormat(blob: Blob): Promise<string>;
export declare function detectFormat(): Promise<'image/webp' | 'image/jpeg'>;
export declare function optimizeImage(
  file: Blob,
  options: { isMain: boolean },
): Promise<OptimizeResult>;
