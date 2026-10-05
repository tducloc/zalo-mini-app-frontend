import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runAfterLoadWhenIdle } from '@/utils/after-load-idle';

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { value: state, configurable: true });
}

describe('runAfterLoadWhenIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setReadyState('complete');
  });

  it('waits for the load event, then a pause when there is no requestIdleCallback', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    setReadyState('loading');
    const task = vi.fn();

    runAfterLoadWhenIdle(task);
    vi.advanceTimersByTime(5000);
    expect(task).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    expect(task).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('runs on the next idle callback when the page has already loaded', () => {
    let idle: (() => void) | undefined;
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      idle = callback;
      return 1;
    });
    const task = vi.fn();

    runAfterLoadWhenIdle(task);
    expect(task).not.toHaveBeenCalled();

    idle?.();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('never runs once cancelled', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    setReadyState('loading');
    const task = vi.fn();

    const cancel = runAfterLoadWhenIdle(task);
    cancel();
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(5000);

    expect(task).not.toHaveBeenCalled();
  });
});
