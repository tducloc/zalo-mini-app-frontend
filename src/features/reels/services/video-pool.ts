/**
 * The few <video> elements every reel plays in, kept for the whole session.
 *
 * iOS lets a video load and play (with sound too, once allowed) only if the element already
 * existed when the viewer last touched the page. A new element per reel was refused from the
 * second page of reels on, even muted, so reels borrow these instead: reel `index` always
 * gets element `index % POOL_SIZE`.
 */

/** The reel on screen, the one below it (loading ahead) and the one above it. */
export const POOL_SIZE = 3;

function createVideo() {
  const video = document.createElement('video');
  video.muted = true;
  // Some WebViews judge autoplay by the attribute, which the property does not write.
  video.defaultMuted = true;
  video.loop = true;
  // The attribute, which every iOS version reads; without it iOS plays full screen.
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  return video;
}

export class VideoPool {
  private readonly videos: HTMLVideoElement[];

  /** Which reel holds each element; an element missing here waits in the parking. */
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

  /** Reel `index`'s element, moved into `host`. The reel that held it before has let it go. */
  claim(index: number, host: HTMLElement) {
    const video = this.videos[index % this.videos.length];
    this.owners.set(video, index);
    if (video.parentElement !== host) {
      host.append(video);
    }
    return video;
  }

  /** Gives the element back, unless another reel has claimed it since: its source goes. */
  release(index: number, video: HTMLVideoElement) {
    if (this.owners.get(video) !== index) {
      return;
    }
    this.owners.delete(video);
    video.pause();
    // Dropping the source frees the buffer.
    video.removeAttribute('src');
    video.load();
    this.parking?.append(video);
  }
}

export const videoPool = new VideoPool();
