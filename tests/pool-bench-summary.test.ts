import { describe, expect, it } from 'vitest';

import {
  type BenchResult,
  formatBenchTsv,
  median,
  summarizeBench,
} from '@/features/lab/media/pool-bench-summary';

const MB = 1024 * 1024;

function job(overrides: Partial<BenchResult['jobs'][number]> = {}) {
  return {
    name: 'a.jpg',
    fileBytes: 2 * MB,
    dimensions: { width: 4032, height: 3024 },
    costBytes: 54 * MB,
    ok: true,
    decodeMs: 40,
    drawMs: 20,
    encodeMs: 40,
    outputBytes: 300 * 1024,
    keptOriginal: false,
    ...overrides,
  };
}

const result: BenchResult = {
  config: { key: 'n1m2', label: 'N1 × M2', workers: 1, perWorker: 2 },
  totalMs: 1000,
  longestFrameMs: 17.4,
  peakInFlight: 2,
  peakEstimatedBytes: 108 * MB,
  workerCrashes: 0,
  jobs: [
    job(),
    job({ decodeMs: 60, drawMs: 30, encodeMs: 50 }),
    job({ ok: false, error: 'decode failed', step: 'decode', decodeMs: undefined }),
    job({ decodeMs: 50, drawMs: 10, encodeMs: 30 }),
  ],
};

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('summarizeBench', () => {
  it('uses only the images that succeeded for the step medians', () => {
    const summary = summarizeBench(result);
    expect(summary.images).toBe(4);
    expect(summary.failed).toBe(1);
    expect(summary.medianDecodeMs).toBe(50);
    expect(summary.medianDrawMs).toBe(20);
    expect(summary.medianEncodeMs).toBe(40);
    expect(summary.outputBytes).toBe(3 * 300 * 1024);
  });

  it('reports the share of time spent in drawImage', () => {
    expect(summarizeBench(result).drawShare).toBeCloseTo(20 / 110);
  });

  it('spreads the total time over every image, failed ones included', () => {
    expect(summarizeBench(result).msPerImage).toBe(250);
  });
});

describe('formatBenchTsv', () => {
  it('prints a header and one row per run', () => {
    const [header, row] = formatBenchTsv([result]).split('\n');
    expect(header.split('\t')).toContain('draw_share');
    expect(row.split('\t')).toEqual([
      'N1 × M2',
      '4',
      '1',
      '0',
      '1000',
      '250',
      '50',
      '20',
      '40',
      '0.18',
      '17',
      '2',
      '108',
      '900',
    ]);
  });
});
