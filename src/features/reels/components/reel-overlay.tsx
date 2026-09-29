import { Volume2, VolumeX } from 'lucide-react';
import { type RefObject, useEffect, useRef } from 'react';
import { Icon } from 'zmp-ui';

import Price from '@/components/price';
import type { ReelItem } from '@/features/reels/types/reel';

const avatarClass =
  'grid size-8 flex-none place-items-center overflow-hidden rounded-full bg-marketplace-highlight object-cover text-sm font-bold text-marketplace-blue';
// In the 44px row under the status bar, like Home's title: Zalo's capsule takes its right end.
const soundButtonClass =
  'pointer-events-auto absolute left-3 top-[calc(max(24px,var(--zaui-safe-area-inset-top,env(safe-area-inset-top,0px)))_+_2px)] grid size-10 place-items-center rounded-full border-0 bg-black/40 p-0 text-white';
const detailsClass =
  'absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pb-5 pt-20 text-white [.has-draft-banner_&]:pb-[82px]';

export default function ReelOverlay({
  reel,
  videoRef,
  isPlaying,
  isMuted,
  onToggleSound,
  onOpen,
}: {
  reel: ReelItem;
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpen: () => void;
}) {
  const sellerName = reel.seller.name ?? 'Người bán Zalo';

  return (
    // Its own layer: iOS paints a playing video over siblings that have none.
    <div className="pointer-events-none absolute inset-0 z-[2] transform-gpu">
      <button
        className={soundButtonClass}
        type="button"
        aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        onClick={onToggleSound}
      >
        {isMuted ? <VolumeX size={22} aria-hidden /> : <Volume2 size={22} aria-hidden />}
      </button>

      <div className={detailsClass}>
        <p className="m-0 flex items-center gap-2 text-sm font-semibold leading-5">
          {reel.seller.avatarUrl ? (
            <img className={avatarClass} src={reel.seller.avatarUrl} alt="" />
          ) : (
            <span className={avatarClass} aria-hidden>
              {sellerName[0]}
            </span>
          )}
          <span className="min-w-0 truncate">{sellerName}</span>
        </p>
        <h2 className="m-0 line-clamp-2 text-[15px] font-semibold leading-5">{reel.title}</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <Price
              className="m-0 rounded-md bg-white px-2 py-0.5 text-[15px] leading-5"
              value={reel.price}
            />
            <p className="m-0 flex min-w-0 max-w-full items-center gap-1 text-caption leading-4 text-white/85">
              <Icon icon="zi-location" size={14} />
              <span className="truncate">{reel.location.name}</span>
            </p>
          </div>
          <button
            className="pointer-events-auto h-9 flex-none rounded-full border-0 bg-marketplace-blue px-4 text-sm font-semibold text-white"
            type="button"
            onClick={onOpen}
          >
            Xem chi tiết
          </button>
        </div>
      </div>

      <ProgressBar videoRef={videoRef} isPlaying={isPlaying} />
    </div>
  );
}

function ProgressBar({
  videoRef,
  isPlaying,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const bar = barRef.current;
    if (!video || !bar) {
      return;
    }

    let frame = 0;
    const draw = () => {
      const share = video.duration > 0 ? Math.min(1, video.currentTime / video.duration) : 0;
      bar.style.transform = `scaleX(${share})`;
      if (isPlaying) {
        frame = requestAnimationFrame(draw);
      }
    };
    draw();

    return () => cancelAnimationFrame(frame);
  }, [videoRef, isPlaying]);

  return (
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25" aria-hidden>
      <div ref={barRef} className="h-full origin-left scale-x-0 bg-white" />
    </div>
  );
}
