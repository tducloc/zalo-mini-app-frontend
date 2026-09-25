import { describe, expect, it } from 'vitest';

import {
  failureFromApiStatus,
  failureFromStorageStatus,
  FailureKind,
  isRetryable,
  isUrlExpiring,
  pollDelayMs,
  retryDelayMs,
} from '@/features/media/upload/retry-policy';

describe('failureFromApiStatus', () => {
  it.each([
    [0, FailureKind.Network],
    [401, FailureKind.Server],
    [404, FailureKind.Gone],
    [409, FailureKind.Conflict],
    [429, FailureKind.Server],
    [500, FailureKind.Server],
    [503, FailureKind.Server],
    [400, FailureKind.Rejected],
    [403, FailureKind.Rejected],
    [413, FailureKind.Rejected],
  ])('maps %i to %s', (status, kind) => {
    expect(failureFromApiStatus(status)).toBe(kind);
  });
});

describe('failureFromStorageStatus', () => {
  it.each([
    [0, FailureKind.Network],
    [403, FailureKind.Expired],
    [408, FailureKind.Server],
    [500, FailureKind.Server],
    [503, FailureKind.Server],
    [400, FailureKind.Rejected],
    [411, FailureKind.Rejected],
  ])('maps %i to %s', (status, kind) => {
    expect(failureFromStorageStatus(status)).toBe(kind);
  });
});

describe('isRetryable', () => {
  it('gives up only on a refusal', () => {
    const retryable = Object.values(FailureKind).filter(isRetryable);
    expect(retryable).not.toContain(FailureKind.Rejected);
    expect(retryable).toHaveLength(Object.values(FailureKind).length - 1);
  });
});

describe('retryDelayMs', () => {
  it('doubles after each failed attempt, jittered over the upper half', () => {
    expect([retryDelayMs(1, 0), retryDelayMs(1, 1)]).toEqual([500, 1_000]);
    expect([retryDelayMs(2, 0), retryDelayMs(2, 1)]).toEqual([1_000, 2_000]);
    expect([retryDelayMs(3, 0), retryDelayMs(3, 1)]).toEqual([2_000, 4_000]);
  });

  it('stops growing at 8 s', () => {
    expect(retryDelayMs(10, 1)).toBe(8_000);
  });
});

describe('pollDelayMs', () => {
  it('asks quickly at first, then less often, up to 15 s', () => {
    expect([0, 1, 2, 3].map(pollDelayMs)).toEqual([2_000, 3_000, 4_500, 6_750]);
    expect(pollDelayMs(20)).toBe(15_000);
  });
});

describe('isUrlExpiring', () => {
  const now = Date.parse('2026-09-25T10:00:00Z');

  it('treats a URL with under a minute left as expired', () => {
    expect(isUrlExpiring('2026-09-25T10:00:59Z', now)).toBe(true);
    expect(isUrlExpiring('2026-09-25T10:01:01Z', now)).toBe(false);
  });

  it('treats a missing expiry as expired', () => {
    expect(isUrlExpiring('', now)).toBe(true);
  });
});
