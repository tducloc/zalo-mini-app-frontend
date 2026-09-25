import { describe, expect, it } from 'vitest';

import {
  estimateJobBytes,
  pickWorker,
  UNKNOWN_IMAGE_DIMENSIONS,
} from '@/features/media/lab/pool-budget';

const MB = 1024 * 1024;

describe('estimateJobBytes', () => {
  it('counts the full decoded bitmap plus the 1280 px canvas', () => {
    // 4032 × 3024 × 4 = 48.8 MB, plus 1280 × 960 × 4 = 4.9 MB.
    expect(estimateJobBytes({ width: 4032, height: 3024 })).toBe(4032 * 3024 * 4 + 1280 * 960 * 4);
  });

  it('keeps small images at their own size', () => {
    expect(estimateJobBytes({ width: 800, height: 600 })).toBe(800 * 600 * 4 * 2);
  });

  it('shrinks the bitmap when decoding straight to a width', () => {
    const full = estimateJobBytes({ width: 4032, height: 3024 });
    const reduced = estimateJobBytes({ width: 4032, height: 3024 }, 1280);
    expect(reduced).toBe(1280 * 960 * 4 * 2);
    expect(reduced).toBeLessThan(full / 5);
  });

  it('assumes a 24 MP photo when the header could not be read', () => {
    expect(estimateJobBytes(null)).toBe(estimateJobBytes(UNKNOWN_IMAGE_DIMENSIONS));
  });
});

describe('pickWorker', () => {
  it('fills the least loaded worker first', () => {
    const config = { workers: 3, perWorker: 2 };
    expect(pickWorker({ inFlight: [1, 0, 1], bytesInFlight: 0 }, MB, config)).toBe(1);
    expect(pickWorker({ inFlight: [0, 0, 0], bytesInFlight: 0 }, MB, config)).toBe(0);
  });

  it('waits when every worker is at its limit', () => {
    const config = { workers: 2, perWorker: 1 };
    expect(pickWorker({ inFlight: [1, 1], bytesInFlight: 0 }, MB, config)).toBeNull();
  });

  it('ignores memory when no budget is set', () => {
    const config = { workers: 1, perWorker: 10 };
    expect(pickWorker({ inFlight: [9], bytesInFlight: 900 * MB }, 100 * MB, config)).toBe(0);
  });

  it('waits when the job would exceed the memory budget', () => {
    const config = { workers: 1, perWorker: 2, budgetBytes: 150 * MB };
    expect(pickWorker({ inFlight: [1], bytesInFlight: 110 * MB }, 110 * MB, config)).toBeNull();
    expect(pickWorker({ inFlight: [1], bytesInFlight: 50 * MB }, 60 * MB, config)).toBe(0);
  });

  it('still runs an image bigger than the budget when nothing else is running', () => {
    const config = { workers: 2, perWorker: 2, budgetBytes: 150 * MB };
    expect(pickWorker({ inFlight: [0, 0], bytesInFlight: 0 }, 200 * MB, config)).toBe(0);
  });
});
