import { useEffect, useRef, useState } from 'react';
import { Icon } from 'zmp-ui';

import { useObjectUrl } from '@/features/listings/hooks/use-object-url';
import { TileTone, type TileView } from '@/features/listings/types/tile-view';

interface MediaViewerProps {
  /** "Ảnh 2" or "Video". */
  name: string;
  /** What the file's tile shows. */
  view: TileView;
  isVideo: boolean;
  /** Shown from an object URL when the view has no image: the video, or an original photo. */
  file: Blob;
  onRetry: () => void;
  /** Null for the video and for the photo that is already the cover. */
  onMakeCover: (() => void) | null;
  onRemove: () => void;
  onClose: () => void;
}

type ViewerIcon = 'zi-delete' | 'zi-retry' | 'zi-star';

/**
 * A draft photo or video on the whole screen, failed or not: for a failure, why, and
 * retry when that can fix it; make a photo the cover (for those who cannot drag, e.g. with
 * a screen reader); remove. One file at a time: zmp-ui's ImageViewer swipes,
 * but cannot say which photo an action is for. Rendered only while open, keyed by the file.
 */
export default function MediaViewer({
  name,
  view,
  isVideo,
  file,
  onRetry,
  onMakeCover,
  onRemove,
  onClose,
}: MediaViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileUrl = useObjectUrl(isVideo || !view.imageUrl ? file : null);
  // A file the WebView cannot show (e.g. an HEVC clip) gets an icon instead of black. Per
  // source: the converted clip that replaces it can play.
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const isError = view.tone === TileTone.Error;
  const source = isVideo ? fileUrl : (view.imageUrl ?? fileUrl);
  const isShown = !!source && source !== failedSource;
  const handleMediaError = () => setFailedSource(source);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      // Above zmp-ui's header and sheets; the toast (1100, use-toast) stays above it.
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
        {!isShown && (
          <Icon icon={isVideo ? 'zi-video' : 'zi-photo'} size={48} className="text-white/40" />
        )}
        {isShown && isVideo && (
          <video
            src={source}
            controls
            playsInline
            onError={handleMediaError}
            className="max-h-full max-w-full"
          />
        )}
        {isShown && !isVideo && (
          <img
            src={source}
            alt={name}
            onError={handleMediaError}
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
        {onMakeCover && (
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
