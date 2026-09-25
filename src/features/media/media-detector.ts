/**
 * What a picked file is, from its first bytes (plans/create-listing.md, "Supported
 * formats"): a photo when image-size reads it, a video when it starts with an MP4/MOV
 * `ftyp` box (mediabunny then checks the rest), anything else is refused. `file.type` only
 * picks the tile's kind for a refused file: Android leaves it empty for some files.
 *
 * Not in media-utils.ts: it builds on image-utils.ts, which itself imports media-utils.ts.
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

export class MediaDetector {
  constructor(private readonly file: File) {}

  async detect(): Promise<DetectedFile> {
    let head: Uint8Array;
    try {
      head = await readHead(this.file, IMAGE_HEAD_BYTES);
    } catch {
      // iOS can hand over a file it no longer lets us read, e.g. an iCloud photo not downloaded.
      return this.refused(RejectReason.Unreadable);
    }

    const photo = readPhotoHeader(head);
    if (photo) {
      return this.asPhoto(photo);
    }
    if (hasFtypBox(head)) {
      return { kind: MediaKind.Video, photo: null, problem: null };
    }
    if (this.file.size <= head.length) {
      return this.refused(RejectReason.UnsupportedFormat);
    }
    return this.detectLongPhoto();
  }

  /**
   * A JPEG whose metadata (a Pixel depth map, Photoshop XMP) puts its size past the head.
   * Rare, so only then is more read; a photo the app takes fits in MAX_IMAGE_BYTES.
   */
  private async detectLongPhoto() {
    try {
      const photo = readPhotoHeader(await readHead(this.file, MAX_IMAGE_BYTES));
      return photo ? this.asPhoto(photo) : this.refused(RejectReason.UnsupportedFormat);
    } catch {
      return this.refused(RejectReason.Unreadable);
    }
  }

  private asPhoto(photo: PhotoHeader): DetectedFile {
    return { kind: MediaKind.Image, photo, problem: photoProblem(photo, this.file.size) };
  }

  private refused(problem: RejectReason): DetectedFile {
    const kind = this.file.type.startsWith('video/') ? MediaKind.Video : MediaKind.Image;
    return { kind, photo: null, problem };
  }
}
