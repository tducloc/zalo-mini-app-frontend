import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { ProductDetail } from '@/features/products/types/product';
import { isPlayRefused } from '@/features/reels/utils/reel-player';
import { videoPool } from '@/lib/video-pool';
import { useDetailSoundStore } from '@/stores/detail-sound';

// Half on screen, as Reels counts its detail pane as shown. The reel has stopped by then,
// so the two never play together.
const ON_SCREEN_RATIO = 0.5;

const fillClass = 'absolute inset-0 size-full object-contain';
// Its own layer: iOS paints a playing video over siblings that have none.
const soundButtonClass =
  'absolute bottom-3 left-3 z-[2] grid size-8 transform-gpu place-items-center rounded-full border-0 bg-black/[.58] p-0 text-white';

/**
 * The listing's video, without controls, playing while its slide is the active one and on
 * screen: it stops when swiped away, scrolled past, covered by the lightbox, hidden in Reels
 * or with the app in the background. It starts with sound, unless the viewer muted it or the
 * WebView refuses sound before a tap on the speaker. It plays in the detail's pooled element, because
 * iOS refuses to play one made after the viewer's last touch. The poster shows meanwhile.
 */
export default function GalleryVideo({
  item,
  title,
  isActive,
  isCovered,
  slideClass,
  onOpen,
}: {
  item: ProductDetail['media'][number];
  title: string;
  isActive: boolean;
  isCovered: boolean;
  slideClass: string;
  onOpen: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isMuted = useDetailSoundStore((state) => state.isMuted);
  const setMuted = useDetailSoundStore((state) => state.setMuted);
  const src = item.mediumUrl;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src || !isActive || isCovered) {
      return;
    }

    let isOnScreen = false;
    let release: (() => void) | null = null;

    const stop = () => {
      release?.();
      release = null;
      videoRef.current = null;
    };

    const sync = () => {
      if (!isOnScreen || document.hidden) {
        stop();
        return;
      }
      if (release) {
        return;
      }

      const claim = videoPool.claim('shared', host);
      const video = claim.video;
      video.className = fillClass;
      video.setAttribute('aria-label', `Video: ${title}`);
      video.muted = useDetailSoundStore.getState().isMuted;
      video.loop = true;
      video.src = src;
      release = claim.release;
      videoRef.current = video;

      video.play().catch((error: unknown) => {
        if (!isPlayRefused(error) || video.muted || release !== claim.release) {
          return;
        }
        // WebKit plays with sound only from a tap, or once a tap played this element with
        // sound; muted, it may start on its own.
        video.muted = true;
        setMuted(true);
        video.play().catch(() => undefined);
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isOnScreen = entry.intersectionRatio >= ON_SCREEN_RATIO;
        sync();
      },
      { threshold: ON_SCREEN_RATIO },
    );
    observer.observe(host);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      stop();
    };
  }, [src, title, isActive, isCovered, setMuted]);

  const handleToggleSound = () => {
    setMuted(!isMuted);
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = !isMuted;
    if (isMuted) {
      // Within the tap: WebKit pauses a video unmuted outside a user gesture.
      video.play().catch(() => {
        video.muted = true;
        setMuted(true);
      });
    }
  };

  return (
    <div className={slideClass}>
      <button
        aria-label="Xem video toàn màn hình"
        className="absolute inset-0 size-full border-0 bg-transparent p-0"
        type="button"
        onClick={onOpen}
      >
        {item.thumbnailUrl && <img alt="" className={fillClass} src={item.thumbnailUrl} />}
        <div ref={hostRef} className="absolute inset-0" />
      </button>
      <button
        aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        className={soundButtonClass}
        type="button"
        onClick={handleToggleSound}
      >
        {isMuted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      </button>
    </div>
  );
}
