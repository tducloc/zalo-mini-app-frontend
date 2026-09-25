/**
 * What the app checks on a picked photo before it goes to the worker: its format and pixel
 * size, read from the first bytes by image-size, never by decoding it.
 */

import { imageSize } from 'image-size';

import { MIB, RejectReason } from '@/features/media/media-utils';

/** iPhone photos are at most ~5 MB; the app uploads a ~200 KB JPEG. */
export const MAX_IMAGE_BYTES = 10 * MIB;
/** The server refuses a photo whose shorter side is below this. */
export const MIN_IMAGE_EDGE = 500;
/** Enough for a JPEG's size to follow a full 64 KB EXIF segment plus ICC and MPF. */
export const IMAGE_HEAD_BYTES = 256 * 1024;

/**
 * The photo formats the app takes (plans/create-listing.md, "Supported formats"): every
 * WebView the app supports decodes them, so the phone can shrink them in the worker, and
 * the server's sharp reads them. HEIC is left out: Android cannot decode it and sharp's
 * prebuilt libvips has no HEVC decoder. Also the Content-Type of the upload.
 */
export enum ImageFormat {
  Jpeg = 'image/jpeg',
  Png = 'image/png',
  Webp = 'image/webp',
}

/** image-size's names for them; any other image it recognises is refused. */
const FORMAT_BY_TYPE: Record<string, ImageFormat> = {
  jpg: ImageFormat.Jpeg,
  png: ImageFormat.Png,
  webp: ImageFormat.Webp,
};

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface PhotoHeader extends ImageDimensions {
  /** Null for an image in a format the app does not take (HEIC, GIF, …). */
  format: ImageFormat | null;
}

/**
 * Format and size as stored, before EXIF orientation. Null when the bytes are not an image
 * image-size can read: a video, or a photo whose header is damaged or cut short.
 */
export function readPhotoHeader(head: Uint8Array): PhotoHeader | null {
  try {
    const { type, width, height } = imageSize(head);
    return { format: (type && FORMAT_BY_TYPE[type]) || null, width, height };
  } catch {
    // image-size throws on bytes it cannot follow.
    return null;
  }
}

/** Why the photo is refused before anything else happens to it, or null. */
export function photoProblem(photo: PhotoHeader, bytes: number) {
  if (!photo.format) {
    return RejectReason.UnsupportedFormat;
  }
  if (bytes > MAX_IMAGE_BYTES) {
    return RejectReason.ImageTooLarge;
  }
  if (Math.min(photo.width, photo.height) < MIN_IMAGE_EDGE) {
    return RejectReason.ImageTooSmall;
  }
  return null;
}
