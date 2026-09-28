import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoPool } from '@/features/reels/services/video-pool';

// jsdom has no media playback.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

function setUp() {
  const pool = new VideoPool(3);
  const parking = document.createElement('div');
  pool.setParking(parking);
  const hosts = Array.from({ length: 8 }, () => document.createElement('div'));
  return { pool, parking, hosts };
}

describe('VideoPool', () => {
  it('parks every element, muted and inline, until a reel claims one', () => {
    const { parking } = setUp();

    const videos = Array.from(parking.querySelectorAll('video'));
    expect(videos).toHaveLength(3);
    expect(
      videos.every((video) => video.muted && video.hasAttribute('playsinline') && video.loop),
    ).toBe(true);
  });

  it('reuses the same few elements however many reels there are', () => {
    const { pool, hosts } = setUp();

    const first = pool.claim(0, hosts[0]);
    pool.release(0, first);
    const fourth = pool.claim(3, hosts[3]);

    expect(fourth).toBe(first);
    expect(hosts[3].contains(fourth)).toBe(true);
    expect(pool.claim(4, hosts[4])).not.toBe(fourth);
  });

  it('gives neighbouring reels different elements', () => {
    const { pool, hosts } = setUp();

    const videos = [4, 5, 6].map((index) => pool.claim(index, hosts[index]));

    expect(new Set(videos).size).toBe(3);
  });

  it('drops the source and parks the element on release', async () => {
    const { pool, parking, hosts } = setUp();
    const video = pool.claim(1, hosts[1]);
    video.src = 'https://media.example/1.mp4';

    pool.release(1, video);
    await Promise.resolve();

    expect(video.hasAttribute('src')).toBe(false);
    expect(video.parentElement).toBe(parking);
  });

  it('keeps the source when the same element is reclaimed during route mount', async () => {
    const { pool, hosts } = setUp();
    const video = pool.claim(0, hosts[0]);
    video.src = 'https://media.example/1.mp4';

    pool.release(0, video);
    pool.claim(0, hosts[1]);
    await Promise.resolve();

    expect(video.getAttribute('src')).toBe('https://media.example/1.mp4');
    expect(video.parentElement).toBe(hosts[1]);
  });

  it('leaves the element alone when another reel claimed it first', () => {
    const { pool, hosts } = setUp();
    const video = pool.claim(1, hosts[1]);
    pool.claim(4, hosts[4]);
    video.src = 'https://media.example/4.mp4';

    pool.release(1, video);

    expect(video.getAttribute('src')).toBe('https://media.example/4.mp4');
    expect(video.parentElement).toBe(hosts[4]);
  });
});
