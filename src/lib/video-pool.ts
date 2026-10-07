/**
 * Two <video> elements, kept for the whole session: one for Reels and one shared by the
 * feed previews, a listing's gallery and the listing form.
 *
 * iOS lets a video load and play (with sound too, once allowed) only if the element already
 * existed when the viewer last touched the page. A new element per reel was refused from the
 * second page of reels on, even muted, and so was one per feed card. Reels keeps its own, so
 * returning from a listing finds the reel still loaded and nothing else gets the element it
 * plays with sound. The others never show a video at the same time: a page that is not the
 * current one gives the shared element back. Each claimer sets the element's muted and loop.
 */

export type VideoFeature = 'reels' | 'shared';

const VIDEO_FEATURES: readonly VideoFeature[] = ['reels', 'shared'];

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
    reels: createVideo(),
    shared: createVideo(),
  };

  /** The claim holding each feature's element, so a late release cannot take the next one's. */
  private readonly owners = new Map<VideoFeature, symbol>();

  private parking: HTMLElement | null = null;

  /**
   * Inside Zalo, iOS refuses play() outside a tap, even muted, until a tap has played that
   * element: a feed preview or a listing's video starts later, after the tap. So every tap
   * plays and pauses the parked elements while it is still being handled.
   */
  private readonly unlockParked = () => {
    for (const feature of VIDEO_FEATURES) {
      if (this.owners.has(feature)) {
        continue;
      }
      const video = this.videos[feature];
      video.play()?.catch(() => undefined);
      video.pause();
    }
  };

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
    // pointerup, not pointerdown: a scroll starts with pointerdown and is no tap.
    if (parking) {
      window.addEventListener('pointerup', this.unlockParked, true);
    } else {
      window.removeEventListener('pointerup', this.unlockParked, true);
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
