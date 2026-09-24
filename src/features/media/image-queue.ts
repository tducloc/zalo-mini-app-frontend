/**
 * The queue of photos waiting for the image worker (diagrams 02 and 02b).
 *
 * - Memory decides how many run at once (pool-scheduler.ts, R3): P1 was every photo decoded
 *   at the same time, which can crash the WebView.
 * - A photo the worker fails on is tried once more, alone; then the original is used.
 * - When the worker crashes, one new worker takes the unfinished photos, one at a time.
 *   If that one crashes too, every photo left uses its original.
 * - Nothing ever falls back to the main thread (decided 2026-09-24).
 */

import type { ImageDimensions } from '@/features/media/image-dimensions';
import type { OptimizedImage } from '@/features/media/image-worker-protocol';
import {
  createPipelineWorker,
  PipelineError,
  type PipelineWorker,
} from '@/features/media/optimize-image';
import { estimateJobBytes, pickWorker, type PoolConfig } from '@/features/media/pool-scheduler';

const MIB = 1024 * 1024;

/** Starting values from R3; the phone runs in the media lab pick the final ones. */
export const DEFAULT_POOL_CONFIG: PoolConfig = { workers: 1, perWorker: 2, budgetBytes: 150 * MIB };

/** The first crash gets a new worker; the second ends optimizing for this session. */
const MAX_CRASHES = 2;
const MAX_ATTEMPTS = 2;

export enum FallbackReason {
  FailedTwice = 'FAILED_TWICE',
  WorkerCrashed = 'WORKER_CRASHED',
}

export type ImageOutcome =
  | { kind: 'optimized'; image: OptimizedImage }
  | { kind: 'original'; reason: FallbackReason }
  | { kind: 'cancelled' };

interface Job {
  id: string;
  /** Pick order; a photo sent back to the queue goes back to its place. */
  order: number;
  file: Blob;
  costBytes: number;
  attempt: number;
  settle: (outcome: ImageOutcome) => void;
}

interface RunningJob extends Job {
  workerIndex: number;
  worker: PipelineWorker;
  /** Removed while the worker had it: its slot stays taken until the worker answers. */
  isCancelled: boolean;
}

export class ImageQueue {
  private readonly waiting: Job[] = [];
  private readonly running = new Map<string, RunningJob>();
  private readonly workers: (PipelineWorker | null)[];

  private jobCount = 0;
  private crashes = 0;
  /** Drops to one photo at a time after a crash. */
  private perWorker: number;

  constructor(
    private readonly createWorker: () => PipelineWorker = createPipelineWorker,
    private readonly config: PoolConfig = DEFAULT_POOL_CONFIG,
  ) {
    this.workers = Array.from({ length: config.workers }, () => null);
    this.perWorker = config.perWorker;
  }

  optimize(id: string, file: Blob, dimensions: ImageDimensions | null) {
    return new Promise<ImageOutcome>((settle) => {
      if (this.hasGivenUp()) {
        settle({ kind: 'original', reason: FallbackReason.WorkerCrashed });
        return;
      }
      this.waiting.push({
        id,
        order: ++this.jobCount,
        file,
        costBytes: estimateJobBytes(dimensions),
        attempt: 1,
        settle,
      });
      this.pump();
    });
  }

  /** Settles the photo as cancelled; a result that still arrives is dropped. */
  cancel(id: string) {
    const index = this.waiting.findIndex((job) => job.id === id);
    if (index >= 0) {
      this.waiting.splice(index, 1)[0].settle({ kind: 'cancelled' });
      return;
    }

    const entry = this.running.get(id);
    if (entry && !entry.isCancelled) {
      entry.isCancelled = true;
      entry.settle({ kind: 'cancelled' });
    }
  }

  private hasGivenUp() {
    return this.crashes >= MAX_CRASHES;
  }

  private pump() {
    while (this.waiting.length > 0) {
      if (this.hasGivenUp()) {
        this.fallBackWaiting();
        return;
      }
      const workerIndex = this.nextSlot(this.waiting[0]);
      if (workerIndex === null) {
        return;
      }
      this.start(this.waiting.shift() as Job, workerIndex);
    }
  }

  /** Index of the worker the next photo may start on, or null to keep it waiting. */
  private nextSlot(job: Job) {
    const runningJobs = [...this.running.values()];
    // A retry runs alone, and nothing joins it.
    if (runningJobs.some((other) => other.attempt > 1)) {
      return null;
    }
    if (job.attempt > 1) {
      return runningJobs.length === 0 ? 0 : null;
    }

    const inFlight = this.workers.map(
      (_, index) => runningJobs.filter((other) => other.workerIndex === index).length,
    );
    const bytesInFlight = runningJobs.reduce((total, other) => total + other.costBytes, 0);
    return pickWorker({ inFlight, bytesInFlight }, job.costBytes, {
      ...this.config,
      perWorker: this.perWorker,
    });
  }

  private start(job: Job, workerIndex: number) {
    let worker: PipelineWorker;
    try {
      worker = this.workerAt(workerIndex);
    } catch {
      // The WebView would not start a worker at all; no point trying for the next photo.
      this.crashes = MAX_CRASHES;
      job.settle({ kind: 'original', reason: FallbackReason.WorkerCrashed });
      return;
    }

    const entry: RunningJob = { ...job, workerIndex, worker, isCancelled: false };
    this.running.set(job.id, entry);
    worker.run(job.file).then(
      (image) => this.finish(entry, { kind: 'optimized', image }),
      (error: unknown) => this.handleFailure(entry, error),
    );
  }

  private workerAt(index: number) {
    const existing = this.workers[index];
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    const worker = this.createWorker();
    this.workers[index] = worker;
    return worker;
  }

  private finish(entry: RunningJob, outcome: ImageOutcome | null) {
    this.running.delete(entry.id);
    if (outcome && !entry.isCancelled) {
      entry.settle(outcome);
    }
    this.pump();
    this.stopIdleWorkers();
  }

  private handleFailure(entry: RunningJob, error: unknown) {
    const isCrash =
      error instanceof PipelineError && error.step === null && entry.worker.isDisposed();

    if (isCrash) {
      this.countCrash(entry);
      if (this.hasGivenUp()) {
        this.finish(entry, { kind: 'original', reason: FallbackReason.WorkerCrashed });
        return;
      }
      // Unfinished, not failed: the same attempt again on the new worker.
      this.requeue(entry, entry.attempt);
      return;
    }

    if (entry.attempt >= MAX_ATTEMPTS) {
      this.finish(entry, { kind: 'original', reason: FallbackReason.FailedTwice });
      return;
    }
    this.requeue(entry, entry.attempt + 1);
  }

  /** Every photo the dead worker had reports it; count the crash once. */
  private countCrash(entry: RunningJob) {
    if (this.workers[entry.workerIndex] === entry.worker) {
      this.workers[entry.workerIndex] = null;
      this.crashes += 1;
      this.perWorker = 1;
    }
  }

  private requeue(entry: RunningJob, attempt: number) {
    if (!entry.isCancelled) {
      const { id, order, file, costBytes, settle } = entry;
      const index = this.waiting.findIndex((job) => job.order > order);
      const job = { id, order, file, costBytes, attempt, settle };
      this.waiting.splice(index < 0 ? this.waiting.length : index, 0, job);
    }
    this.finish(entry, null);
  }

  private fallBackWaiting() {
    for (const job of this.waiting.splice(0)) {
      job.settle({ kind: 'original', reason: FallbackReason.WorkerCrashed });
    }
  }

  /** A worker holds a few MB even when idle; the next photo starts a fresh one. */
  private stopIdleWorkers() {
    if (this.running.size > 0 || this.waiting.length > 0) {
      return;
    }
    this.workers.forEach((worker, index) => {
      worker?.dispose();
      this.workers[index] = null;
    });
  }
}
