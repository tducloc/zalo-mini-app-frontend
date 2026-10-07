import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Box } from '@/features/feed/utils/autoplay';

type UseFeedAutoplay = typeof import('@/features/feed/hooks/use-feed-autoplay').useFeedAutoplay;
let useFeedAutoplay: UseFeedAutoplay;

beforeAll(async () => {
  vi.stubEnv('VITE_FEED_AUTOPLAY', 'true');
  ({ useFeedAutoplay } = await import('@/features/feed/hooks/use-feed-autoplay'));
});

const withRect = <T extends HTMLElement>(element: T, rect: () => Box) => {
  element.getBoundingClientRect = () => ({ ...rect(), x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
  return element;
};

describe('useFeedAutoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    window.matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands over to the row neighbour at once and rests only on a new row', () => {
    let scrollTop = 0;
    const scroller = withRect(document.createElement('div'), () => ({
      top: 0,
      bottom: 800,
      left: 0,
      right: 390,
    }));
    const cardAt = (rowTop: number, left: number) =>
      withRect(document.createElement('button'), () => ({
        top: rowTop - scrollTop,
        bottom: rowTop - scrollTop + 250,
        left,
        right: left + 180,
      }));
    const cards = {
      'row1-left': cardAt(150, 13),
      'row1-right': cardAt(150, 197),
      'row2-left': cardAt(418, 13),
      'row2-right': cardAt(418, 197),
    };
    const scrollerRef = { current: scroller };
    const headerRef = { current: null };
    const { result } = renderHook(() =>
      useFeedAutoplay({ previewIds: Object.keys(cards), isPaused: false, scrollerRef, headerRef }),
    );
    for (const [id, element] of Object.entries(cards)) {
      result.current.cardRef(id)(element);
    }
    const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    wait(20);
    expect(result.current.activeId).toBeNull();
    wait(300);
    expect(result.current.activeId).toBe('row1-left');

    act(() => result.current.onFinished('row1-left'));
    wait(20);
    expect(result.current.activeId).toBe('row1-right');

    scrollTop = 60;
    act(() => {
      scroller.dispatchEvent(new Event('scroll'));
    });
    wait(20);
    expect(result.current.activeId).toBeNull();
    wait(300);
    expect(result.current.activeId).toBe('row2-left');
  });

  it('stops after a refused preview and tries again after the next tap', () => {
    const scroller = withRect(document.createElement('div'), () => ({
      top: 0,
      bottom: 800,
      left: 0,
      right: 390,
    }));
    const card = withRect(document.createElement('button'), () => ({
      top: 150,
      bottom: 400,
      left: 13,
      right: 193,
    }));
    const { result } = renderHook(() =>
      useFeedAutoplay({
        previewIds: ['card'],
        isPaused: false,
        scrollerRef: { current: scroller },
        headerRef: { current: null },
      }),
    );
    result.current.cardRef('card')(card);
    const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
    wait(320);
    expect(result.current.activeId).toBe('card');

    act(() => result.current.onRefused());
    wait(320);
    expect(result.current.activeId).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    wait(320);
    expect(result.current.activeId).toBe('card');
  });
});
