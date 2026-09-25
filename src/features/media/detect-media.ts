/**
 * What a picked file is, from its first bytes (plans/create-listing.md, "Supported
 * formats"): a photo when image-size reads it, a video when it starts with an MP4/MOV
 * `ftyp` box (mediabunny then checks the rest), anything else is refused. `file.type` only
 * picks the tile's kind for a refused file: Android leaves it empty for some files.
 */

import {
  IMAGE_HEAD_BYTES,
  MAX_IMAGE_BYTES,
  type PhotoHeader,
  photoProblem,
  readPhotoHeader,
} from '@/features/media/image/image-utils';
import { MediaKind, type PickedMedia, readHead, RejectReason } from '@/features/media/media-utils';

export interface DetectedFile extends PickedMedia {
  /** Photos only: format and size, for the checks and the upload request. */
  photo: PhotoHeader | null;
}

/** An ISO media file (MP4, MOV) opens with a box whose type, at byte 4, is `ftyp`. */
const hasFtypBox = (head: Uint8Array) => String.fromCharCode(...head.subarray(4, 8)) === 'ftyp';

const refused = (file: File, problem: RejectReason): DetectedFile => ({
  kind: file.type.startsWith('video/') ? MediaKind.Video : MediaKind.Image,
  photo: null,
  problem,
});

const asPhoto = (file: File, photo: PhotoHeader): DetectedFile => ({
  kind: MediaKind.Image,
  photo,
  problem: photoProblem(photo, file.size),
});

export async function detectPickedFile(file: File): Promise<DetectedFile> {
  let head: Uint8Array;
  try {
    head = await readHead(file, IMAGE_HEAD_BYTES);
  } catch {
    // iOS can hand over a file it no longer lets us read, e.g. an iCloud photo not downloaded.
    return refused(file, RejectReason.Unreadable);
  }

  const photo = readPhotoHeader(head);
  if (photo) {
    return asPhoto(file, photo);
  }
  if (hasFtypBox(head)) {
    return { kind: MediaKind.Video, photo: null, problem: null };
  }
  if (file.size <= head.length) {
    return refused(file, RejectReason.UnsupportedFormat);
  }

  // A JPEG whose metadata (a Pixel depth map, Photoshop XMP) puts its size past the head.
  // Rare, so only then is more read; a photo the app takes fits in MAX_IMAGE_BYTES.
  try {
    const longer = readPhotoHeader(await readHead(file, MAX_IMAGE_BYTES));
    return longer ? asPhoto(file, longer) : refused(file, RejectReason.UnsupportedFormat);
  } catch {
    return refused(file, RejectReason.Unreadable);
  }
}
