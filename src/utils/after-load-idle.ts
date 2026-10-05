const IDLE_TIMEOUT_MS = 2000;
// iOS WebKit has no requestIdleCallback.
const FALLBACK_DELAY_MS = 300;

/**
 * Runs `task` once the window has loaded and the browser has an idle moment, so it stays
 * off the first render and the first images. Returns a cancel function.
 */
export function runAfterLoadWhenIdle(task: () => void) {
  let cancelIdle = () => {};

  const scheduleIdle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
      cancelIdle = () => window.cancelIdleCallback(id);
      return;
    }

    const id = window.setTimeout(task, FALLBACK_DELAY_MS);
    cancelIdle = () => window.clearTimeout(id);
  };

  if (document.readyState === 'complete') {
    scheduleIdle();
    return () => cancelIdle();
  }

  window.addEventListener('load', scheduleIdle, { once: true });
  return () => {
    window.removeEventListener('load', scheduleIdle);
    cancelIdle();
  };
}
