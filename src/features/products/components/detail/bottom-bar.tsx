import { type ReactNode, useLayoutEffect, useRef } from 'react';

/**
 * The white bar at the bottom of a listing's page, with the buyer's contact or the owner's
 * actions. It tells its height, which changes with the draft banner and wrapped lines, so
 * the page can leave that room at its end.
 */
export default function DetailBottomBar({
  position,
  onHeightChange,
  children,
}: {
  /** Absolute inside Reels, which lays the page over its own. */
  position: 'fixed' | 'absolute';
  onHeightChange: (height: number) => void;
  children: ReactNode;
}) {
  const barRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }

    onHeightChange(bar.offsetHeight);
    const observer = new ResizeObserver(() => onHeightChange(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <footer
      ref={barRef}
      className={`${position} inset-x-0 bottom-0 z-20 border-t border-solid border-marketplace-line bg-white px-4 pb-[calc(12px_+_var(--zaui-safe-area-inset-bottom))] pt-3`}
    >
      {children}
    </footer>
  );
}
