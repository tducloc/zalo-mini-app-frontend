/**
 * The few <video> elements every reel plays in, kept for the whole session.
 *
 * iOS lets a video load and play (with sound too, once allowed) only if the element already
 * existed when the viewer last touched the page. A new element per reel was refused from the
 * second page of reels on, even muted, so reels borrow these instead: reel `index` always
 * gets element `index % POOL_SIZE`.
 */

const POOL_SLOTS = ['previous', 'onScreen', 'next'] as const;
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

  private armedFirstUrl: string | null = null;

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

  armFirstSound(src: string) {
    this.armedFirstUrl = src;
  }

  /** Start in the visible reel host, still inside the tab tap. */
  startFirstWithSound(host: HTMLElement) {
    const src = this.armedFirstUrl;
    if (!src) {
      return;
    }
    const video = this.claim(0, host);
    video.className = 'absolute inset-0 size-full object-cover';
    video.muted = false;
    video.defaultMuted = false;
    if (video.getAttribute('src') !== src) {
      video.src = src;
    }
    return video.play();
  }

  cancelFirstSound() {
    this.armedFirstUrl = null;
  }

  isFirstSoundStart(index: number, src: string) {
    return index === 0 && this.armedFirstUrl === src;
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
      if (index === 0) this.armedFirstUrl = null;
      video.removeAttribute('src');
      video.load();
      this.parking?.append(video);
    });
  }
}

export const videoPool = new VideoPool();
