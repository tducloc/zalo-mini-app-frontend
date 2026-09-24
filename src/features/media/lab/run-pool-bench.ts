/**
 * Runs the real image pipeline over a set of picked files with N workers and M images in
 * flight per worker, pulling from one shared queue. Dev-only, used by the media lab.
 *
 * Peak memory cannot be read from the page on iOS, so `peakEstimatedBytes` is the model
 * (width × height × 4 per image in flight). Confirm real peaks with Xcode Instruments or
 * chrome://inspect while the run is going.
 */

import { IMAGE_HEAD_BYTES, readImageDimensions } from '@/features/media/image-dimensions';
import {
  createPipelineWorker,
  PipelineError,
  type PipelineWorker,
} from '@/features/media/optimize-image';
import {
  estimateJobBytes,
  MAX_EDGE,
  pickWorker,
  type PoolState,
} from '@/features/media/pool-scheduler';
import type { BenchConfig, BenchResult, JobRecord } from '@/features/media/lab/pool-bench-summary';

type QueuedJob = { file: File; record: JobRecord; decodeWidth?: number };

/** The longest gap between animation frames is the main-thread block the user feels. */
function startFrameMeter() {
  let last = performance.now();
  let longest = 0;
  let running = true;

  const tick = () => {
    if (!running) {
      return;
    }
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return () => {
    running = false;
    return longest;
  };
}

async function prepareJob(file: File, decodeWidth?: number): Promise<QueuedJob> {
  const head = new Uint8Array(await file.slice(0, IMAGE_HEAD_BYTES).arrayBuffer());
  const dimensions = readImageDimensions(head);

  // Only shrink at decode when the stored width is larger; resizeWidth would upscale.
  const effectiveWidth =
    decodeWidth && (!dimensions || dimensions.width > decodeWidth) ? decodeWidth : undefined;

  return {
    file,
    decodeWidth: effectiveWidth,
    record: {
      name: file.name,
      fileBytes: file.size,
      dimensions,
      costBytes: estimateJobBytes(dimensions, effectiveWidth),
      ok: false,
    },
  };
}

function recordSuccess(record: JobRecord, result: Awaited<ReturnType<PipelineWorker['run']>>) {
  record.ok = true;
  record.decodeMs = result.timings.decodeMs;
  record.drawMs = result.timings.drawMs;
  record.encodeMs = result.timings.encodeMs;
  record.outputBytes = result.blob.size;
  record.keptOriginal = result.keptOriginal;
}

function recordFailure(record: JobRecord, error: unknown) {
  record.ok = false;
  record.error = error instanceof Error ? error.message : String(error);
  record.step = error instanceof PipelineError ? error.step : undefined;
}

export async function runPoolBench(files: File[], config: BenchConfig): Promise<BenchResult> {
  const queue = await Promise.all(files.map((file) => prepareJob(file, config.decodeWidth)));
  const records = queue.map((job) => job.record);

  const workers = Array.from({ length: config.workers }, () => createPipelineWorker());
  const state: PoolState = { inFlight: workers.map(() => 0), bytesInFlight: 0 };
  let peakInFlight = 0;
  let peakEstimatedBytes = 0;
  let workerCrashes = 0;
  let remaining = queue.length;

  const stopFrameMeter = startFrameMeter();
  const started = performance.now();

  await new Promise<void>((resolveAll) => {
    const finish = (index: number, job: QueuedJob) => {
      state.inFlight[index] -= 1;
      state.bytesInFlight -= job.record.costBytes;
      remaining -= 1;

      // A crashed worker disposes itself; replace it so the run can go on, as in 02b.
      if (workers[index].isDisposed()) {
        workerCrashes += 1;
        workers[index] = createPipelineWorker();
      }

      if (remaining === 0) {
        resolveAll();
      } else {
        pump();
      }
    };

    const pump = () => {
      while (queue.length > 0) {
        const index = pickWorker(state, queue[0].record.costBytes, config);
        if (index === null) {
          return;
        }
        const job = queue.shift() as QueuedJob;

        state.inFlight[index] += 1;
        state.bytesInFlight += job.record.costBytes;
        peakInFlight = Math.max(
          peakInFlight,
          state.inFlight.reduce((a, b) => a + b, 0),
        );
        peakEstimatedBytes = Math.max(peakEstimatedBytes, state.bytesInFlight);

        workers[index]
          .run(job.file, { isMain: false, decodeWidth: job.decodeWidth, flushDraw: true })
          .then((result) => recordSuccess(job.record, result))
          .catch((error: unknown) => recordFailure(job.record, error))
          .finally(() => finish(index, job));
      }
    };

    if (remaining === 0) {
      resolveAll();
    } else {
      pump();
    }
  });

  const totalMs = performance.now() - started;
  const longestFrameMs = stopFrameMeter();
  workers.forEach((worker) => worker.dispose());

  return {
    config,
    totalMs,
    longestFrameMs,
    peakInFlight,
    peakEstimatedBytes,
    workerCrashes,
    jobs: records,
  };
}

const MB = 1024 * 1024;

export const BENCH_CONFIGS: BenchConfig[] = [
  { key: 'n1m1', label: 'N1 × M1', workers: 1, perWorker: 1 },
  { key: 'n1m2', label: 'N1 × M2', workers: 1, perWorker: 2 },
  { key: 'n2m1', label: 'N2 × M1', workers: 2, perWorker: 1 },
  { key: 'n2m2', label: 'N2 × M2', workers: 2, perWorker: 2 },
  { key: 'n3m1', label: 'N3 × M1', workers: 3, perWorker: 1 },
  { key: 'n3m2', label: 'N3 × M2', workers: 3, perWorker: 2 },
  { key: 'budget', label: 'N1 × M2, 150 MB', workers: 1, perWorker: 2, budgetBytes: 150 * MB },
  {
    key: 'decode1280',
    label: 'N1 × M2, decode 1280',
    workers: 1,
    perWorker: 2,
    decodeWidth: MAX_EDGE,
  },
  // The current production behaviour (P1): every image at once. Run it last; it may crash.
  { key: 'all', label: 'N1 × tất cả', workers: 1, perWorker: Number.MAX_SAFE_INTEGER },
];
