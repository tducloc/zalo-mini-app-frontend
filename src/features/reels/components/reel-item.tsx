import { Icon } from 'zmp-ui';

import ReelOverlay from '@/features/reels/components/reel-overlay';
import { reelHeightClass } from '@/features/reels/constants/styles';
import { useReelPlayback } from '@/features/reels/hooks/use-reel-playback';
import type { ReelItem as Reel } from '@/features/reels/types/reel';
import { shouldPlay } from '@/features/reels/utils/reel-player';
import type { ReelSlot } from '@/features/reels/utils/reel-slot';

export default function ReelItem({
  reel,
  index,
  slot,
  isAppVisible,
  onOpen,
}: {
  reel: Reel;
  index: number;
  slot: ReelSlot;
  isAppVisible: boolean;
  onOpen: () => void;
}) {
  const playback = useReelPlayback(reel, index, slot, isAppVisible);
  const showPlay =
    playback.isActive && (playback.status === 'paused' || playback.status === 'blocked');

  return (
    <section
      className={`relative w-full snap-start snap-always overflow-hidden bg-black ${reelHeightClass}`}
      data-reel-index={index}
      aria-label={reel.title}
    >
      {playback.placeholder && (
        <img
          className={`absolute inset-0 size-full ${playback.fitClass}`}
          src={playback.placeholder}
          alt=""
          aria-hidden
        />
      )}

      {playback.posterUrl && (
        <img
          className={`absolute inset-0 size-full ${playback.fitClass}`}
          src={playback.posterUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
        />
      )}

      <div ref={playback.hostRef} className="absolute inset-0 z-0" />

      <button
        className="absolute inset-0 z-[1] grid size-full transform-gpu place-items-center border-0 bg-transparent p-0 text-white"
        type="button"
        aria-label={
          playback.isActive && shouldPlay(playback.status) ? 'Tạm dừng video' : 'Phát video'
        }
        disabled={playback.status === 'failed'}
        onClick={playback.handleTap}
      >
        {showPlay && (
          <span className="grid size-[72px] place-items-center rounded-full bg-black/45 pl-1">
            <Icon icon="zi-play-solid" size={40} />
          </span>
        )}
        {playback.status === 'failed' && (
          <span className="rounded-lg bg-black/60 px-3 py-2 text-sm font-semibold">
            Không phát được video
          </span>
        )}
      </button>

      <ReelOverlay
        reel={reel}
        videoRef={playback.videoRef}
        isPlaying={playback.status === 'playing'}
        isLoading={playback.isSlowToStart}
        isMuted={playback.isMuted}
        onToggleSound={playback.handleToggleSound}
        onOpen={onOpen}
      />
    </section>
  );
}
