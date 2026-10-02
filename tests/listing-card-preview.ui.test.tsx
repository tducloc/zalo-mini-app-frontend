import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ListingCard from '@/features/feed/components/grid/listing-card';
import { previewVideoPool } from '@/features/feed/services/preview-video';
import type { ProductCard } from '@/features/products/types/product';

vi.mock('zmp-ui', () => ({ Icon: () => null }));

const product: ProductCard = {
  id: 'prd_1',
  title: 'Xe đạp',
  price: 1_200_000,
  condition: 'USED',
  category: { id: 'cat_bike', name: 'Xe', slug: 'bike' },
  thumbnailUrl: 'https://example.com/thumb.webp',
  placeholder: null,
  previewUrl: 'https://example.com/preview.mp4',
  hasVideo: true,
  location: { id: null, name: 'Quận 1' },
  publishedAt: '2026-09-28T00:00:00.000Z',
};

let plays: (() => Promise<void>)[];
const never = () => new Promise<void>(() => {});
const rejectWith = (name: string) => () => Promise.reject(new DOMException('', name));

function renderPreview() {
  const onFinished = vi.fn();
  const onRefused = vi.fn();
  const view = render(
    <ListingCard
      isAboveFold
      isPreviewActive
      product={product}
      onOpen={() => {}}
      onPreviewFinished={onFinished}
      onPreviewRefused={onRefused}
    />,
  );
  const video = view.container.querySelector('video')!;
  const fire = (type: string) => act(() => void video.dispatchEvent(new Event(type)));
  return { view, video, fire, onFinished, onRefused };
}

describe('the card preview ends its own turn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    plays = [];
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      (plays.shift() ?? never)(),
    );
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });
  afterEach(async () => {
    cleanup();
    // The pool parks the released element one microtask later.
    await Promise.resolve();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('after its last play, once the fade back to the cover ends', () => {
    plays = [() => Promise.resolve(), () => Promise.resolve()];
    const { video, fire, onFinished } = renderPreview();

    fire('playing');
    expect(video.className).toContain('opacity-100');
    fire('ended');
    fire('ended');
    expect(video.className).toContain('opacity-0');
    expect(onFinished).not.toHaveBeenCalled();
    fire('transitionend');
    expect(onFinished).toHaveBeenCalledOnce();
    expect(onFinished).toHaveBeenCalledWith('prd_1');
  });

  it('after its last play, shortly after the fade when no transitionend comes', () => {
    plays = [() => Promise.resolve(), () => Promise.resolve()];
    const { fire, onFinished } = renderPreview();

    fire('playing');
    fire('ended');
    fire('ended');
    act(() => vi.advanceTimersByTime(200));
    expect(onFinished).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('when the clip fails to load', () => {
    const { fire, onFinished, onRefused } = renderPreview();

    fire('error');
    expect(onFinished).toHaveBeenCalledOnce();
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('when the replay is rejected', async () => {
    plays = [() => Promise.resolve(), rejectWith('NotSupportedError')];
    const { fire, onFinished } = renderPreview();

    fire('playing');
    fire('ended');
    await act(async () => {});
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('when the clip never starts playing', () => {
    const { onFinished } = renderPreview();

    act(() => vi.advanceTimersByTime(4999));
    expect(onFinished).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('but a refused play disables autoplay instead of ending a turn', async () => {
    plays = [rejectWith('NotAllowedError')];
    const { onFinished, onRefused } = renderPreview();

    await act(async () => {});
    expect(onRefused).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(10_000));
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('and reports nothing when the feed stops it mid-turn', async () => {
    plays = [rejectWith('AbortError')];
    const { view, onFinished } = renderPreview();

    view.unmount();
    await act(async () => {});
    act(() => vi.advanceTimersByTime(10_000));
    expect(onFinished).not.toHaveBeenCalled();
  });
});

describe('every card preview plays in the one pooled element', () => {
  const second: ProductCard = { ...product, id: 'prd_2', previewUrl: 'https://example.com/2.mp4' };
  let parking: HTMLElement;

  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(never);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    parking = document.createElement('div');
    document.body.append(parking);
    previewVideoPool.setParking(parking);
  });
  afterEach(async () => {
    cleanup();
    await Promise.resolve();
    previewVideoPool.setParking(null);
    parking.remove();
    vi.restoreAllMocks();
  });

  function Feed({ activeId }: { activeId: string | null }) {
    return (
      <>
        {[product, second].map((card) => (
          <ListingCard
            key={card.id}
            isAboveFold
            isPreviewActive={card.id === activeId}
            product={card}
            onOpen={() => {}}
            onPreviewFinished={() => {}}
            onPreviewRefused={() => {}}
          />
        ))}
      </>
    );
  }

  const lastPlayed = () => {
    const { contexts } = vi.mocked(HTMLMediaElement.prototype.play).mock;
    return contexts[contexts.length - 1];
  };

  it('hands it from card to card under StrictMode, then parks it without a source', async () => {
    const view = render(<Feed activeId="prd_1" />, { wrapper: StrictMode });
    const [firstCard, secondCard] = Array.from(view.container.querySelectorAll('button'));
    await act(async () => {});
    const video = firstCard.querySelector('video')!;

    expect(video.getAttribute('src')).toBe(product.previewUrl);
    expect(lastPlayed()).toBe(video);
    expect(document.querySelectorAll('video')).toHaveLength(1);

    view.rerender(<Feed activeId="prd_2" />);
    await act(async () => {});
    expect(secondCard.querySelector('video')).toBe(video);
    expect(firstCard.querySelector('video')).toBeNull();
    expect(video.getAttribute('src')).toBe(second.previewUrl);
    expect(lastPlayed()).toBe(video);
    expect(document.querySelectorAll('video')).toHaveLength(1);

    view.rerender(<Feed activeId={null} />);
    await act(async () => {});
    expect(video.parentElement).toBe(parking);
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('stays with the card playing when an earlier card lets go late', async () => {
    const card = (item: ProductCard) => (
      <ListingCard
        isAboveFold
        isPreviewActive
        product={item}
        onOpen={() => {}}
        onPreviewFinished={() => {}}
        onPreviewRefused={() => {}}
      />
    );
    const earlier = render(card(product));
    const now = render(card(second));
    const video = now.container.querySelector('video')!;

    earlier.unmount();
    await act(async () => {});
    expect(now.container.querySelector('video')).toBe(video);
    expect(video.getAttribute('src')).toBe(second.previewUrl);
  });
});
