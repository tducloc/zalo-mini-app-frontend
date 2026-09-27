import { type TouchEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import FullscreenDialog from '@/components/fullscreen-dialog';
import type { ProductDetail } from '@/features/products/types/product';
import { MAX_SCALE, MIN_SCALE, NO_OFFSET } from '@/features/products/constants/zoom';
import type { Point, Size } from '@/features/products/types/zoom';

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

  const handleScroll = () => {
    const track = trackRef.current;
    if (track && track.clientWidth > 0) {
      setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
    }
  };

  return (
    <FullscreenDialog
      label={`Ảnh và video: ${productTitle}`}
      header={
        <span className="px-2 text-sm tabular-nums" aria-live="polite">
          {activeIndex + 1} / {media.length}
        </span>
      }
      onClose={() => onClose(activeIndex)}
    >
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
    </FullscreenDialog>
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

/** What a double tap zooms to, and back from. */
const DOUBLE_TAP_SCALE = 2.5;

/** Below this, a pinch that ends is taken as "back to fit". */
const FIT_SNAP_SCALE = 1.05;

/** Two taps within this, close together, are a double tap. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 30;

interface Gesture {
  /** Pinch: the fingers' distance and the zoom when it started. */
  startDistance: number;
  startScale: number;
  /** Pan or pinch: where the photo was, and the fingers' point, when it started. */
  startOffset: Point;
  startFocus: Point;
}

interface Tap {
  at: number;
  point: Point;
}

/**
 * Pinch to zoom, double tap to zoom in or back, drag to move a zoomed photo. Points are measured from the box's centre, where the photo is centred;
 * the photo's own size, before the zoom, bounds how far it moves.
 */
function usePinchZoom(
  box: { current: HTMLElement | null },
  photo: { current: HTMLElement | null },
) {
  const [scale, setScale] = useState(MIN_SCALE);
  const [offset, setOffset] = useState(NO_OFFSET);

  // The gesture under way and the last tap, read by the next touch event.
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<Tap | null>(null);

  const isZoomed = scale > MIN_SCALE;

  const photoSize = () => ({
    width: photo.current?.offsetWidth ?? 0,
    height: photo.current?.offsetHeight ?? 0,
  });

  /** A point on screen, relative to the box's centre. */
  const fromCentre = (clientX: number, clientY: number): Point => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) {
      return NO_OFFSET;
    }
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  const touchPoints = (event: TouchEvent) =>
    Array.from(event.touches, (touch) => fromCentre(touch.clientX, touch.clientY));

  const zoomTo = (nextScale: number, focus: Point, from = { scale, offset }) => {
    const clamped = clampScale(nextScale);
    setScale(clamped);
    setOffset(clampOffset(zoomAt(focus, from.offset, from.scale, clamped), clamped, photoSize()));
  };

  const reset = () => {
    setScale(MIN_SCALE);
    setOffset(NO_OFFSET);
  };

  const toggleAt = (point: Point) => {
    if (isZoomed) {
      reset();
    } else {
      zoomTo(DOUBLE_TAP_SCALE, point);
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    const points = touchPoints(event);
    if (points.length === 2) {
      gesture.current = {
        startDistance: distance(points[0], points[1]),
        startScale: scale,
        startOffset: offset,
        startFocus: midpoint(points[0], points[1]),
      };
      return;
    }

    const [point] = points;
    const now = Date.now();
    const previous = lastTap.current;
    const isDoubleTap =
      previous !== null &&
      now - previous.at < DOUBLE_TAP_MS &&
      distance(previous.point, point) < DOUBLE_TAP_DISTANCE_PX;
    if (isDoubleTap) {
      lastTap.current = null;
      toggleAt(point);
      return;
    }
    lastTap.current = { at: now, point };
    gesture.current = {
      startDistance: 0,
      startScale: scale,
      startOffset: offset,
      startFocus: point,
    };
  };

  const handleTouchMove = (event: TouchEvent) => {
    const start = gesture.current;
    const points = touchPoints(event);
    if (!start) {
      return;
    }

    if (points.length === 2 && start.startDistance > 0) {
      const pinchScale = start.startScale * (distance(points[0], points[1]) / start.startDistance);
      zoomTo(pinchScale, start.startFocus, { scale: start.startScale, offset: start.startOffset });
      return;
    }

    // One finger moves a zoomed photo; on a fitted one it swipes to the next.
    if (points.length === 1 && isZoomed) {
      const moved = {
        x: start.startOffset.x + points[0].x - start.startFocus.x,
        y: start.startOffset.y + points[0].y - start.startFocus.y,
      };
      setOffset(clampOffset(moved, scale, photoSize()));
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) {
      // One finger of a pinch lifted: the other goes on as a drag from here.
      const [point] = touchPoints(event);
      gesture.current = {
        startDistance: 0,
        startScale: scale,
        startOffset: offset,
        startFocus: point,
      };
      return;
    }

    gesture.current = null;
    if (scale < FIT_SNAP_SCALE) {
      reset();
    }
  };

  return {
    scale,
    offset,
    isZoomed,
    reset,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  };
}

/**
 * The math of zooming a photo in the full-screen gallery, pure for the tests. The photo
 * is drawn with `translate(offset) scale(scale)` around its box's centre; points are in
 * pixels relative to that centre.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampScale = (scale: number) => clamp(scale, MIN_SCALE, MAX_SCALE);

/** Keeps a zoomed photo covering its box: it cannot be dragged past its edges. */
export function clampOffset(offset: Point, scale: number, box: Size): Point {
  const maxX = ((scale - 1) * box.width) / 2;
  const maxY = ((scale - 1) * box.height) / 2;
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
}

/** The offset that keeps the point under `focus` in place while the scale changes. */
export function zoomAt(focus: Point, offset: Point, fromScale: number, toScale: number): Point {
  const ratio = toScale / fromScale;
  return { x: focus.x - (focus.x - offset.x) * ratio, y: focus.y - (focus.y - offset.y) * ratio };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
