import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from 'zmp-ui';

/**
 * A black dialog over the whole screen for photos and video: a header row with a close
 * button, which takes focus on open, and `header` in the middle; then `children`.
 *
 * In `body`, not in the page: on iOS, zmp-ui's `-webkit-overflow-scrolling: touch` makes
 * each page a stacking context, so a z-index inside it cannot rise above the tab bar. The close button is on the left, as Zalo's own
 * "… ✕" sits on the right of this row.
 */
export default function FullscreenDialog({
  label,
  header,
  onClose,
  children,
}: {
  label: string;
  header: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // Above zmp-ui's header and sheets; the toast (1100, use-toast) stays above it.
      className="fixed inset-0 z-[1050] flex flex-col bg-black text-white"
    >
      {/* The same width on each side of `header`, so it sits in the middle. */}
      <div className="grid grid-cols-[44px_1fr_44px] items-center px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          ref={closeRef}
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center border-0 bg-transparent text-white"
        >
          <Icon icon="zi-close" size={24} />
        </button>
        <div className="min-w-0 text-center">{header}</div>
      </div>

      {children}
    </div>,
    document.body,
  );
}
