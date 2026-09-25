/**
 * What a picked file is, from its first bytes (plans/create-listing.md, "Supported
 * formats"): a photo when image-size reads it, a video when it starts with an `ftyp` box
 * of a video brand (mediabunny then checks the rest), anything else is refused. `file.type` only
 * picks the tile's kind for a refused file: Android leaves it empty for some files.
 *
 * Not in media-utils.ts: it builds on image-utils.ts, which itself imports media-utils.ts.
 */

import {
  IMAGE_HEAD_BYTES,
  type PhotoHeader,
  readPhotoHeader,
} from '@/features/media/image/image-utils';
import {
  MediaKind,
  MIB,
  type PickedMedia,
  readHead,
  RejectReason,
} from '@/features/media/media-utils';

/** The most read to find a photo's size: past any metadata a phone or an editor writes. */
const LONG_HEAD_BYTES = 10 * MIB;

export interface DetectedFile extends PickedMedia {
  /** Photos only: format and size, for the checks and the upload request. */
  photo: PhotoHeader | null;
}

const ascii = (head: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...head.subarray(start, end));

/**
 * The major brand of an ISO media file, which opens with an `ftyp` box: MP4 and MOV, but
 * also HEIF and AVIF photos. Null for anything else.
 */
const ftypBrand = (head: Uint8Array) => (ascii(head, 4, 8) === 'ftyp' ? ascii(head, 8, 12) : null);

/** Brands of HEIF and AVIF photos and photo bursts, which the app does not take. */
const PHOTO_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'mif1',
  'msf1',
  'avif',
  'avis',
]);

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
    const brand = ftypBrand(head);
    if (brand && PHOTO_BRANDS.has(brand)) {
      // Usually image-size reads these already; this catches one whose header it cannot.
      return { kind: MediaKind.Image, photo: null, problem: RejectReason.UnsupportedImageFormat };
    }
    if (brand) {
      return { kind: MediaKind.Video, photo: null, problem: null };
    }
    if (this.file.size <= head.length) {
      return this.unsupported();
    }
    return this.detectLongPhoto();
  }

  /**
   * A JPEG whose metadata (a Pixel depth map, Photoshop XMP) puts its size past the head.
   * Rare, so only then is more read.
   */
  private async detectLongPhoto() {
    try {
      const photo = readPhotoHeader(await readHead(this.file, LONG_HEAD_BYTES));
      return photo ? this.asPhoto(photo) : this.unsupported();
    } catch {
      return this.refused(RejectReason.Unreadable);
    }
  }

  private asPhoto(photo: PhotoHeader): DetectedFile {
    const problem = photo.format ? null : RejectReason.UnsupportedImageFormat;
    return { kind: MediaKind.Image, photo, problem };
  }

  /** The picker's type only says whether the seller meant a photo or a video. */
  private get kind() {
    return this.file.type.startsWith('video/') ? MediaKind.Video : MediaKind.Image;
  }

  private unsupported(): DetectedFile {
    const problem =
      this.kind === MediaKind.Video
        ? RejectReason.UnsupportedVideoFormat
        : RejectReason.UnsupportedImageFormat;
    return this.refused(problem);
  }

  private refused(problem: RejectReason): DetectedFile {
    return { kind: this.kind, photo: null, problem };
  }
}
