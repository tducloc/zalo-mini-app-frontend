/**
 * What the app reads from a picked photo before it goes to the worker: its format and pixel
 * size, from the first bytes by image-size, never by decoding it. The size also goes to
 * the server with the upload.
 */

import { imageSize } from 'image-size';

import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from '@/features/media/constants/limits';
import { ImageFormat, type PhotoHeader } from '@/features/media/types/image';
import { RejectReason } from '@/features/media/types/media';

/** image-size's names for them; any other image it recognises is refused. */
const FORMAT_BY_TYPE: Partial<Record<string, ImageFormat>> = {
  jpg: ImageFormat.Jpeg,
  png: ImageFormat.Png,
  webp: ImageFormat.Webp,
};

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

/** Why a picked photo is refused at once, or null: its format, or too big to work on. */
export function photoProblem(photo: PhotoHeader, bytes: number) {
  if (!photo.format) {
    return RejectReason.UnsupportedImageFormat;
  }

  if (bytes > MAX_IMAGE_BYTES) {
    return RejectReason.ImageTooLarge;
  }

  return photo.width * photo.height > MAX_IMAGE_PIXELS ? RejectReason.ImageTooManyPixels : null;
}
