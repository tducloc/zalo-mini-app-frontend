import { describe, expect, it } from 'vitest';

import {
  failureFromApiStatus,
  failureFromStorageStatus,
  FailureKind,
  isRetryable,
  isUrlExpiring,
  pollDelayMs,
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
    [404, FailureKind.Gone],
    [400, FailureKind.Server],
    [408, FailureKind.Server],
    [500, FailureKind.Server],
    [503, FailureKind.Server],
    [411, FailureKind.Rejected],
    [413, FailureKind.Rejected],
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

describe('pollDelayMs', () => {
  it('asks quickly at first, then less often, up to 15 s', () => {
    expect([0, 1, 2, 3].map(pollDelayMs)).toEqual([2_000, 3_000, 4_500, 6_750]);
    expect(pollDelayMs(20)).toBe(15_000);
  });
});

describe('isUrlExpiring', () => {
  const now = Date.parse('2026-09-25T10:00:00Z');

  it('treats a URL with under a minute left, on the phone’s clock, as expired', () => {
    expect(isUrlExpiring(now + 59_000, now)).toBe(true);
    expect(isUrlExpiring(now + 61_000, now)).toBe(false);
  });

  it('treats a URL never received as expired', () => {
    expect(isUrlExpiring(0, now)).toBe(true);
  });
});
