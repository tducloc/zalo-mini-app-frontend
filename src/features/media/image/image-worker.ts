/**
 * The page's side of the image worker: starts one worker thread and sends it photos.
 * What the thread does with them is in image-worker-thread.ts; which photo goes when is image-queue.ts.
 *
 * There is no main-thread fallback (decided 2026-09-24): a phone without OffscreenCanvas
 * (iOS 15.1–16.3) uploads the original photo instead, because decoding and scaling a 12 MP
 * photo on the main thread freezes the form on exactly the slowest phones.
 */
import workerSource from '@/features/media/image/image-worker-thread.ts?worker-source';

/** Long edge of the uploaded photo. The server scales anything larger to the same size. */
export const MAX_EDGE = 1280;

/** JPEG only, decided 2026-09-24: WebP was not smaller at the quality product photos need. */
const JPEG_QUALITY = 0.85;

/**
 * A photo takes well under a few seconds even on a slow phone. A worker that has not
 * answered by then never started or died without an error event; it is treated as a
 * crash, so the queue's crash rules take over instead of the photo waiting forever.
 */
const JOB_TIMEOUT_MS = 30_000;

export const canOptimizeImages =
  typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';

// ---- Messages between the page and the thread (image-worker-thread.ts imports these as types) ----

export type PipelineStep = 'decode' | 'draw' | 'encode';

export interface ImageSettings {
  maxEdge: number;
  quality: number;
  /** Decode straight to this width (createImageBitmap resizeWidth). Media lab only. */
  decodeWidth?: number;
  /** Force the draw to finish before timing it. Media lab only. */
  shouldFlushDraw?: boolean;
}

export interface ImageJob {
  id: number;
  file: Blob;
  settings: ImageSettings;
}

export interface OptimizedImage {
  /** A 1280 px JPEG, or the file itself when the JPEG was not smaller. */
  blob: Blob;
  width: number;
  height: number;
  keptOriginal: boolean;
  /** Wall time of each step inside the worker, in ms. */
  timings: { decodeMs: number; drawMs: number; encodeMs: number };
}

export type ImageReply =
  | { id: number; ok: true; result: OptimizedImage }
  | { id: number; ok: false; error: string; step: PipelineStep | null };

/** A failure of one photo. `step` is null when the worker itself crashed or was stopped. */
export class PipelineError extends Error {
  constructor(
    message: string,
    readonly step: PipelineStep | null = null,
  ) {
    super(message);
  }
}

interface Pending {
  resolve: (result: OptimizedImage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** One worker thread. Each instance is a separate thread. */
export class ImageWorker {
  private readonly url: string;
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private jobCount = 0;
  private disposed = false;

  constructor() {
    // Started from the bundled source, not a script URL: inside Zalo a worker URL never
    // resolves (vite-plugins/worker-source.ts). The URL is revoked in dispose, not here:
    // revoking straight after the constructor makes some WebViews fail to start it.
    this.url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    this.worker = new Worker(this.url);
    this.worker.onmessage = (event: MessageEvent<ImageReply>) => this.handleReply(event.data);
    // Fires when the thread dies, for example out of memory; nothing in it survives.
    this.worker.onerror = (event) => this.fail(event.message || 'image worker crashed');
  }

  run(file: Blob, labSettings: Pick<ImageSettings, 'decodeWidth' | 'shouldFlushDraw'> = {}) {
    if (this.disposed) {
      return Promise.reject(new PipelineError('image worker is gone'));
    }
    const job: ImageJob = {
      id: ++this.jobCount,
      file,
      settings: { maxEdge: MAX_EDGE, quality: JPEG_QUALITY, ...labSettings },
    };
    return new Promise<OptimizedImage>((resolve, reject) => {
      const timer = setTimeout(() => this.fail('image worker did not answer'), JOB_TIMEOUT_MS);
      this.pending.set(job.id, { resolve, reject, timer });
      this.worker.postMessage(job);
    });
  }

  /** Stops the thread and rejects anything still in flight. */
  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.rejectAll(new PipelineError('image worker stopped'));
    this.worker.terminate();
    URL.revokeObjectURL(this.url);
  }

  /** True after dispose, including when the thread crashed. */
  isDisposed() {
    return this.disposed;
  }

  /** The thread is gone or stuck: every photo it had fails as a crash. */
  private fail(message: string) {
    this.rejectAll(new PipelineError(message));
    this.dispose();
  }

  private handleReply(reply: ImageReply) {
    const entry = this.pending.get(reply.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(reply.id);

    if (reply.ok) {
      entry.resolve(reply.result);
    } else {
      entry.reject(new PipelineError(reply.error, reply.step));
    }
  }

  private rejectAll(error: Error) {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }
}
