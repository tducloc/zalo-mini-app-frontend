import { useEffect, useRef, useState } from 'react';
import { Icon } from 'zmp-ui';

interface MediaViewerProps {
  /** "Ảnh 2" or "Video"; null keeps the viewer closed. */
  name: string | null;
  isVideo: boolean;
  /** The optimized photo or the server's thumbnail, when there is one. */
  imageUrl: string | null;
  /** Shown from an object URL when there is no image URL: the video, or an original photo. */
  file: Blob | null;
  /** What the file is waiting for, e.g. the network; null when nothing to say. */
  status: string | null;
  canBeCover: boolean;
  onMakeCover: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * A draft photo or video on the whole screen, with what the seller can do with it. One
 * file at a time: zmp-ui's ImageViewer swipes, but cannot say which photo an action is for.
 */
export default function MediaViewer({
  name,
  isVideo,
  imageUrl,
  file,
  status,
  canBeCover,
  onMakeCover,
  onRemove,
  onClose,
}: MediaViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileUrl = useObjectUrl(name !== null && (isVideo || !imageUrl) ? file : null);

  useEffect(() => {
    if (name === null) {
      return;
    }
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [name, onClose]);

  if (name === null) {
    return null;
  }

  const source = isVideo ? fileUrl : (imageUrl ?? fileUrl);

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
        {source && isVideo && (
          <video src={source} controls playsInline className="max-h-full max-w-full" />
        )}
        {source && !isVideo && (
          <img src={source} alt={name} className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {status && (
        <p role="status" className="m-0 px-4 pb-2 text-center text-sm text-white/80">
          {status}
        </p>
      )}
      <div className="flex justify-center gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
        {canBeCover && (
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
  icon: 'zi-star' | 'zi-delete';
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

/** An object URL for `blob` while it is shown, revoked after. */
function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const created = URL.createObjectURL(blob);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [blob]);

  return url;
}
