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
  it('parks one element for Reels and one shared, muted and inline, until one is claimed', () => {
    const { parking } = setUp();

    const videos = Array.from(parking.querySelectorAll('video'));
    expect(videos).toHaveLength(2);
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

  it('never hands the shared element the one Reels plays in', () => {
    const { pool, hosts } = setUp();

    const reel = pool.claim('reels', hosts[0]).video;
    const shared = pool.claim('shared', hosts[1]).video;

    expect(shared).not.toBe(reel);
    expect(hosts[0].contains(reel)).toBe(true);
  });

  it('drops the source and parks the element on release', async () => {
    const { pool, parking, hosts } = setUp();
    const { video, release } = pool.claim('shared', hosts[1]);
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

  it('plays and pauses the parked elements on a tap, not the one in use', () => {
    const { pool, parking, hosts } = setUp();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const reel = pool.claim('reels', hosts[0]).video;
    const parked = Array.from(parking.querySelectorAll('video'));

    window.dispatchEvent(new Event('pointerup'));

    const played = play.mock.contexts as HTMLVideoElement[];
    expect(parked).toHaveLength(1);
    expect(parked.every((video) => played.includes(video))).toBe(true);
    expect(played).not.toContain(reel);
  });
});
