/**
 * What photos and videos share: their kinds, why a file is refused, and how many a listing
 * takes. Photo rules are in image/image-utils.ts, video rules in video/video-utils.ts. The
 * numbers mirror the server (backend/src/media/media-limits.ts), which checks everything
 * again; checking here only tells the seller early, before a long upload.
 */

export const MIB = 1024 * 1024;

export const MAX_IMAGES_PER_LISTING = 10;
export const MAX_VIDEOS_PER_LISTING = 1;

export enum MediaKind {
  Image = 'IMAGE',
  Video = 'VIDEO',
}

export enum RejectReason {
  // Photos
  UnsupportedImageFormat = 'UNSUPPORTED_IMAGE_FORMAT',
  TooManyImages = 'TOO_MANY_IMAGES',
  // Videos
  /** Not an MP4 or MOV mediabunny can open. */
  UnsupportedVideoFormat = 'UNSUPPORTED_VIDEO_FORMAT',
  TooManyVideos = 'TOO_MANY_VIDEOS',
  VideoTooLong = 'VIDEO_TOO_LONG',
  VideoTooLarge = 'VIDEO_TOO_LARGE',
  VideoResolution = 'VIDEO_RESOLUTION',
  /** HEVC this phone could not convert: iPhones record it by default. */
  VideoHevc = 'VIDEO_HEVC',
  VideoNotPlayable = 'VIDEO_NOT_PLAYABLE',
  // Any file
  /** The phone would not let the app read the file, e.g. an iCloud photo not downloaded. */
  Unreadable = 'UNREADABLE',
}

export async function readHead(blob: Blob, bytes: number) {
  return new Uint8Array(await blob.slice(0, bytes).arrayBuffer());
}

/** A picked file as far as its first bytes tell. */
export interface PickedMedia {
  kind: MediaKind;
  /** What the first bytes already rule out (format, photo size), or null. */
  problem: RejectReason | null;
}

/**
 * For each picked file, in order, the reason it cannot go on the listing, or null. A file
 * refused for its own sake never takes one of the ten photo slots. `accepted` counts the
 * draft's files of each kind that are not rejected.
 */
export function refusePicked(picked: PickedMedia[], accepted: Record<MediaKind, number>) {
  const counts = { ...accepted };
  return picked.map(({ kind, problem }) => {
    if (problem) {
      return problem;
    }

    const isImage = kind === MediaKind.Image;
    if (counts[kind] >= (isImage ? MAX_IMAGES_PER_LISTING : MAX_VIDEOS_PER_LISTING)) {
      return isImage ? RejectReason.TooManyImages : RejectReason.TooManyVideos;
    }
    counts[kind] += 1;
    return null;
  });
}
