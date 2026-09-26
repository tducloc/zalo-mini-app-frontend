import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { Icon } from 'zmp-ui';

import { useObjectUrl } from '@/features/listings/hooks/use-object-url';
import { TileTone, type TileView } from '@/features/listings/types/tile-view';

interface MediaTileProps {
  /** The draft file's id: what a drag moves. */
  id: string;
  /** "Ảnh 2", "Video": the tile's accessible name. */
  name: string;
  view: TileView;
  isVideo: boolean;
  /** The file to draw itself when the view has no image; see `localUrl` below. */
  file: Blob;
  isCover: boolean;
  onOpen: () => void;
  onRemove: () => void;
}

/**
 * One photo or the video in the form's grid. Tapping it opens it, the corner button
 * removes it. A photo can be held and dragged to another place (MediaSection's
 * DndContext); the video has its own slot and does not move.
 */
export default function MediaTile({
  id,
  name,
  view,
  isVideo,
  file,
  isCover,
  onOpen,
  onRemove,
}: MediaTileProps) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id,
    disabled: isVideo,
  });

  const isError = view.tone === TileTone.Error;
  // A video shows its own first frame until the server's poster arrives. A photo shows
  // its original only when it failed: decoding ten full-size photos for the grid is what
  // the image worker exists to avoid.
  const localUrl = useObjectUrl(!view.imageUrl && (isVideo || isError) ? file : null);
  // A picture that does not load (an unreadable file) falls back to the icon.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const pictureUrl = view.imageUrl ?? localUrl;
  const isPictureShown = !!pictureUrl && pictureUrl !== failedUrl;
  const isVideoFrame = isVideo && !view.imageUrl;
  // The reason is in the viewer, which the tap opens.
  // Mid-sentence in the label, so lower case: the tile shows the same words capitalized.
  const statusText = isError ? 'có lỗi' : (view.label?.toLocaleLowerCase('vi') ?? 'đã sẵn sàng');

  const handlePictureError = () => setFailedUrl(pictureUrl);

  return (
    <li
      ref={setNodeRef}
      aria-label={name}
      // Follows the finger while dragged, and slides aside for the dragged photo.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // No iOS callout or text selection on the long press that starts a drag.
      className={`relative aspect-square select-none [-webkit-touch-callout:none] ${
        isDragging ? 'z-10 opacity-80 shadow-lg' : ''
      }`}
      // Not dnd-kit's `attributes`: they would make the item a button around real buttons.
      {...listeners}
    >
      <button
        type="button"
        aria-label={`${name}, ${statusText}. Chạm để xem`}
        onClick={onOpen}
        className="relative block h-full w-full overflow-hidden rounded-[10px] border-0 bg-marketplace-pale p-0"
      >
        {isPictureShown && isVideoFrame && (
          // #t=0.1 makes iOS draw a frame instead of a blank box.
          <video
            src={`${pictureUrl}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            onError={handlePictureError}
            className="h-full w-full object-cover"
          />
        )}
        {isPictureShown && !isVideoFrame && (
          <img
            src={pictureUrl}
            alt=""
            decoding="async"
            onError={handlePictureError}
            className="h-full w-full object-cover"
          />
        )}
        {!isPictureShown && (
          <span className="grid h-full w-full place-items-center text-marketplace-muted">
            <Icon icon={isVideo ? 'zi-video' : 'zi-photo'} size={28} />
          </span>
        )}

        {isCover && (
          <span className="absolute inset-x-0 bottom-0 bg-marketplace-blue/90 py-0.5 text-center text-micro font-semibold text-white">
            Ảnh bìa
          </span>
        )}

        {isVideo && !view.label && !isError && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">
              <Icon icon="zi-play-solid" size={20} />
            </span>
          </span>
        )}

        {view.label && <TileStatus view={view} />}
      </button>

      {/* A badge, as photo libraries mark a failed sync: the picture stays as it is. The
          viewer gives the reason, so there is one message per error. */}
      {isError && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-1 grid h-5 w-5 place-items-center rounded-full bg-marketplace-danger text-xs font-bold text-white ring-2 ring-white ${
            isCover ? 'bottom-6' : 'bottom-1'
          }`}
        >
          !
        </span>
      )}
      <button
        type="button"
        aria-label={`Xoá ${name}`}
        onClick={onRemove}
        className={`absolute right-0.5 top-0.5 grid h-7 w-7 place-items-center border-0 bg-transparent p-0 ${
          // White with a shadow over a picture, which can be light or dark.
          isPictureShown
            ? 'text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.7)]'
            : 'text-marketplace-ink'
        }`}
      >
        <Icon icon="zi-close" size={20} />
      </button>
    </li>
  );
}

/** The overlay while the file is on its way: a spinner or a percentage, and a bar. */
function TileStatus({ view }: { view: TileView }) {
  const hasProgress = view.progress !== null;
  const percent = Math.round((view.progress ?? 0) * 100);
  const isWaiting = view.tone === TileTone.Waiting;

  return (
    <span className="absolute inset-0 grid place-content-center gap-1 bg-marketplace-ink/60 px-1 text-center text-micro text-white">
      {isWaiting && <Icon icon="zi-backup-warning-solid" size={20} className="mx-auto" />}
      {!isWaiting && !hasProgress && (
        <i className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {hasProgress && !isWaiting && <b className="text-sm">{percent}%</b>}
      <span>{view.label}</span>
      {hasProgress && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <span
            className="block h-full bg-white"
            // Width follows the upload or conversion as it goes.
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </span>
  );
}
