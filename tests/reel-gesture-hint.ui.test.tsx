import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HINT = { name: 'Hướng dẫn lướt video' };

/** A fresh app session: the hint module, and its session flag, load again. */
async function openReels() {
  vi.resetModules();
  const { default: ReelGestureHint } =
    await import('@/features/reels/components/reel-gesture-hint');
  return render(<ReelGestureHint />);
}

/** A remount within the same app session, as when the viewer leaves Reels and comes back. */
async function reopenReels() {
  cleanup();
  const { default: ReelGestureHint } =
    await import('@/features/reels/components/reel-gesture-hint');
  return render(<ReelGestureHint />);
}

function finishLeaving() {
  act(() => {
    vi.runAllTimers();
  });
}

function swipe(target: HTMLElement, dx: number, dy: number) {
  fireEvent.touchStart(target, { touches: [{ clientX: 200, clientY: 400 }] });
  fireEvent.touchMove(target, { touches: [{ clientX: 200 + dx, clientY: 400 + dy }] });
  fireEvent.touchEnd(target, { touches: [] });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('reel gesture hint', () => {
  it('shows the three gestures on the first visit', async () => {
    await openReels();

    const dialog = screen.getByRole('dialog', HINT);
    expect(dialog.textContent).toContain('Vuốt lên xuống');
    expect(dialog.textContent).toContain('Vuốt sang trái');
    expect(dialog.textContent).toContain('Vuốt sang phải');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng hướng dẫn' }));
  });

  it('closes on a tap and stays closed on the next app session', async () => {
    await openReels();

    fireEvent.click(screen.getByRole('dialog', HINT));
    finishLeaving();
    expect(screen.queryByRole('dialog')).toBeNull();

    cleanup();
    await openReels();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on a swipe in any direction', async () => {
    for (const [dx, dy] of [
      [0, -60],
      [0, 60],
      [-80, 0],
      [80, 0],
    ]) {
      localStorage.clear();
      await openReels();

      swipe(screen.getByRole('dialog', HINT), dx, dy);
      finishLeaving();
      expect(screen.queryByRole('dialog')).toBeNull();

      cleanup();
      await openReels();
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();
    }
  });

  it('does not take a small move for a swipe', async () => {
    await openReels();

    swipe(screen.getByRole('dialog', HINT), 3, 2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('dialog', HINT)).not.toBeNull();
  });

  it('shows once per app session when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    await openReels();
    fireEvent.click(screen.getByRole('dialog', HINT));
    finishLeaving();
    expect(screen.queryByRole('dialog')).toBeNull();

    await reopenReels();
    expect(screen.queryByRole('dialog')).toBeNull();

    cleanup();
    await openReels();
    expect(screen.queryByRole('dialog', HINT)).not.toBeNull();
  });
});
