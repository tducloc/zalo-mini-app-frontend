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
  type OptimizeResult,
} from './image-pipeline.js';

export const canUseWorker = hasOffscreenCanvas && typeof Worker !== 'undefined';

/** The message loop. Appended to the pipeline source to form the worker script. */
const WORKER_GLUE = `
self.onmessage = async (event) => {
  const { id, file, isMain } = event.data;
  try {
    const result = await optimizeImage(file, { isMain });
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String((error && error.message) || error) });
  }
};
`;

type Pending = {
  resolve: (result: OptimizeResult) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let workerUrl: string | null = null;
let sequence = 0;
const pending = new Map<number, Pending>();

function createWorker(): Worker {
  // Drop the ESM export keywords so the same file runs as a classic worker script.
  const source = pipelineSource.replace(
    /^export\s+(?=const |let |function |async function )/gm,
    '',
  );
  const blob = new Blob([source, WORKER_GLUE], { type: 'text/javascript;charset=utf-8' });
  workerUrl = URL.createObjectURL(blob);
  // The URL is revoked in disposeWorker, not here. Revoking straight after the
  // constructor is a known way to make some WebViews fail to start the worker.
  return new Worker(workerUrl);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = createWorker();
  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as { id: number; ok: boolean; result?: OptimizeResult; error?: string };
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok && data.result) entry.resolve(data.result);
    else entry.reject(new Error(data.error ?? 'image worker failed'));
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || 'image worker crashed');
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
    disposeWorker();
  };
  return worker;
}

function runInWorker(file: Blob, isMain: boolean): Promise<OptimizeResult> {
  const id = ++sequence;
  return new Promise<OptimizeResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, file, isMain });
  });
}

export type OptimizeHost = 'auto' | 'worker' | 'main';

export function optimize(
  file: Blob,
  isMain: boolean,
  host: OptimizeHost = 'auto',
): Promise<OptimizeResult> {
  const useWorker = host === 'worker' || (host === 'auto' && canUseWorker);
  return useWorker ? runInWorker(file, isMain) : optimizeOnThisThread(file, { isMain });
}

/** Drops the worker and rejects anything still in flight. Used on cancel or teardown. */
export function disposeWorker() {
  for (const entry of pending.values()) entry.reject(new Error('cancelled'));
  pending.clear();
  worker?.terminate();
  worker = null;
  if (workerUrl) URL.revokeObjectURL(workerUrl);
  workerUrl = null;
}
