/**
 * Sends photos to the image worker one at a time, in the order they were picked (diagrams
 * 02 and 02b).
 *
 * - One at a time, decided 2026-09-25: only one full-size photo is ever decoded, so ten
 *   12 MP photos cannot run the WebView out of memory (P1), with no memory budget to
 *   tune. Photos that are done start uploading while the next one is shrunk.
 * - A photo the worker fails on, or that it had when it crashed, uses its original.
 * - A crash gets a new worker for the next photo; after a second one, every photo left
 *   uses its original.
 * - Nothing ever falls back to the main thread (decided 2026-09-24).
 */

import {
  ImageWorker,
  type OptimizedImage,
  PipelineError,
} from '@/features/media/image/image-worker';

/** The first crash gets a new worker; the second ends optimizing for this session. */
const MAX_CRASHES = 2;

export enum FallbackReason {
  Failed = 'FAILED',
  WorkerCrashed = 'WORKER_CRASHED',
}

export type ImageOutcome =
  | { kind: 'optimized'; image: OptimizedImage }
  | { kind: 'original'; reason: FallbackReason }
  | { kind: 'cancelled' };

interface Job {
  id: string;
  file: Blob;
  settle: (outcome: ImageOutcome) => void;
}

/** What the queue needs from a worker; tests pass a fake. */
export type QueueWorker = Pick<ImageWorker, 'run' | 'dispose' | 'isDisposed'>;

export class ImageQueue {
  private readonly waiting: Job[] = [];
  private current: Job | null = null;
  private worker: QueueWorker | null = null;
  private crashes = 0;

  constructor(private readonly createWorker: () => QueueWorker = () => new ImageWorker()) {}

  optimize(id: string, file: Blob) {
    return new Promise<ImageOutcome>((settle) => {
      this.waiting.push({ id, file, settle });
      void this.runNext();
    });
  }

  /** Settles the photo as cancelled; a result that still arrives is dropped. */
  cancel(id: string) {
    const index = this.waiting.findIndex((job) => job.id === id);
    if (index >= 0) {
      this.waiting.splice(index, 1)[0].settle({ kind: 'cancelled' });
    }
    if (this.current?.id === id) {
      this.current.settle({ kind: 'cancelled' });
    }
  }

  private async runNext() {
    const job = this.current ? undefined : this.waiting.shift();
    if (!job) {
      return;
    }

    this.current = job;
    job.settle(await this.process(job.file));
    this.current = null;

    if (this.waiting.length > 0) {
      void this.runNext();
    } else {
      // A worker holds a few MB even when idle; the next photo starts a fresh one.
      this.worker?.dispose();
      this.worker = null;
    }
  }

  private async process(file: Blob): Promise<ImageOutcome> {
    if (this.crashes >= MAX_CRASHES) {
      return { kind: 'original', reason: FallbackReason.WorkerCrashed };
    }

    try {
      this.worker ??= this.createWorker();
    } catch {
      // The WebView would not start a worker at all; no point trying for the next photo.
      this.crashes = MAX_CRASHES;
      return { kind: 'original', reason: FallbackReason.WorkerCrashed };
    }

    const worker = this.worker;
    try {
      return { kind: 'optimized', image: await worker.run(file) };
    } catch (error) {
      const isCrash = error instanceof PipelineError && error.step === null && worker.isDisposed();
      if (!isCrash) {
        return { kind: 'original', reason: FallbackReason.Failed };
      }
      this.crashes += 1;
      this.worker = null;
      return { kind: 'original', reason: FallbackReason.WorkerCrashed };
    }
  }
}
