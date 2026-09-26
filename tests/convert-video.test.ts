import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConversionStalledError,
  convertedVideoSize,
  stallWatchPlan,
  watchForStall,
} from '@/features/media/services/convert-video';

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

  it('stays stopped when progress comes in after stop', async () => {
    vi.useFakeTimers();
    const watch = watchForStall(1_000);
    let failed = false;
    watch.stalled.catch(() => {
      failed = true;
    });
    watch.stop();
    watch.progressed();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(failed).toBe(false);
  });

  it('does not count while paused, and counts again from the next progress', async () => {
    vi.useFakeTimers();
    const watch = watchForStall(1_000);
    const outcome = watch.stalled.catch((error: unknown) => error);
    let settled = false;
    void outcome.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(900);
    watch.pause();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(settled).toBe(false);

    watch.progressed();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await outcome).toBeInstanceOf(ConversionStalledError);
  });
});

describe('watchForStall, changing pace', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a longer timeout given with progress, also after a pause', async () => {
    vi.useFakeTimers();
    const watch = watchForStall(1_000);
    const outcome = watch.stalled.catch((error: unknown) => error);
    let settled = false;
    void outcome.then(() => {
      settled = true;
    });

    watch.progressed(5_000);
    await vi.advanceTimersByTimeAsync(4_000);
    watch.pause();
    watch.progressed();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toBeInstanceOf(ConversionStalledError);
  });
});

describe('stallWatchPlan', () => {
  it('slows down only at the end when every track is as long as the clip', () => {
    const plan = stallWatchPlan([
      { start: 0, end: 30 },
      { start: 0, end: 30 },
    ]);
    expect(plan.finalFrom).toBeCloseTo(29.95);
    // The flush and writing the file still get the usual timeout.
    expect(plan.finalTimeoutMs).toBe(20_000);
  });

  it('allows for the rest of the picture when the sound ends early', () => {
    const plan = stallWatchPlan([
      { start: 0, end: 60 },
      { start: 0, end: 5 },
    ]);
    expect(plan.finalFrom).toBeCloseTo(4.95);
    expect(plan.finalTimeoutMs).toBe(20_000 + 55 * 3 * 1000);
  });

  it('measures from where the conversion starts, as mediabunny reports progress', () => {
    const plan = stallWatchPlan([
      { start: 1.5, end: 31.5 },
      { start: 1.5, end: 31.5 },
    ]);
    expect(plan.finalFrom).toBeCloseTo(29.95);
  });

  it('leaves out an empty track, which would end the watch at once', () => {
    const plan = stallWatchPlan([
      { start: 0, end: 30 },
      { start: 0, end: 0 },
    ]);
    expect(plan.finalFrom).toBeCloseTo(29.95);
  });
});
