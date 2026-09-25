import { useEffect, useRef, useState } from 'react';
import { Icon } from 'zmp-ui';

import { type TileView, TileTone } from '@/features/listings/draft/media-view';
import { useObjectUrl } from '@/features/listings/hooks/use-object-url';

interface MediaViewerProps {
  /** "Ảnh 2" or "Video". */
  name: string;
  /** What the file's tile shows; null keeps the viewer closed. */
  view: TileView | null;
  isVideo: boolean;
  /** Shown from an object URL when the view has no image: the video, or an original photo. */
  file: Blob | null;
  canBeCover: boolean;
  onMakeCover: () => void;
  onRetry: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onClose: () => void;
}

type ViewerIcon = 'zi-star' | 'zi-delete' | 'zi-retry' | 'zi-edit';

/**
 * A draft photo or video on the whole screen, failed or not, with what the seller can do
 * with it: make it the cover, or for a failure read why and retry or replace it; remove.
 * One file at a time: zmp-ui's ImageViewer swipes, but cannot say which photo an action
 * is for.
 */
export default function MediaViewer({
  name,
  view,
  isVideo,
  file,
  canBeCover,
  onMakeCover,
  onRetry,
  onReplace,
  onRemove,
  onClose,
}: MediaViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = view !== null;
  const fileUrl = useObjectUrl(isOpen && (isVideo || !view.imageUrl) ? file : null);
  // A file the WebView cannot show (e.g. an HEVC clip) gets an icon instead of black.
  const [hasFailedToShow, setHasFailedToShow] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setHasFailedToShow(false);
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isError = view.tone === TileTone.Error;
  const source = isVideo ? fileUrl : (view.imageUrl ?? fileUrl);
  const handleShowError = () => setHasFailedToShow(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      className="fixed inset-0 z-[1050] flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <span className="px-2 text-base font-semibold">{name}</span>
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

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {(!source || hasFailedToShow) && (
          <Icon icon={isVideo ? 'zi-video' : 'zi-photo'} size={48} className="text-white/40" />
        )}
        {source && !hasFailedToShow && isVideo && (
          <video
            src={source}
            controls
            playsInline
            onError={handleShowError}
            className="max-h-full max-w-full"
          />
        )}
        {source && !hasFailedToShow && !isVideo && (
          <img
            src={source}
            alt={name}
            onError={handleShowError}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {view.detail && (
        <p
          role={isError ? 'alert' : 'status'}
          className={`mx-4 mb-2 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
            isError ? 'bg-marketplace-danger/20 text-white' : 'text-white/80'
          }`}
        >
          {isError && <Icon icon="zi-warning-circle-solid" size={20} className="shrink-0" />}
          <span>{view.detail}</span>
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
        {view.canRetry && <ViewerAction icon="zi-retry" label="Thử lại" onClick={onRetry} />}
        {isError && <ViewerAction icon="zi-edit" label="Chọn tệp khác" onClick={onReplace} />}
        {canBeCover && !isError && (
          <ViewerAction icon="zi-star" label="Đặt làm ảnh bìa" onClick={onMakeCover} />
        )}
        <ViewerAction icon="zi-delete" label="Xoá" onClick={onRemove} />
      </div>
    </div>
  );
}

/** A light-on-dark button, like the controls of a photo viewer. */
function ViewerAction({
  icon,
  label,
  onClick,
}: {
  icon: ViewerIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-2 rounded-full border-0 bg-white/15 px-5 text-sm font-medium text-white active:bg-white/25"
    >
      <Icon icon={icon} size={20} />
      {label}
    </button>
  );
}
