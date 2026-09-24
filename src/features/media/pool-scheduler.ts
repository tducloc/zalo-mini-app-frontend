/**
 * Decides which image may start next, and on which worker.
 *
 * Two independent limits (see R3 in plans/create-listing.md):
 *  - CPU: at most `perWorker` images in flight on each of the workers;
 *  - memory: the decoded bitmaps of the images in flight must fit `budgetBytes`.
 * An image larger than the whole budget still runs, but only when nothing else is
 * running, so one huge photo never shares memory with another.
 */

import type { ImageDimensions } from '@/features/media/image-dimensions';

export type PoolConfig = {
  workers: number;
  perWorker: number;
  /** Omit to limit by count only. */
  budgetBytes?: number;
};

export type PoolState = {
  /** Images in flight on each worker, by worker index. */
  inFlight: number[];
  bytesInFlight: number;
};

const BYTES_PER_PIXEL = 4;
export const MAX_EDGE = 1280;

/** Used when the header cannot be read: a 24 MP photo, the iPhone 15+ default. */
export const UNKNOWN_IMAGE_DIMENSIONS: ImageDimensions = { width: 5712, height: 4284 };

/**
 * Peak memory of one job: the decoded bitmap plus the output canvas.
 * With `decodeWidth`, the decoder is asked for a bitmap that many pixels wide.
 */
export function estimateJobBytes(dimensions: ImageDimensions | null, decodeWidth?: number): number {
  const { width, height } = dimensions ?? UNKNOWN_IMAGE_DIMENSIONS;

  const decodeScale = decodeWidth && width > decodeWidth ? decodeWidth / width : 1;
  const bitmapBytes =
    Math.round(width * decodeScale) * Math.round(height * decodeScale) * BYTES_PER_PIXEL;

  const outputScale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvasBytes =
    Math.round(width * outputScale) * Math.round(height * outputScale) * BYTES_PER_PIXEL;

  return bitmapBytes + canvasBytes;
}

/** Returns the worker index to start the job on, or null to keep it queued. */
export function pickWorker(state: PoolState, jobBytes: number, config: PoolConfig): number | null {
  const running = state.inFlight.reduce((total, count) => total + count, 0);

  let chosen: number | null = null;
  for (let index = 0; index < config.workers; index += 1) {
    const load = state.inFlight[index] ?? 0;
    if (load < config.perWorker && (chosen === null || load < state.inFlight[chosen])) {
      chosen = index;
    }
  }

  if (chosen === null) {
    return null;
  }

  const fitsBudget =
    config.budgetBytes === undefined || state.bytesInFlight + jobBytes <= config.budgetBytes;
  return running === 0 || fitsBudget ? chosen : null;
}
