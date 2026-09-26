/**
 * The memory model the pool bench (R3) runs its N workers × M photos with: how much one
 * photo in flight costs, and which worker may take the next one. Lab only since
 * 2026-09-25: the app now sends photos to one worker one at a time (image-queue.ts), so
 * it needs no budget; the bench still measures whether running more at once would pay.
 */

import { PHOTO_MAX_EDGE } from '@/features/media/constants/limits';
import type { ImageDimensions } from '@/features/media/types/image';

const BYTES_PER_PIXEL = 4;

export interface PoolConfig {
  workers: number;
  perWorker: number;
  /** Omit to limit by count only. */
  budgetBytes?: number;
}

export interface PoolState {
  /** Images in flight on each worker, by worker index. */
  inFlight: number[];
  bytesInFlight: number;
}

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

  const outputScale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
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
