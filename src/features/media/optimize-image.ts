/**
 * Starts image workers and talks to them. The pipeline itself is in image-worker.ts.
 *
 * There is no main-thread fallback (decided 2026-09-24): a phone without OffscreenCanvas
 * (iOS 15.1–16.3) uploads the original photo instead, because decoding and scaling a
 * 12 MP photo on the main thread freezes the form on exactly the slowest phones.
 */
import workerSource from '@/features/media/image-worker.ts?worker-source';

import type {
  ImageJob,
  ImageJobOptions,
  ImageReply,
  OptimizedImage,
  PipelineStep,
} from '@/features/media/image-worker-protocol';

export const canOptimizeImages =
  typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';

/** A pipeline failure. `step` is null when the worker itself crashed or was stopped. */
export class PipelineError extends Error {
  constructor(
    message: string,
    readonly step: PipelineStep | null = null,
  ) {
    super(message);
  }
}

export interface PipelineWorker {
  run: (file: Blob, options?: ImageJobOptions) => Promise<OptimizedImage>;
  /** Stops the worker and rejects anything still in flight. */
  dispose: () => void;
  /** True after dispose, including when the worker crashed. */
  isDisposed: () => boolean;
}

interface Pending {
  resolve: (result: OptimizedImage) => void;
  reject: (error: Error) => void;
}

function rejectAll(pending: Map<number, Pending>, error: Error) {
  for (const entry of pending.values()) {
    entry.reject(error);
  }
  pending.clear();
}

/** Starts one worker running the pipeline. Each call is a separate thread. */
export function createPipelineWorker(): PipelineWorker {
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  // The URL is revoked in dispose, not here: revoking straight after the constructor is a
  // known way to make some WebViews fail to start the worker.
  const worker = new Worker(url);

  const pending = new Map<number, Pending>();
  let sequence = 0;
  let disposed = false;

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    rejectAll(pending, new PipelineError('image worker stopped'));
    worker.terminate();
    URL.revokeObjectURL(url);
  };

  worker.onmessage = (event: MessageEvent<ImageReply>) => {
    const reply = event.data;
    const entry = pending.get(reply.id);
    if (!entry) {
      return;
    }
    pending.delete(reply.id);

    if (reply.ok) {
      entry.resolve(reply.result);
    } else {
      entry.reject(new PipelineError(reply.error, reply.step));
    }
  };

  // Fires when the worker dies, for example out of memory; nothing in it survives.
  worker.onerror = (event) => {
    rejectAll(pending, new PipelineError(event.message || 'image worker crashed'));
    dispose();
  };

  const run = (file: Blob, options: ImageJobOptions = {}) => {
    if (disposed) {
      return Promise.reject(new PipelineError('image worker is gone'));
    }
    const job: ImageJob = { id: ++sequence, file, options };
    return new Promise<OptimizedImage>((resolve, reject) => {
      pending.set(job.id, { resolve, reject });
      worker.postMessage(job);
    });
  };

  return { run, dispose, isDisposed: () => disposed };
}
