/**
 * The longest gap between animation frames is the main-thread block the user feels.
 *
 * Frames stop while the page is hidden (a camera or picker trip, Zalo in the background);
 * that gap is not a block, so the clock restarts when the page is shown again.
 */
export function startFrameMeter() {
  let last = performance.now();
  let longest = 0;
  let running = true;

  const measure = () => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
  };

  const tick = () => {
    if (!running) {
      return;
    }
    measure();
    requestAnimationFrame(tick);
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      last = performance.now();
    }
  };

  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    running = false;
    document.removeEventListener('visibilitychange', handleVisibility);
    if (document.visibilityState === 'visible') {
      measure();
    }
    return longest;
  };
}
