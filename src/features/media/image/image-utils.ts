/**
 * What the app reads from a picked photo before it goes to the worker: its format and pixel
 * size, from the first bytes by image-size, never by decoding it. Any pixel size is taken
 * (decided 2026-09-25: a seller cannot tell a photo's pixels on the phone); the size goes
 * to the server with the upload. The bytes that are uploaded are checked.
 */

import { imageSize } from 'image-size';

import { MIB, RejectReason } from '@/features/media/media-utils';

/**
 * The server's limit on an uploaded photo. A shrunk photo is 60–300 KB, so only an original
 * the phone could not shrink (no worker, or the JPEG was not smaller) comes near it.
 */
export const MAX_IMAGE_BYTES = 10 * MIB;

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
const FORMAT_BY_TYPE: Partial<Record<string, ImageFormat>> = {
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
    return { format: FORMAT_BY_TYPE[type ?? ''] ?? null, width, height };
  } catch {
    // image-size throws on bytes it cannot follow.
    return null;
  }
}

/** Refuses a photo the server would refuse for its bytes, before it is uploaded. */
export const uploadedPhotoProblem = (bytes: number) =>
  bytes > MAX_IMAGE_BYTES ? RejectReason.ImageTooLarge : null;
