import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';

import PullToRefresh from '@/features/feed/components/pull-to-refresh';

const START_Y = 100;
const FAR_PULL_PX = 200;
const SHORT_PULL_PX = 60;

function Feed({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollerRef} data-testid="scroller">
      <PullToRefresh scrollerRef={scrollerRef} onRefresh={onRefresh} />
    </div>
  );
}

function renderFeed({ scrollTop = 0 } = {}) {
  let finishRefresh: () => void = () => {};
  const onRefresh = vi.fn(() => new Promise<void>((resolve) => (finishRefresh = resolve)));

  render(<Feed onRefresh={onRefresh} />);
  const scroller = screen.getByTestId('scroller');
  Object.defineProperty(scroller, 'scrollTop', { value: scrollTop, configurable: true });

  return { scroller, onRefresh, finishRefresh: () => act(async () => finishRefresh()) };
}

function pull(scroller: HTMLElement, { dy, dx = 0 }: { dy: number; dx?: number }) {
  fireEvent.touchStart(scroller, { touches: [{ clientX: 0, clientY: START_Y }] });
  fireEvent.touchMove(scroller, { touches: [{ clientX: dx, clientY: START_Y + dy }] });
  fireEvent.touchEnd(scroller, { touches: [] });
}

describe('PullToRefresh', () => {
  it('refreshes once after a long pull at the top and shows the spinner until done', async () => {
    const { scroller, onRefresh, finishRefresh } = renderFeed();

    pull(scroller, { dy: FAR_PULL_PX });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: 'Đang làm mới tin đăng' })).toBeTruthy();

    pull(scroller, { dy: FAR_PULL_PX });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await finishRefresh();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does nothing when the feed is scrolled down', () => {
    const { scroller, onRefresh } = renderFeed({ scrollTop: 300 });

    pull(scroller, { dy: FAR_PULL_PX });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does nothing after a short pull or a sideways swipe', () => {
    const { scroller, onRefresh } = renderFeed();

    pull(scroller, { dy: SHORT_PULL_PX });
    pull(scroller, { dy: FAR_PULL_PX, dx: FAR_PULL_PX * 2 });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
