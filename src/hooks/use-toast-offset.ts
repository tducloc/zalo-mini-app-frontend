import { useLayoutEffect } from 'react';

/** Heights of the bars on screen now, by the one that reported each. */
const barHeights = new Map<symbol, number>();

function applyToastOffset() {
  const offset = Math.max(0, ...barHeights.values());
  document.documentElement.style.setProperty('--toast-bottom-offset', `${offset}px`);
}

/**
 * A bar fixed to the bottom of the screen (the tab bar, a listing's bottom bar) reports
 * its height while shown, so toasts open above the tallest one instead of over it
 * (app.scss). Null or 0 while it is not shown.
 */
export function useToastOffset(height: number | null) {
  useLayoutEffect(() => {
    if (!height) {
      return;
    }

    const key = Symbol('bar');
    barHeights.set(key, height);
    applyToastOffset();
    return () => {
      barHeights.delete(key);
      applyToastOffset();
    };
  }, [height]);
}
