import { describe, expect, it } from 'vitest';

import {
  ImageQueue,
  type ImageOutcome,
  type QueueWorker,
} from '@/features/media/services/image-queue';
import { PipelineError } from '@/features/media/services/image-worker';
import type { OptimizedImage } from '@/features/media/types/image';

interface FakeJob {
  file: Blob;
  resolve: (image: OptimizedImage) => void;
  reject: (error: Error) => void;
}

/** Stands in for the image worker: each photo waits until the test answers it. */
class FakeWorker implements QueueWorker {
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
    job.reject(new PipelineError('decode failed', 'decode'));
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

function setup() {
  const workers: FakeWorker[] = [];
  const queue = new ImageQueue(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });

  const outcomes = new Map<string, ImageOutcome | Error>();
  const removers = new Map<string, AbortController>();
  const add = (id: string) => {
    const controller = new AbortController();
    removers.set(id, controller);
    void queue.optimize(new Blob([id]), controller.signal).then(
      (outcome) => outcomes.set(id, outcome),
      (error: Error) => outcomes.set(id, error),
    );
  };
  const remove = (id: string) => removers.get(id)?.abort();
  const current = () => workers[workers.length - 1];
  const sentIds = (worker: FakeWorker) => Promise.all(worker.jobs.map((job) => job.file.text()));

  return { workers, outcomes, add, remove, current, sentIds };
}

const original = { kind: 'original' };

describe('image queue', () => {
  it('sends one photo at a time, in the order picked', async () => {
    const { add, current, sentIds, outcomes } = setup();
    ['a', 'b', 'c'].forEach(add);

    expect(await sentIds(current())).toEqual(['a']);

    current().succeed();
    await flush();
    expect(outcomes.get('a')?.kind).toBe('optimized');
    expect(await sentIds(current())).toEqual(['b']);
  });

  it('uses the original for a photo the worker fails on, and goes on', async () => {
    const { add, current, sentIds, outcomes } = setup();
    ['a', 'b'].forEach(add);

    current().fail();
    await flush();

    expect(outcomes.get('a')).toEqual(original);
    expect(await sentIds(current())).toEqual(['b']);
  });

  it('gives the next photo a new worker after a crash', async () => {
    const { add, workers, current, sentIds, outcomes } = setup();
    ['a', 'b'].forEach(add);

    workers[0].crash();
    await flush();

    expect(outcomes.get('a')).toEqual(original);
    expect(workers).toHaveLength(2);
    expect(await sentIds(current())).toEqual(['b']);
  });

  it('uses the originals for everything left after a second crash', async () => {
    const { add, workers, outcomes } = setup();
    ['a', 'b', 'c'].forEach(add);

    workers[0].crash();
    await flush();
    workers[1].crash();
    await flush();
    add('d');
    await flush();

    for (const id of ['a', 'b', 'c', 'd']) {
      expect(outcomes.get(id)).toEqual(original);
    }
    expect(workers).toHaveLength(2);
  });

  it('never decodes a photo removed while waiting', async () => {
    const { add, remove, current, sentIds, outcomes } = setup();
    ['a', 'b', 'c'].forEach(add);

    remove('b');
    current().succeed();
    await flush();

    expect(outcomes.get('b')).toMatchObject({ name: 'AbortError' });
    expect(await sentIds(current())).toEqual(['c']);
  });

  it('holds the slot until the worker is done with a photo removed in it', async () => {
    const { add, remove, current, sentIds } = setup();
    ['a', 'b'].forEach(add);

    remove('a');
    await flush();
    expect(await sentIds(current())).toEqual(['a']);

    current().succeed();
    await flush();
    expect(await sentIds(current())).toEqual(['b']);
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

    expect(outcomes.get('c')?.kind).toBe('optimized');
    expect(workers).toHaveLength(3);
  });

  it('uses the originals when the WebView will not start a worker at all', async () => {
    const queue = new ImageQueue(() => {
      throw new Error('blob: workers are blocked');
    });

    const { signal } = new AbortController();
    await expect(queue.optimize(new Blob(['a']), signal)).resolves.toEqual(original);
    await expect(queue.optimize(new Blob(['b']), signal)).resolves.toEqual(original);
  });
});
