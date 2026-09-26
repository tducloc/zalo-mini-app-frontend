import { type ReactNode, useEffect, useRef } from 'react';
import { Icon } from 'zmp-ui';

/**
 * A black dialog over the whole screen for photos and video: a header row with `header`
 * on the left and a close button, which takes focus on open, then `children`.
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // Above zmp-ui's header and sheets; the toast (1100, use-toast) stays above it.
      className="fixed inset-0 z-[1050] flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        {header}
        <button
          ref={closeRef}
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center border-0 bg-transparent text-white"
        >
          <Icon icon="zi-close" size={24} />
        </button>
      </div>

      {children}
    </div>
  );
}
