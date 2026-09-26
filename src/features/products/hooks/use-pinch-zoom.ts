import { type TouchEvent, useRef, useState } from 'react';

import { MIN_SCALE, NO_OFFSET } from '@/features/products/constants/zoom';
import type { Point } from '@/features/products/types/zoom';
import {
  clampOffset,
  clampScale,
  distance,
  midpoint,
  zoomAt,
} from '@/features/products/utils/zoom';

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
export function usePinchZoom(
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
