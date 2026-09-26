/** What photos and videos share: their kinds, and why a file is refused. */

import type { PhotoHeader } from '@/features/media/types/image';

export enum MediaKind {
  Image = 'IMAGE',
  Video = 'VIDEO',
}

export enum RejectReason {
  // Photos
  UnsupportedImageFormat = 'UNSUPPORTED_IMAGE_FORMAT',
  /** Over MAX_IMAGE_BYTES: refused before the worker decodes it. */
  ImageTooLarge = 'IMAGE_TOO_LARGE',
  /** Over MAX_IMAGE_PIXELS, e.g. a phone's 108 MP mode. */
  ImageTooManyPixels = 'IMAGE_TOO_MANY_PIXELS',
  TooManyImages = 'TOO_MANY_IMAGES',
  // Videos
  /** Not an MP4 or MOV mediabunny can open. */
  UnsupportedVideoFormat = 'UNSUPPORTED_VIDEO_FORMAT',
  TooManyVideos = 'TOO_MANY_VIDEOS',
  VideoTooLong = 'VIDEO_TOO_LONG',
  VideoTooLarge = 'VIDEO_TOO_LARGE',
  VideoResolution = 'VIDEO_RESOLUTION',
  /** Not H.264 with AAC (e.g. HEVC), and this phone could not convert it. */
  VideoNotPlayable = 'VIDEO_NOT_PLAYABLE',
  // Any file
  /** The phone would not let the app read the file, e.g. an iCloud photo not downloaded. */
  Unreadable = 'UNREADABLE',
}

/** A picked file as far as its first bytes tell. */
export interface PickedMedia {
  kind: MediaKind;
  /** What the first bytes already rule out (format, photo size), or null. */
  problem: RejectReason | null;
}

/** A picked file refused at once, which never joins the draft. */
export interface RefusedFile {
  name: string;
  reason: RejectReason;
}

export interface DetectedFile extends PickedMedia {
  /** Photos only: format and size, for the checks and the upload request. */
  photo: PhotoHeader | null;
}
