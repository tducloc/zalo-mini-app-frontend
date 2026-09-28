import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import { Icon } from 'zmp-ui';

import ReelOverlay from '@/features/reels/components/reel-overlay';
import { reelHeightClass, spinnerClass } from '@/features/reels/constants/styles';
import { videoPool } from '@/features/reels/services/video-pool';
import type { ReelItem as Reel } from '@/features/reels/types/reel';
import { reelPlayer, shouldPlay } from '@/features/reels/utils/reel-player';
import type { ReelSlot } from '@/features/reels/utils/reel-slot';
import { useSwipe } from '@/hooks/use-swipe';
import { useReelsStore } from '@/stores/reels';

/** A start slower than this shows a spinner; a preloaded reel starts well within it. */
const SPINNER_DELAY_MS = 400;

/** The poster's ThumbHash as an image; null when missing or not a ThumbHash. */
function placeholderUrl(hash: string | null) {
  if (!hash) {
    return null;
  }
  try {
    return thumbHashToDataURL(Uint8Array.from(atob(hash), (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

/**
 * One reel: its video (a pool element, borrowed only in the `active` and `next` slots), the
 * poster and its placeholder under it, and the listing over it. A tap pauses or plays.
 */
export default function ReelItem({
  reel,
  index,
  slot,
  isAppVisible,
  onOpen,
}: {
  reel: Reel;
  /** Its place in the list, which the page watches to know the reel on screen. */
  index: number;
  slot: ReelSlot;
  isAppVisible: boolean;
  onOpen: (productId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, dispatch] = useReducer(reelPlayer, 'paused');
  const isMuted = useReelsStore((state) => state.isMuted);
  const setMuted = useReelsStore((state) => state.setMuted);

  const isActive = slot === 'active' && isAppVisible;
  const isPlayWanted = isActive && shouldPlay(status);
  const src = slot !== 'idle' && status !== 'failed' ? reel.video.url : null;
  const { width, height } = reel.video;
  const fitClass = width && height && height < width ? 'object-contain' : 'object-cover';
  const placeholder = useMemo(
    () => placeholderUrl(reel.video.placeholder),
    [reel.video.placeholder],
  );
  const isSlowToStart = useIsLate(isActive && status === 'loading', SPINNER_DELAY_MS);

  useEffect(() => {
    dispatch({ type: isActive ? 'activated' : 'deactivated' });
  }, [isActive]);

  const { posterUrl } = reel.video;
  const label = `Video: ${reel.title}`;
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) {
      return;
    }

    const video = videoPool.claim(index, host);
    video.className = `absolute inset-0 size-full ${fitClass}`;
    video.poster = posterUrl ?? '';
    video.setAttribute('aria-label', label);
    video.src = src;
    const handlePlaying = () => dispatch({ type: 'played' });
    const handleWaiting = () => dispatch({ type: 'stalled' });
    // Dropping the source may fire an error with none to report; only a real one fails.
    const handleError = () => video.error && dispatch({ type: 'errored' });
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('error', handleError);
    videoRef.current = video;

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('error', handleError);
      videoRef.current = null;
      videoPool.release(index, video);
    };
  }, [index, src, fitClass, posterUrl, label]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      return;
    }

    video.muted = isMuted;
    if (!isPlayWanted) {
      video.pause();
      return;
    }
    // Old WebViews return nothing from play().
    video.play()?.catch((error: unknown) => {
      // AbortError is our own source removal; NotAllowedError is the WebView saying no.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) {
        return;
      }
      dispatch({ type: 'refused', wasMuted: video.muted });
      if (!video.muted) {
        // Tried again muted by this effect; the toggle then shows the sound off.
        setMuted(true);
      }
    });
  }, [src, isPlayWanted, isMuted, setMuted]);

  // Swiping left opens the listing, as "Xem chi tiết" does; swiping up still scrolls.
  const swipeHandlers = useSwipe((direction) => direction === 'left' && onOpen(reel.id));

  const handleTap = () => {
    if (!shouldPlay(status)) {
      // Within the tap: a WebView that refused to autoplay lets a user gesture play.
      videoRef.current?.play()?.catch(() => undefined);
    }
    dispatch({ type: 'tapped' });
  };

  const handleToggleSound = () => {
    const video = videoRef.current;
    // Within the tap too: WebKit pauses an autoplaying video unmuted outside a user gesture.
    if (video) {
      video.muted = !isMuted;
    }
    setMuted(!isMuted);
  };

  return (
    <section
      className={`relative w-full touch-pan-y snap-start snap-always overflow-hidden bg-black ${reelHeightClass}`}
      data-reel-index={index}
      aria-label={reel.title}
      {...swipeHandlers}
    >
      {placeholder && (
        <img
          className={`absolute inset-0 size-full ${fitClass}`}
          src={placeholder}
          alt=""
          aria-hidden
        />
      )}
      {/* Shown until the reel borrows a video, which covers it with the same poster. */}
      {posterUrl && (
        <img
          className={`absolute inset-0 size-full ${fitClass}`}
          src={posterUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
        />
      )}
      <div ref={hostRef} className="absolute inset-0" />

      <button
        className="absolute inset-0 grid size-full place-items-center border-0 bg-transparent p-0 text-white"
        type="button"
        aria-label={shouldPlay(status) ? 'Tạm dừng video' : 'Phát video'}
        disabled={status === 'failed'}
        onClick={handleTap}
      >
        {(status === 'paused' || status === 'blocked') && isActive && (
          <span className="grid size-[72px] place-items-center rounded-full bg-black/45 pl-1">
            <Icon icon="zi-play-solid" size={40} />
          </span>
        )}
        {isSlowToStart && <span className={spinnerClass} />}
        {status === 'failed' && (
          <span className="rounded-lg bg-black/60 px-3 py-2 text-sm font-semibold">
            Không phát được video
          </span>
        )}
      </button>

      <ReelOverlay
        reel={reel}
        videoRef={videoRef}
        isPlaying={status === 'playing'}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onOpen={() => onOpen(reel.id)}
      />
    </section>
  );
}

/** True once `isOn` has stayed true for `delayMs`. */
function useIsLate(isOn: boolean, delayMs: number) {
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (!isOn) {
      setIsLate(false);
      return;
    }
    const timer = setTimeout(() => setIsLate(true), delayMs);
    return () => clearTimeout(timer);
  }, [isOn, delayMs]);

  return isLate;
}
