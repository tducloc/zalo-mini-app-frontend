/**
 * Sends photos to the image worker one at a time, in the order they were picked (diagrams
 * 02 and 02b). p-queue keeps the line; this class keeps the worker.
 *
 * - One at a time, decided 2026-09-25: only one full-size photo is ever decoded, so ten
 *   12 MP photos cannot run the WebView out of memory (P1), with no memory budget to
 *   tune. Photos that are done start uploading while the next one is shrunk.
 * - A photo processing error uses its original. A worker crash retries the same photo
 *   once with a new worker, then uses its original if it still fails.
 * - Every next photo is attempted regardless of earlier failures.
 * - Nothing ever falls back to the main thread (decided 2026-09-24).
 */

import PQueue from 'p-queue';

import { ImageWorker, PipelineError } from '@/features/media/services/image-worker';
import type { OptimizedImage } from '@/features/media/types/image';

export type ImageOutcome = { kind: 'optimized'; image: OptimizedImage } | { kind: 'original' };

/** What the queue needs from a worker; tests pass a fake. */
export type QueueWorker = Pick<ImageWorker, 'run' | 'dispose' | 'isDisposed'>;

/** One initial attempt and one retry after a worker crash. */
const MAX_IMAGE_ATTEMPTS = 2;

const ORIGINAL: ImageOutcome = { kind: 'original' };

export class ImageQueue {
  private readonly queue = new PQueue({ concurrency: 1 });
  private worker: QueueWorker | null = null;

  constructor(private readonly createWorker: () => QueueWorker = () => new ImageWorker()) {
    // A worker holds a few MB even when idle; the next photo starts a fresh one.
    this.queue.on('idle', () => {
      this.worker?.dispose();
      this.worker = null;
    });
  }

  /**
   * Rejects with the abort reason for a photo removed while it waits, so it is never
   * decoded. A photo removed while in the worker still settles with the result, which the
   * caller drops.
   */
  optimize(file: Blob, signal: AbortSignal): Promise<ImageOutcome> {
    // Not given to p-queue as its signal: p-queue would free the slot at once, and the
    // next photo would be decoded while the worker still has the removed one.
    return this.queue.add(() => {
      signal.throwIfAborted();
      return this.process(file, signal);
    });
  }

  private async process(file: Blob, signal: AbortSignal): Promise<ImageOutcome> {
    for (let attempt = 0; attempt < MAX_IMAGE_ATTEMPTS; attempt += 1) {
      signal.throwIfAborted();

      try {
        this.worker ??= this.createWorker();
      } catch {
        return ORIGINAL;
      }

      const worker = this.worker;
      try {
        return { kind: 'optimized', image: await worker.run(file) };
      } catch (error) {
        const isCrash =
          error instanceof PipelineError && error.step === null && worker.isDisposed();
        if (!isCrash) {
          return ORIGINAL;
        }
        this.worker = null;
      }
    }

    return ORIGINAL;
  }
}
