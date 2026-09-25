/**
 * What a picked file is, read from its first bytes, before anything decodes it.
 *
 * - The format: `file.type` cannot be trusted. It is empty for some files on Android,
 *   depends on the file name, and Safari has been seen labelling PNG bytes as the type a
 *   canvas was asked for.
 * - A photo's pixel size, so one under 500 px is refused at once instead of after the
 *   worker, and the server gets the original size. Read by image-size from the header;
 *   JPEG keeps it after the EXIF/ICC segments, hence the larger head. The size is as
 *   stored, before EXIF orientation.
 */

import { imageSize } from 'image-size';

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.subarray(start, start + length)));
}

export async function readHead(blob: Blob, bytes: number) {
  return new Uint8Array(await blob.slice(0, bytes).arrayBuffer());
}

// ---- Format ----

/**
 * Only the formats the app takes; anything else is Unknown and refused, whatever it is.
 * Why these (plans/create-listing.md, "Supported formats"):
 * - JPEG, PNG, WebP: every WebView the app supports decodes them, so the phone can shrink
 *   them in the worker, and the server's sharp reads them. HEIC is left out: Android
 *   cannot decode it and sharp's prebuilt libvips has no HEVC decoder.
 * - MP4 and MOV: what phone cameras record (Android MP4, iPhone MOV). The codec inside is
 *   checked afterwards from the file itself (video-metadata.ts).
 */
export enum FileFormat {
  Jpeg = 'image/jpeg',
  Png = 'image/png',
  Webp = 'image/webp',
  Mp4 = 'video/mp4',
  QuickTime = 'video/quicktime',
  Unknown = 'unknown',
}

/** Enough for every signature below. */
export const FORMAT_HEAD_BYTES = 16;

export const IMAGE_FORMATS: readonly FileFormat[] = [
  FileFormat.Jpeg,
  FileFormat.Png,
  FileFormat.Webp,
];
export const VIDEO_FORMATS: readonly FileFormat[] = [FileFormat.Mp4, FileFormat.QuickTime];

/**
 * Major brands of the MP4 and MOV files phones and editors write. Listed rather than "any
 * ftyp", because HEIC and AVIF photos use the same box with their own brands.
 */
const VIDEO_BRANDS: Record<string, FileFormat> = {
  'qt  ': FileFormat.QuickTime,
  isom: FileFormat.Mp4,
  iso2: FileFormat.Mp4,
  iso4: FileFormat.Mp4,
  iso5: FileFormat.Mp4,
  iso6: FileFormat.Mp4,
  mp41: FileFormat.Mp4,
  mp42: FileFormat.Mp4,
  avc1: FileFormat.Mp4,
  'M4V ': FileFormat.Mp4,
};

export function sniffFormat(head: Uint8Array): FileFormat {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return FileFormat.Jpeg;
  }
  if (head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') {
    return FileFormat.Png;
  }
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    return FileFormat.Webp;
  }
  if (ascii(head, 4, 4) === 'ftyp') {
    return VIDEO_BRANDS[ascii(head, 8, 4)] ?? FileFormat.Unknown;
  }
  return FileFormat.Unknown;
}

export async function sniffBlobFormat(blob: Blob) {
  return sniffFormat(await readHead(blob, FORMAT_HEAD_BYTES));
}

// ---- Photo size ----

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Enough for a JPEG's size to follow a full 64 KB EXIF segment plus ICC and MPF. */
export const IMAGE_HEAD_BYTES = 256 * 1024;

/** Null when the header does not say, e.g. cut short or damaged; the server then decides. */
export function readImageDimensions(head: Uint8Array): ImageDimensions | null {
  if (!IMAGE_FORMATS.includes(sniffFormat(head))) {
    return null;
  }
  try {
    const { width, height } = imageSize(head);
    return { width, height };
  } catch {
    // image-size throws on a header it cannot follow.
    return null;
  }
}
