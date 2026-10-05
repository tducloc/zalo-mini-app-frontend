import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoPool } from '@/lib/video-pool';

// jsdom has no media playback.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

function setUp() {
  const pool = new VideoPool();
  const parking = document.createElement('div');
  pool.setParking(parking);
  const hosts = Array.from({ length: 8 }, () => document.createElement('div'));
  return { pool, parking, hosts };
}

describe('VideoPool', () => {
  it('parks one element per feature, muted and inline, until one is claimed', () => {
    const { parking } = setUp();

    const videos = Array.from(parking.querySelectorAll('video'));
    expect(videos).toHaveLength(4);
    expect(
      videos.every((video) => video.muted && video.hasAttribute('playsinline') && video.loop),
    ).toBe(true);
  });

  it('gives every claimer in a feature the same element', () => {
    const { pool, hosts } = setUp();

    const videos = [4, 5, 6].map((index) => pool.claim('reels', hosts[index]).video);

    expect(new Set(videos).size).toBe(1);
    expect(hosts[6].contains(videos[0])).toBe(true);
  });

  it('never hands one feature the element another plays in', () => {
    const { pool, hosts } = setUp();

    const reel = pool.claim('reels', hosts[0]).video;
    const preview = pool.claim('feed', hosts[1]).video;
    const detail = pool.claim('detail', hosts[2]).video;
    const form = pool.claim('form', hosts[3]).video;

    expect(new Set([reel, preview, detail, form]).size).toBe(4);
    expect(hosts[0].contains(reel)).toBe(true);
  });

  it('drops the source and parks the element on release', async () => {
    const { pool, parking, hosts } = setUp();
    const { video, release } = pool.claim('feed', hosts[1]);
    video.src = 'https://media.example/1.mp4';

    release();
    await Promise.resolve();

    expect(video.hasAttribute('src')).toBe(false);
    expect(video.parentElement).toBe(parking);
  });

  it('keeps the source when the same element is reclaimed during route mount', async () => {
    const { pool, hosts } = setUp();
    const { video, release } = pool.claim('reels', hosts[0]);
    video.src = 'https://media.example/1.mp4';

    release();
    pool.claim('reels', hosts[1]);
    await Promise.resolve();

    expect(video.getAttribute('src')).toBe('https://media.example/1.mp4');
    expect(video.parentElement).toBe(hosts[1]);
  });

  it('leaves the element alone when a newer claim in the feature took it first', async () => {
    const { pool, hosts } = setUp();
    const first = pool.claim('reels', hosts[1]);
    pool.claim('reels', hosts[4]);
    first.video.src = 'https://media.example/4.mp4';

    first.release();
    await Promise.resolve();

    expect(first.video.getAttribute('src')).toBe('https://media.example/4.mp4');
    expect(first.video.parentElement).toBe(hosts[4]);
  });
});
