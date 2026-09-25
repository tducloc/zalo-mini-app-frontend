import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConversionStalledError,
  convertedVideoSize,
  watchForStall,
} from '@/features/media/video/convert-video';

describe('convertedVideoSize', () => {
  it('brings the short side to 720 and keeps the shape', () => {
    expect(convertedVideoSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(convertedVideoSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
  });

  it('rounds to even sides and never upscales', () => {
    expect(convertedVideoSize(1080, 1350)).toEqual({ width: 720, height: 900 });
    expect(convertedVideoSize(1440, 1080)).toEqual({ width: 960, height: 720 });
    expect(convertedVideoSize(480, 853)).toEqual({ width: 480, height: 854 });
  });
});

describe('watchForStall', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails only after a full timeout with no progress', async () => {
    vi.useFakeTimers();
    const watch = watchForStall(1_000);
    const outcome = watch.stalled.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(900);
    watch.progressed();
    await vi.advanceTimersByTimeAsync(900);
    watch.progressed();
    await vi.advanceTimersByTimeAsync(999);
    let settled = false;
    void outcome.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toBeInstanceOf(ConversionStalledError);
  });

  it('never fails once stopped', async () => {
    vi.useFakeTimers();
    const watch = watchForStall(1_000);
    let failed = false;
    watch.stalled.catch(() => {
      failed = true;
    });
    watch.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(failed).toBe(false);
  });
});
