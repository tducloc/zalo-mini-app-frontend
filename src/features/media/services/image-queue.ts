/**
 * Sends photos to the image worker one at a time, in the order they were picked (diagrams
 * 02 and 02b). p-queue keeps the line; this class keeps the worker.
 *
 * - One at a time, decided 2026-09-25: only one full-size photo is ever decoded, so ten
 *   12 MP photos cannot run the WebView out of memory (P1), with no memory budget to
 *   tune. Photos that are done start uploading while the next one is shrunk.
 * - A photo the worker fails on, or that it had when it crashed, uses its original.
 * - A crash gets a new worker for the next photo; after a second one, every photo left
 *   uses its original.
 * - Nothing ever falls back to the main thread (decided 2026-09-24).
 */

import PQueue from 'p-queue';

import { ImageWorker, PipelineError } from '@/features/media/services/image-worker';
import type { OptimizedImage } from '@/features/media/types/image';

export type ImageOutcome = { kind: 'optimized'; image: OptimizedImage } | { kind: 'original' };

/** What the queue needs from a worker; tests pass a fake. */
export type QueueWorker = Pick<ImageWorker, 'run' | 'dispose' | 'isDisposed'>;

/** The first crash gets a new worker; the second ends optimizing for this session. */
const MAX_CRASHES = 2;

const ORIGINAL: ImageOutcome = { kind: 'original' };

export class ImageQueue {
  private readonly queue = new PQueue({ concurrency: 1 });
  private worker: QueueWorker | null = null;
  private crashes = 0;

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
      return this.process(file);
    });
  }

  private async process(file: Blob): Promise<ImageOutcome> {
    if (this.crashes >= MAX_CRASHES) {
      return ORIGINAL;
    }

    try {
      this.worker ??= this.createWorker();
    } catch {
      // The WebView would not start a worker at all; no point trying for the next photo.
      this.crashes = MAX_CRASHES;
      return ORIGINAL;
    }

    const worker = this.worker;
    try {
      return { kind: 'optimized', image: await worker.run(file) };
    } catch (error) {
      const isCrash = error instanceof PipelineError && error.step === null && worker.isDisposed();
      if (isCrash) {
        this.crashes += 1;
        this.worker = null;
      }
      return ORIGINAL;
    }
  }
}
