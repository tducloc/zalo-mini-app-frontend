/**
 * Chooses WHERE the pipeline runs, not WHAT it does.
 *
 * With OffscreenCanvas the whole thing runs in a worker, so the synchronous drawImage
 * never touches the main thread and typing stays smooth while images are processed.
 * Without it (iOS below 16.4) the exact same function runs on the main thread.
 *
 * The worker is started from a Blob URL that we build ourselves, NOT from a file URL.
 * Inside the Zalo Mini App runtime the app is served from a custom origin with
 * `base: ''`, so a worker script URL never resolves. Vite's own `?worker&inline` is not
 * enough either: it only produces a Blob when BUILDING. In dev (`zmp start`) Vite falls
 * back to serving the worker from a URL, so the dev build would break in the very place
 * we test. Reading the pipeline source with `?raw` behaves identically in both modes.
 */
import pipelineSource from './image-pipeline.js?raw';

import {
  hasOffscreenCanvas,
  optimizeImage as optimizeOnThisThread,
  type OptimizeOptions,
  type OptimizeResult,
  type PipelineStep,
} from './image-pipeline.js';

export const canUseWorker = hasOffscreenCanvas && typeof Worker !== 'undefined';

/** The message loop. Appended to the pipeline source to form the worker script. */
const WORKER_GLUE = `
self.onmessage = async (event) => {
  const { id, file, options } = event.data;
  try {
    const result = await optimizeImage(file, options);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: String((error && error.message) || error),
      step: error && error.step,
    });
  }
};
`;

/** A pipeline failure. `step` is missing when the worker itself crashed. */
export class PipelineError extends Error {
  step?: PipelineStep;

  constructor(message: string, step?: PipelineStep) {
    super(message);
    this.step = step;
  }
}

export type PipelineWorker = {
  run: (file: Blob, options: OptimizeOptions) => Promise<OptimizeResult>;
  /** Stops the worker and rejects anything still in flight. */
  dispose: () => void;
  /** True after dispose, including when the worker crashed. */
  isDisposed: () => boolean;
};

type WorkerReply = {
  id: number;
  ok: boolean;
  result?: OptimizeResult;
  error?: string;
  step?: PipelineStep;
};

type Pending = {
  resolve: (result: OptimizeResult) => void;
  reject: (error: Error) => void;
};

function rejectAll(pending: Map<number, Pending>, error: Error) {
  for (const entry of pending.values()) {
    entry.reject(error);
  }
  pending.clear();
}

/** Starts one worker running the pipeline. Each call is a separate thread. */
export function createPipelineWorker(): PipelineWorker {
  // Drop the ESM export keywords so the same file runs as a classic worker script.
  const source = pipelineSource.replace(
    /^export\s+(?=const |let |function |async function )/gm,
    '',
  );
  const blob = new Blob([source, WORKER_GLUE], { type: 'text/javascript;charset=utf-8' });
  // The URL is revoked in dispose, not here. Revoking straight after the constructor
  // is a known way to make some WebViews fail to start the worker.
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  const pending = new Map<number, Pending>();
  let sequence = 0;
  let disposed = false;

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    rejectAll(pending, new PipelineError('cancelled'));
    worker.terminate();
    URL.revokeObjectURL(url);
  };

  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const reply = event.data;
    const entry = pending.get(reply.id);
    if (!entry) {
      return;
    }
    pending.delete(reply.id);

    if (reply.ok && reply.result) {
      entry.resolve(reply.result);
    } else {
      entry.reject(new PipelineError(reply.error ?? 'image worker failed', reply.step));
    }
  };

  worker.onerror = (event) => {
    rejectAll(pending, new PipelineError(event.message || 'image worker crashed'));
    dispose();
  };

  const run = (file: Blob, options: OptimizeOptions) => {
    if (disposed) {
      return Promise.reject(new PipelineError('image worker is gone'));
    }
    const id = ++sequence;
    return new Promise<OptimizeResult>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, file, options });
    });
  };

  return { run, dispose, isDisposed: () => disposed };
}

let sharedWorker: PipelineWorker | null = null;

export type OptimizeHost = 'auto' | 'worker' | 'main';

export function optimize(
  file: Blob,
  isMain: boolean,
  host: OptimizeHost = 'auto',
): Promise<OptimizeResult> {
  const useWorker = host === 'worker' || (host === 'auto' && canUseWorker);
  if (!useWorker) {
    return optimizeOnThisThread(file, { isMain });
  }

  // A crashed worker disposes itself; start a fresh one for the next image.
  if (!sharedWorker || sharedWorker.isDisposed()) {
    sharedWorker = createPipelineWorker();
  }
  return sharedWorker.run(file, { isMain });
}

/** Drops the shared worker and rejects anything still in flight. Used on cancel or teardown. */
export function disposeWorker() {
  sharedWorker?.dispose();
  sharedWorker = null;
}
