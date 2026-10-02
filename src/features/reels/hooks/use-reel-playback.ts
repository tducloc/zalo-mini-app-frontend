import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { videoPool } from '@/features/reels/services/video-pool';
import type { ReelItem as Reel } from '@/features/reels/types/reel';
import { isPlayRefused, reelPlayer, shouldPlay } from '@/features/reels/utils/reel-player';
import type { ReelSlot } from '@/features/reels/utils/reel-slot';
import { useReelsStore } from '@/stores/reels';
import { thumbHashUrl } from '@/utils/thumbhash';

const LOADING_BAR_DELAY_MS = 1000;

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

/** Attaches the shared video element and keeps its play, pause and sound in one place. */
export function useReelPlayback(reel: Reel, index: number, slot: ReelSlot, isAppVisible: boolean) {
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

  const { width, height, posterUrl } = reel.video;
  const fitClass = width && height && height < width ? 'object-contain' : 'object-cover';
  const placeholder = useMemo(() => thumbHashUrl(reel.video.placeholder), [reel.video.placeholder]);
  const isSlowToStart = useIsLate(isActive && status === 'loading', LOADING_BAR_DELAY_MS);
  const label = `Video: ${reel.title}`;

  useEffect(() => {
    dispatch({ type: isActive ? 'activated' : 'deactivated' });
  }, [isActive]);

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
      if (isActiveRef.current) {
        dispatch({ type: 'playing' });
      }
    };
    const handleWaiting = () => {
      if (isActiveRef.current) {
        dispatch({ type: 'waiting' });
      }
    };
    const handleError = () => {
      // Changing src on the shared element aborts the previous load.
      const aborted = video.error?.code === MediaError.MEDIA_ERR_ABORTED;
      const stillThisClip = video.getAttribute('src') === src;
      if (!isActiveRef.current || aborted || !stillThisClip) {
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

  return {
    hostRef,
    videoRef,
    status,
    isActive,
    isMuted,
    isSlowToStart,
    fitClass,
    placeholder,
    posterUrl,
    handleTap,
    handleToggleSound,
  };
}
