import { describe, expect, it } from 'vitest';

import type { OptimizedImage } from '@/features/media/image-worker-protocol';
import { FallbackReason, type ImageOutcome, ImageQueue } from '@/features/media/image-queue';
import { PipelineError, type PipelineWorker } from '@/features/media/optimize-image';
import type { PoolConfig } from '@/features/media/pool-scheduler';
import { PipelineStep } from '@/features/media/image-worker-protocol';

const MB = 1024 * 1024;
const PHOTO_12MP = { width: 4032, height: 3024 };

interface FakeJob {
  file: Blob;
  resolve: (image: OptimizedImage) => void;
  reject: (error: Error) => void;
}

/** Stands in for the image worker: each photo waits until the test answers it. */
class FakeWorker implements PipelineWorker {
  jobs: FakeJob[] = [];
  private disposed = false;

  run = (file: Blob) =>
    new Promise<OptimizedImage>((resolve, reject) => {
      this.jobs.push({ file, resolve, reject });
    });

  dispose = () => {
    this.disposed = true;
  };

  isDisposed = () => this.disposed;

  succeed(index = 0) {
    const [job] = this.jobs.splice(index, 1);
    job.resolve(optimized(job.file));
  }

  fail(index = 0) {
    const [job] = this.jobs.splice(index, 1);
    job.reject(new PipelineError('decode failed', PipelineStep.Decode));
  }

  /** What the real worker does on `onerror`: every photo it had is rejected, it is gone. */
  crash() {
    this.disposed = true;
    for (const job of this.jobs.splice(0)) {
      job.reject(new PipelineError('image worker crashed'));
    }
  }
}

function optimized(file: Blob): OptimizedImage {
  return {
    blob: file,
    width: 1280,
    height: 960,
    keptOriginal: false,
    timings: { decodeMs: 0, drawMs: 0, encodeMs: 0 },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(config: PoolConfig = { workers: 1, perWorker: 2, budgetBytes: 150 * MB }) {
  const workers: FakeWorker[] = [];
  const queue = new ImageQueue(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  }, config);

  const outcomes = new Map<string, ImageOutcome>();
  const add = (id: string, dimensions = PHOTO_12MP) => {
    void queue.optimize(id, new Blob([id]), dimensions).then((outcome) => {
      outcomes.set(id, outcome);
    });
  };
  const current = () => workers[workers.length - 1];
  const sentIds = (worker: FakeWorker) => Promise.all(worker.jobs.map((job) => job.file.text()));

  return { queue, workers, outcomes, add, current, sentIds };
}

describe('image queue', () => {
  it('runs two photos at a time and starts the next as one finishes', async () => {
    const { add, current, sentIds, outcomes } = setup();
    ['a', 'b', 'c'].forEach((id) => add(id));

    expect(await sentIds(current())).toEqual(['a', 'b']);

    current().succeed(0);
    await flush();
    expect(outcomes.get('a')?.kind).toBe('optimized');
    expect(await sentIds(current())).toEqual(['b', 'c']);
  });

  it('holds a photo whose decoded size would not fit the memory budget', async () => {
    const { add, current, sentIds } = setup({ workers: 1, perWorker: 3, budgetBytes: 150 * MB });
    ['a', 'b', 'c'].forEach((id) => add(id));

    // Two 12 MP photos are ~107 MB decoded; a third would pass 150 MB.
    expect(await sentIds(current())).toEqual(['a', 'b']);
  });

  it('runs a photo larger than the whole budget, but alone', async () => {
    const { add, current, sentIds } = setup({ workers: 1, perWorker: 2, budgetBytes: 50 * MB });
    add('huge', { width: 8000, height: 6000 });
    add('small', { width: 1000, height: 1000 });

    expect(await sentIds(current())).toEqual(['huge']);
    current().succeed();
    await flush();
    expect(await sentIds(current())).toEqual(['small']);
  });

  it('tries a failed photo once more on its own, then uses the original', async () => {
    const { add, current, sentIds, outcomes } = setup();
    ['a', 'b', 'c'].forEach((id) => add(id));

    current().fail(0);
    await flush();
    // The retry waits for b to finish, and c waits for the retry.
    expect(await sentIds(current())).toEqual(['b']);
    current().succeed(0);
    await flush();
    expect(await sentIds(current())).toEqual(['a']);

    current().fail(0);
    await flush();
    expect(outcomes.get('a')).toEqual({ kind: 'original', reason: FallbackReason.FailedTwice });
    expect(await sentIds(current())).toEqual(['c']);
  });

  it('gives the unfinished photos to one new worker after a crash, one at a time', async () => {
    const { add, workers, current, sentIds, outcomes } = setup();
    ['a', 'b', 'c'].forEach((id) => add(id));

    workers[0].crash();
    await flush();
    expect(workers).toHaveLength(2);
    expect(await sentIds(current())).toEqual(['a']);

    current().succeed();
    await flush();
    expect(outcomes.get('a')?.kind).toBe('optimized');
    expect(await sentIds(current())).toEqual(['b']);
  });

  it('uses the originals for everything left when the new worker crashes too', async () => {
    const { add, workers, outcomes } = setup();
    ['a', 'b', 'c'].forEach((id) => add(id));

    workers[0].crash();
    await flush();
    workers[1].crash();
    await flush();
    add('d');
    await flush();

    const crashed = { kind: 'original', reason: FallbackReason.WorkerCrashed };
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(outcomes.get(id)).toEqual(crashed);
    }
    expect(workers).toHaveLength(2);
  });

  it('drops a removed photo, keeping its memory counted until the worker answers', async () => {
    const { queue, add, current, sentIds, outcomes } = setup();
    ['a', 'b', 'c', 'd'].forEach((id) => add(id));

    queue.cancel('c');
    queue.cancel('a');
    await flush();
    expect(outcomes.get('a')).toEqual({ kind: 'cancelled' });
    expect(outcomes.get('c')).toEqual({ kind: 'cancelled' });
    expect(await sentIds(current())).toEqual(['a', 'b']);

    current().succeed(0);
    await flush();
    expect(outcomes.get('a')).toEqual({ kind: 'cancelled' });
    expect(await sentIds(current())).toEqual(['b', 'd']);
  });

  it('stops the worker when the queue is empty, without counting it as a crash', async () => {
    const { add, workers, current, outcomes } = setup();
    add('a');
    current().succeed();
    await flush();
    expect(workers[0].isDisposed()).toBe(true);

    add('b');
    workers[1].crash();
    await flush();
    add('c');
    await flush();
    current().succeed();
    await flush();

    expect(outcomes.get('b')?.kind).toBe('optimized');
    expect(workers).toHaveLength(3);
  });
});
