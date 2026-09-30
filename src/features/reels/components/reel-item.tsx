import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import { Icon } from 'zmp-ui';

import ReelOverlay from '@/features/reels/components/reel-overlay';
import { reelHeightClass, spinnerClass } from '@/features/reels/constants/styles';
import { videoPool } from '@/features/reels/services/video-pool';
import type { ReelItem as Reel } from '@/features/reels/types/reel';
import { isPlayRefused, reelPlayer, shouldPlay } from '@/features/reels/utils/reel-player';
import type { ReelSlot } from '@/features/reels/utils/reel-slot';
import { useReelsStore } from '@/stores/reels';

const SPINNER_DELAY_MS = 400;

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
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isActive = slot === 'active' && isAppVisible;
  // A reel that mounts on screen plays in its first effects, which the Reels tab tap runs
  // inside the tap (flushSync): the one moment WebKit allows sound.
  // Including off screen. A paused start paints the play icon for one frame when the
  // reel becomes active. Idle reels still have no source.
  const [status, dispatch] = useReducer(reelPlayer, 'loading');
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const isMuted = useReelsStore((state) => state.isMuted);
  const setMuted = useReelsStore((state) => state.setMuted);

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
    if (video.getAttribute('src') !== src) {
      video.src = src;
    }
    // A play() started just before the reel left can still fire. Applying it would
    // mark an off-screen reel as playing after deactivated put it back to loading.
    const handlePlaying = () => {
      if (isActiveRef.current) dispatch({ type: 'playing' });
    };
    const handleWaiting = () => {
      if (isActiveRef.current) dispatch({ type: 'waiting' });
    };
    const handleError = () => {
      // Changing src on the shared element aborts the previous load.
      if (!isActiveRef.current || video.error?.code === MediaError.MEDIA_ERR_ABORTED) {
        return;
      }
      if (video.getAttribute('src') !== src) {
        return;
      }
      dispatch({ type: 'errored' });
    };
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
    video.play().catch((error: unknown) => {
      if (!isActiveRef.current || !isPlayRefused(error)) {
        return;
      }
      dispatch({ type: 'refused', wasMuted: video.muted });
      if (!video.muted) {
        setMuted(true);
      }
    });
  }, [src, isPlayWanted, isMuted, setMuted]);

  const handleTap = () => {
    if (!shouldPlay(status)) {
      // Within the tap: a WebView that refused to autoplay lets a user gesture play.
      videoRef.current?.play().catch(() => undefined);
    }
    dispatch({ type: 'tapped' });
  };

  const handleToggleSound = () => {
    const video = videoRef.current;
    // Within the tap too: WebKit pauses an autoplaying video unmuted outside a user gesture.
    if (video) {
      video.muted = !isMuted;
      if (isMuted && isActive) {
        video.play().catch((error: unknown) => {
          if (isPlayRefused(error)) {
            video.muted = true;
            setMuted(true);
          }
        });
      }
    }
    setMuted(!isMuted);
  };

  return (
    <section
      className={`relative w-full snap-start snap-always overflow-hidden bg-black ${reelHeightClass}`}
      data-reel-index={index}
      aria-label={reel.title}
    >
      {placeholder && (
        <img
          className={`absolute inset-0 size-full ${fitClass}`}
          src={placeholder}
          alt=""
          aria-hidden
        />
      )}
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
      <div ref={hostRef} className="absolute inset-0 z-0" />

      <button
        className="absolute inset-0 z-[1] grid size-full transform-gpu place-items-center border-0 bg-transparent p-0 text-white"
        type="button"
        aria-label={isActive && shouldPlay(status) ? 'Tạm dừng video' : 'Phát video'}
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
        onOpen={onOpen}
      />
    </section>
  );
}

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
