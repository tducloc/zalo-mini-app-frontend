import { useLayoutEffect, useRef, useState } from 'react';

/** The home content's side padding (`px-4`), for the guess before the feed is laid out. */
const SIDE_PADDING_PX = 16;

/**
 * The width measured last. Coming back from a listing mounts the feed again, and the page
 * restores its scroll position in that same commit: the list must already be its real height.
 */
let lastWidth: number | undefined;

/** The feed's width, known on the first render and kept up to date (rotation, split view). */
export function useFeedWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(
    () => lastWidth ?? Math.max(0, window.innerWidth - 2 * SIDE_PADDING_PX),
  );

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = (next: number) => {
      // Zero while not laid out (a hidden page): keep the last real width.
      if (next <= 0) {
        return;
      }
      lastWidth = next;
      setWidth(next);
    };

    // Before the first paint, so a wrong guess never shows.
    update(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
