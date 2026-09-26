import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from 'zmp-ui';

import { usePinchZoom } from '@/features/products/hooks/use-pinch-zoom';
import type { ProductDetail } from '@/features/products/types/product';

type ProductMedia = ProductDetail['media'][number];

interface MediaLightboxProps {
  media: ProductDetail['media'];
  /** The slide the seller tapped. */
  startIndex: number;
  productTitle: string;
  /** With the slide on screen, for the gallery to show it too. */
  onClose: (index: number) => void;
}

/**
 * The listing's photos and video on the whole screen: swipe through all of them, as the
 * gallery counts them, zoom a photo, play the video. Replaces zmp-ui's ImageViewer, which
 * takes photos only, so its count never matched the gallery's.
 */
export default function MediaLightbox({
  media,
  startIndex,
  productTitle,
  onClose,
}: MediaLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(startIndex);
  // A zoomed photo takes one-finger drags to move, so swiping stops meanwhile.
  const [isZoomed, setIsZoomed] = useState(false);

  // Before paint, so the first frame already shows the tapped slide.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) {
      track.scrollLeft = startIndex * track.clientWidth;
    }
  }, [startIndex]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const handleScroll = () => {
    const track = trackRef.current;
    if (track && track.clientWidth > 0) {
      setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh và video: ${productTitle}`}
      // Above the page's header and sheets, as the listing form's viewer.
      className="fixed inset-0 z-[1050] flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <span className="px-2 text-sm tabular-nums" aria-live="polite">
          {activeIndex + 1} / {media.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          aria-label="Đóng"
          onClick={() => onClose(activeIndex)}
          className="grid h-11 w-11 place-items-center border-0 bg-transparent text-white"
        >
          <Icon icon="zi-close" size={24} />
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        className={`flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          isZoomed ? 'overflow-hidden' : 'overflow-x-auto'
        }`}
      >
        {media.map((item, index) => (
          <div
            key={item.id}
            className="grid h-full w-full shrink-0 snap-center place-items-center overflow-hidden"
          >
            {item.type === 'VIDEO' ? (
              <LightboxVideo item={item} isActive={index === activeIndex} title={productTitle} />
            ) : (
              <ZoomablePhoto item={item} title={productTitle} onZoomChange={setIsZoomed} />
            )}
          </div>
        ))}
      </div>
      <div className="pb-[max(12px,env(safe-area-inset-bottom))]" />
    </div>
  );
}

/** Loads only while it is the slide shown, which also stops it when swiped away. */
function LightboxVideo({
  item,
  isActive,
  title,
}: {
  item: ProductMedia;
  isActive: boolean;
  title: string;
}) {
  return (
    <video
      aria-label={`Video: ${title}`}
      className="h-full w-full object-contain"
      controls
      playsInline
      poster={item.thumbnailUrl ?? undefined}
      preload="none"
      src={isActive ? (item.mediumUrl ?? undefined) : undefined}
    />
  );
}

function ZoomablePhoto({
  item,
  title,
  onZoomChange,
}: {
  item: ProductMedia;
  title: string;
  onZoomChange: (isZoomed: boolean) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const { scale, offset, isZoomed, handlers } = usePinchZoom(boxRef, photoRef);

  useEffect(() => {
    onZoomChange(isZoomed);
  }, [isZoomed, onZoomChange]);

  return (
    <div
      ref={boxRef}
      {...handlers}
      // Fitted, the browser keeps horizontal swipes for the track; zoomed, every touch is ours.
      className={`grid h-full w-full place-items-center ${isZoomed ? 'touch-none' : 'touch-pan-x'}`}
    >
      <img
        ref={photoRef}
        alt={title}
        draggable={false}
        src={item.mediumUrl ?? item.thumbnailUrl ?? ''}
        className="max-h-full max-w-full select-none object-contain"
        // Follows the fingers.
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
      />
    </div>
  );
}
