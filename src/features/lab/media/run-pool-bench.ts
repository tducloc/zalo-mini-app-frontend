/**
 * Runs the real image pipeline over a set of picked files with N workers and M images in
 * flight per worker, pulling from one shared queue. Dev-only, used by the media lab.
 *
 * Peak memory cannot be read from the page on iOS, so `peakEstimatedBytes` is the model
 * (estimateJobBytes: the decoded bitmap plus the 1280 canvas, per photo in flight). Confirm real peaks with Xcode Instruments or
 * chrome://inspect while the run is going.
 */

import { startFrameMeter } from '@/features/lab/media/frame-meter';
import type { BenchConfig, BenchResult, JobRecord } from '@/features/lab/media/pool-bench-summary';
import { estimateJobBytes, pickWorker, type PoolState } from '@/features/lab/media/pool-budget';
import { MIB, IMAGE_HEAD_BYTES, PHOTO_MAX_EDGE } from '@/features/media/constants/limits';
import { ImageWorker, PipelineError } from '@/features/media/services/image-worker';
import { readPhotoHeader } from '@/features/media/utils/image';
import { readHead } from '@/features/media/utils/media';

interface QueuedJob {
  file: File;
  record: JobRecord;
  decodeWidth?: number;
}

async function prepareJob(file: File, decodeWidth?: number): Promise<QueuedJob> {
  const head = await readHead(file, IMAGE_HEAD_BYTES);
  const photo = readPhotoHeader(head);

  // Only shrink at decode when the stored width is larger; resizeWidth would upscale.
  const effectiveWidth =
    decodeWidth && (!photo || photo.width > decodeWidth) ? decodeWidth : undefined;

  return {
    file,
    decodeWidth: effectiveWidth,
    record: {
      name: file.name,
      fileBytes: file.size,
      dimensions: photo,
      costBytes: estimateJobBytes(photo, effectiveWidth),
      ok: false,
    },
  };
}

function recordSuccess(record: JobRecord, result: Awaited<ReturnType<ImageWorker['run']>>) {
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
  record.step = (error instanceof PipelineError && error.step) || undefined;
}

export async function runPoolBench(files: File[], config: BenchConfig): Promise<BenchResult> {
  const queue = await Promise.all(files.map((file) => prepareJob(file, config.decodeWidth)));
  const records = queue.map((job) => job.record);

  const workers = Array.from({ length: config.workers }, () => new ImageWorker());
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
        workers[index] = new ImageWorker();
      }

      if (remaining === 0) {
        resolveAll();
      } else {
        pump();
      }
    };

    const pump = () => {
      while (queue.length > 0) {
        const [job] = queue;
        const index = pickWorker(state, job.record.costBytes, config);
        if (index === null) {
          return;
        }
        queue.shift();

        state.inFlight[index] += 1;
        state.bytesInFlight += job.record.costBytes;
        peakInFlight = Math.max(
          peakInFlight,
          state.inFlight.reduce((a, b) => a + b, 0),
        );
        peakEstimatedBytes = Math.max(peakEstimatedBytes, state.bytesInFlight);

        workers[index]
          .run(job.file, { decodeWidth: job.decodeWidth, shouldFlushDraw: true })
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

export const BENCH_CONFIGS: BenchConfig[] = [
  { key: 'n1m1', label: 'N1 × M1', workers: 1, perWorker: 1 },
  { key: 'n1m2', label: 'N1 × M2', workers: 1, perWorker: 2 },
  { key: 'n2m1', label: 'N2 × M1', workers: 2, perWorker: 1 },
  { key: 'n2m2', label: 'N2 × M2', workers: 2, perWorker: 2 },
  { key: 'n3m1', label: 'N3 × M1', workers: 3, perWorker: 1 },
  { key: 'n3m2', label: 'N3 × M2', workers: 3, perWorker: 2 },
  { key: 'budget', label: 'N1 × M2, 150 MB', workers: 1, perWorker: 2, budgetBytes: 150 * MIB },
  {
    key: 'decode1280',
    label: 'N1 × M2, decode 1280',
    workers: 1,
    perWorker: 2,
    decodeWidth: PHOTO_MAX_EDGE,
  },
];

/** P1, how the app worked before the image queue: every photo at once. It may crash. */
export const ALL_AT_ONCE: BenchConfig = {
  key: 'all',
  label: 'N1 × tất cả',
  workers: 1,
  perWorker: Number.MAX_SAFE_INTEGER,
};
