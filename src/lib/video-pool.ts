/**
 * One <video> element per feature that plays video, kept for the whole session.
 *
 * iOS lets a video load and play (with sound too, once allowed) only if the element already
 * existed when the viewer last touched the page. A new element per reel was refused from the
 * second page of reels on, even muted, and so was one per feed card. So each feature borrows
 * its own element: reels and feed cards take turns in theirs, and features never take each
 * other's, so a feed preview never gets the element Reels plays with sound.
 */

export type VideoFeature = 'feed' | 'detail' | 'reels' | 'form';

const VIDEO_FEATURES: readonly VideoFeature[] = ['feed', 'detail', 'reels', 'form'];

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
  private readonly videos: Record<VideoFeature, HTMLVideoElement> = {
    feed: createVideo(),
    detail: createVideo(),
    reels: createVideo(),
    form: createVideo(),
  };

  /** The claim holding each feature's element, so a late release cannot take the next one's. */
  private readonly owners = new Map<VideoFeature, symbol>();

  private parking: HTMLElement | null = null;

  /**
   * Where the unused elements wait: inside the page, so that a touch anywhere on it counts
   * for them too. Null when the page goes.
   */
  setParking(parking: HTMLElement | null) {
    this.parking = parking;
    for (const feature of VIDEO_FEATURES) {
      if (!this.owners.has(feature)) {
        parking?.append(this.videos[feature]);
      }
    }
  }

  /** Moves the feature's element into `host`; `release` gives it back unless a newer claim took it. */
  claim(feature: VideoFeature, host: HTMLElement) {
    const video = this.videos[feature];
    const owner = Symbol(feature);
    this.owners.set(feature, owner);
    if (video.parentElement !== host) {
      host.append(video);
    }
    return { video, release: () => this.release(feature, owner) };
  }

  private release(feature: VideoFeature, owner: symbol) {
    if (this.owners.get(feature) !== owner) {
      return;
    }
    this.owners.delete(feature);
    const video = this.videos[feature];
    // StrictMode immediately claims it again; wait one microtask before dropping its source.
    queueMicrotask(() => {
      if (this.owners.has(feature)) {
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
