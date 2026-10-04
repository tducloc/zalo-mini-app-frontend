import { useLayoutEffect, useRef, useState } from 'react';

const SIDE_PADDING_PX = 16;

/**
 * zmp-ui's Page restores its scroll position in its mount layout effect, before a width measured
 * here can re-render the list, so the list needs its real height on the first render.
 */
let lastWidth: number | undefined;

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
      if (next <= 0) {
        return;
      }
      lastWidth = next;
      setWidth(next);
    };

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
