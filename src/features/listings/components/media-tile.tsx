import { Icon } from 'zmp-ui';

import { type TileView, TileTone } from '@/features/listings/draft/media-view';
import { useObjectUrl } from '@/features/listings/hooks/use-object-url';

interface MediaTileProps {
  /** "Ảnh 2", "Video": the tile's accessible name. */
  name: string;
  view: TileView;
  isVideo: boolean;
  /** The file to draw itself when the view has no image; see MediaTile. */
  file: Blob;
  isCover: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onReplace: () => void;
}

/**
 * One photo or the video in the form's grid. Tapping it opens it; the corner buttons
 * remove it or put another file in its place without opening anything.
 */
export default function MediaTile({
  name,
  view,
  isVideo,
  file,
  isCover,
  onOpen,
  onRemove,
  onReplace,
}: MediaTileProps) {
  const isError = view.tone === TileTone.Error;
  // A video shows its own first frame until the server's poster arrives. A photo shows
  // its original only when it failed: decoding ten full-size photos for the grid is what
  // the image worker exists to avoid.
  const localUrl = useObjectUrl(!view.imageUrl && (isVideo || isError) ? file : null);
  const state = isError ? `lỗi: ${view.detail}` : (view.label ?? 'đã sẵn sàng');

  return (
    <li aria-label={name} className="relative aspect-square">
      <button
        type="button"
        aria-label={`${name}, ${state}. Chạm để xem`}
        onClick={onOpen}
        className="relative block h-full w-full overflow-hidden rounded-[10px] border-0 bg-marketplace-pale p-0"
      >
        {view.imageUrl && <img src={view.imageUrl} alt="" className="h-full w-full object-cover" />}
        {!view.imageUrl && localUrl && isVideo && (
          // #t=0.1 makes iOS draw a frame instead of a blank box.
          <video
            src={`${localUrl}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        )}
        {!view.imageUrl && localUrl && !isVideo && (
          <img src={localUrl} alt="" className="h-full w-full object-cover" />
        )}
        {!view.imageUrl && !localUrl && (
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
      <CornerButton
        icon="zi-close"
        label={`Xoá ${name}`}
        isOnPicture={!!view.imageUrl || !!localUrl}
        className="right-0.5 top-0.5"
        onClick={onRemove}
      />
      <CornerButton
        icon="zi-edit"
        label={`Đổi ${isVideo ? 'video' : 'ảnh'} ${name}`}
        isOnPicture={!!view.imageUrl || !!localUrl}
        className="left-0.5 top-0.5"
        onClick={onReplace}
      />
    </li>
  );
}

/**
 * A bare icon on a tile's top corner (remove right, replace left), at the same inset; the
 * bottom edge is the cover's strip. White with a shadow over a picture, which can be light
 * or dark; dark on the empty tile.
 */
function CornerButton({
  icon,
  label,
  isOnPicture,
  className,
  onClick,
}: {
  icon: 'zi-close' | 'zi-edit';
  label: string;
  isOnPicture: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute grid h-7 w-7 place-items-center border-0 bg-transparent p-0 ${
        isOnPicture ? 'text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.7)]' : 'text-marketplace-ink'
      } ${className}`}
    >
      <Icon icon={icon} size={20} />
    </button>
  );
}

/** The overlay while the file is on its way: a spinner or a percentage, and a bar. */
function TileStatus({ view }: { view: TileView }) {
  const hasProgress = view.progress !== null;
  const isWaiting = view.tone === TileTone.Waiting;

  return (
    <span className="absolute inset-0 grid place-content-center gap-1 bg-marketplace-ink/60 px-1 text-center text-micro text-white">
      {isWaiting && <Icon icon="zi-backup-warning-solid" size={20} className="mx-auto" />}
      {!isWaiting && !hasProgress && (
        <i className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {hasProgress && !isWaiting && (
        <b className="text-sm">{Math.round((view.progress ?? 0) * 100)}%</b>
      )}
      <span>{view.label}</span>
      {hasProgress && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
          <span
            className="block h-full bg-white"
            // Width follows the upload or conversion as it goes.
            style={{ width: `${Math.round((view.progress ?? 0) * 100)}%` }}
          />
        </span>
      )}
    </span>
  );
}
