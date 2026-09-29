import type { ReelSlot } from '@/features/reels/utils/reel-slot';

/**
 * The few <video> elements every reel plays in, kept for the whole session.
 *
 * iOS lets a video load and play (with sound too, once allowed) only if the element already
 * existed when the viewer last touched the page. A new element per reel was refused from the
 * second page of reels on, even muted, so reels borrow these instead: reel `index` always
 * gets element `index % POOL_SIZE`.
 */

const POOL_SLOTS = ['previous', 'active', 'next'] as const satisfies readonly Exclude<
  ReelSlot,
  'idle'
>[];
export const POOL_SIZE = POOL_SLOTS.length;

function createVideo() {
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  // The attribute, which every iOS version reads; without it iOS plays full screen.
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  return video;
}

export class VideoPool {
  private readonly videos: HTMLVideoElement[];

  private readonly owners = new Map<HTMLVideoElement, number>();

  private parking: HTMLElement | null = null;

  constructor(size = POOL_SIZE) {
    this.videos = Array.from({ length: size }, createVideo);
  }

  /**
   * Where the unused elements wait: inside the page, so that a touch anywhere on it counts
   * for them too. Null when the page goes.
   */
  setParking(parking: HTMLElement | null) {
    this.parking = parking;
    for (const video of this.videos) {
      if (!this.owners.has(video)) {
        parking?.append(video);
      }
    }
  }

  claim(index: number, host: HTMLElement) {
    const video = this.videos[index % this.videos.length];
    this.owners.set(video, index);
    if (video.parentElement !== host) {
      host.append(video);
    }
    return video;
  }

  release(index: number, video: HTMLVideoElement) {
    if (this.owners.get(video) !== index) {
      return;
    }
    this.owners.delete(video);
    // StrictMode immediately claims it again; wait one microtask before dropping its source.
    queueMicrotask(() => {
      if (this.owners.has(video)) {
        return;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
      this.parking?.append(video);
    });
  }
}

export const videoPool = new VideoPool();
