/**
 * Pure summaries for the worker-pool benchmark in the media lab (R3 in
 * plans/create-listing.md). Kept apart from the runner so they can be unit tested.
 */

import { type ImageDimensions } from '@/features/media/image/image-utils';
import { MIB } from '@/features/media/media-utils';

export interface BenchConfig {
  key: string;
  label: string;
  workers: number;
  perWorker: number;
  budgetBytes?: number;
  decodeWidth?: number;
}

export interface JobRecord {
  name: string;
  fileBytes: number;
  dimensions: ImageDimensions | null;
  costBytes: number;
  ok: boolean;
  error?: string;
  /** Pipeline step that failed; missing when the worker crashed. */
  step?: string;
  decodeMs?: number;
  drawMs?: number;
  encodeMs?: number;
  outputBytes?: number;
  keptOriginal?: boolean;
}

export interface BenchResult {
  config: BenchConfig;
  totalMs: number;
  longestFrameMs: number;
  peakInFlight: number;
  peakEstimatedBytes: number;
  workerCrashes: number;
  jobs: JobRecord[];
}

export interface BenchSummary {
  images: number;
  failed: number;
  msPerImage: number;
  medianDecodeMs: number;
  medianDrawMs: number;
  medianEncodeMs: number;
  /** Share of the pipeline time spent in drawImage, the only step two workers can parallelise. */
  drawShare: number;
  outputBytes: number;
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function stepTimes(jobs: JobRecord[], key: 'decodeMs' | 'drawMs' | 'encodeMs') {
  return jobs.flatMap((job) => (job[key] === undefined ? [] : [job[key]]));
}

export function summarizeBench(result: BenchResult): BenchSummary {
  const succeeded = result.jobs.filter((job) => job.ok);

  const medianDecodeMs = median(stepTimes(succeeded, 'decodeMs'));
  const medianDrawMs = median(stepTimes(succeeded, 'drawMs'));
  const medianEncodeMs = median(stepTimes(succeeded, 'encodeMs'));
  const stepTotal = medianDecodeMs + medianDrawMs + medianEncodeMs;

  return {
    images: result.jobs.length,
    failed: result.jobs.length - succeeded.length,
    msPerImage: result.jobs.length ? result.totalMs / result.jobs.length : 0,
    medianDecodeMs,
    medianDrawMs,
    medianEncodeMs,
    drawShare: stepTotal ? medianDrawMs / stepTotal : 0,
    outputBytes: succeeded.reduce((total, job) => total + (job.outputBytes ?? 0), 0),
  };
}

const TSV_HEADER = [
  'config',
  'images',
  'failed',
  'crashes',
  'total_ms',
  'ms_per_image',
  'decode_ms',
  'draw_ms',
  'encode_ms',
  'draw_share',
  'longest_frame_ms',
  'peak_in_flight',
  'peak_est_mb',
  'output_kb',
].join('\t');

/** One row per run, tab separated, to paste into the research notes. */
export function formatBenchTsv(results: BenchResult[]): string {
  const rows = results.map((result) => {
    const summary = summarizeBench(result);
    return [
      result.config.label,
      summary.images,
      summary.failed,
      result.workerCrashes,
      Math.round(result.totalMs),
      Math.round(summary.msPerImage),
      Math.round(summary.medianDecodeMs),
      Math.round(summary.medianDrawMs),
      Math.round(summary.medianEncodeMs),
      summary.drawShare.toFixed(2),
      Math.round(result.longestFrameMs),
      result.peakInFlight,
      (result.peakEstimatedBytes / MIB).toFixed(0),
      Math.round(summary.outputBytes / 1024),
    ].join('\t');
  });
  return [TSV_HEADER, ...rows].join('\n');
}
