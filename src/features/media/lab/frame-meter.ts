/** The longest gap between animation frames is the main-thread block the user feels. */
export function startFrameMeter() {
  let last = performance.now();
  let longest = 0;
  let running = true;

  const tick = () => {
    if (!running) {
      return;
    }
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return () => {
    running = false;
    return longest;
  };
}
