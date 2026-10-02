import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReelItem from '@/features/reels/components/reel-item';
import type { ReelItem as Reel } from '@/features/reels/types/reel';
import { slotOf } from '@/features/reels/utils/reel-slot';

vi.mock('zmp-ui', () => ({ Icon: () => null }));

// jsdom has no media playback.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

const reels: Reel[] = Array.from({ length: 7 }, (_, index) => ({
  id: `reel-${index}`,
  title: `Reel ${index}`,
  price: 100_000,
  location: { name: 'Hà Nội' } as Reel['location'],
  publishedAt: '2026-10-01T00:00:00.000Z',
  seller: { id: 'seller', name: 'Seller', avatarUrl: null },
  video: {
    id: `video-${index}`,
    url: `https://media.example/${index}.mp4`,
    posterUrl: `https://media.example/${index}/poster.jpg`,
    placeholder: null,
    width: 720,
    height: 1280,
    durationMs: 10_000,
  },
}));

function Feed({ activeIndex }: { activeIndex: number }) {
  return (
    <>
      {reels.map((reel, index) => (
        <ReelItem
          key={reel.id}
          reel={reel}
          index={index}
          slot={slotOf(index, activeIndex)}
          isAppVisible
          onOpen={() => undefined}
        />
      ))}
    </>
  );
}

const sections = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('section[data-reel-index]'));

const indexOf = (section: HTMLElement) => Number(section.dataset.reelIndex);

const reelsWithPoster = (container: HTMLElement) =>
  sections(container)
    .filter((section) => section.querySelector('img[src*="/poster."]'))
    .map(indexOf);

describe('reel mount window', () => {
  it('keeps a section for every reel but a poster only around the one on screen', () => {
    const { container } = render(<Feed activeIndex={3} />);

    expect(sections(container).map(indexOf)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(reelsWithPoster(container)).toEqual([2, 3, 4]);
  });

  it('moves the window with the swipe and keeps the same section elements', () => {
    const { container, rerender } = render(<Feed activeIndex={3} />);
    const before = sections(container);

    rerender(<Feed activeIndex={5} />);

    expect(reelsWithPoster(container)).toEqual([4, 5, 6]);
    expect(sections(container).every((section, index) => section === before[index])).toBe(true);
  });

  it('mounts the first reel and its next one at the top of the list', () => {
    const { container } = render(<Feed activeIndex={0} />);

    expect(reelsWithPoster(container)).toEqual([0, 1]);
  });
});
