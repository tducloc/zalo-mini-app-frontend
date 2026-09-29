import { type TouchEvent, useRef } from 'react';

import { type SwipeDirection, swipeDirection } from '@/utils/swipe';

export function useSwipe(onSwipe: (direction: SwipeDirection) => void) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0];
      startRef.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) {
        return;
      }
      const direction = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
      if (direction) {
        onSwipe(direction);
      }
    },
    onTouchCancel: () => {
      startRef.current = null;
    },
  };
}
