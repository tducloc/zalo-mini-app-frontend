/**
 * What a picked file really is, from its first bytes. `file.type` cannot be trusted: it is
 * empty for some files on Android, depends on the file name, and Safari has been seen
 * labelling PNG bytes as the type a canvas was asked for.
 */

export enum FileFormat {
  Jpeg = 'image/jpeg',
  Png = 'image/png',
  Webp = 'image/webp',
  Heic = 'image/heic',
  Avif = 'image/avif',
  Gif = 'image/gif',
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

// ISO-BMFF major brands of HEIF stills (iPhone photos, Samsung "high efficiency" photos).
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);
const AVIF_BRANDS = new Set(['avif', 'avis']);

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.subarray(start, start + length)));
}

function isoBmffFormat(brand: string) {
  if (brand === 'qt  ') {
    return FileFormat.QuickTime;
  }
  if (HEIF_BRANDS.has(brand)) {
    return FileFormat.Heic;
  }
  if (AVIF_BRANDS.has(brand)) {
    return FileFormat.Avif;
  }
  // isom, mp41, mp42, avc1, 3gp…: let the video reader decide whether it can use it.
  return FileFormat.Mp4;
}

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
  if (ascii(head, 0, 3) === 'GIF') {
    return FileFormat.Gif;
  }
  if (ascii(head, 4, 4) === 'ftyp') {
    return isoBmffFormat(ascii(head, 8, 4));
  }
  return FileFormat.Unknown;
}

export async function readHead(blob: Blob, bytes: number) {
  return new Uint8Array(await blob.slice(0, bytes).arrayBuffer());
}

export async function sniffBlobFormat(blob: Blob) {
  return sniffFormat(await readHead(blob, FORMAT_HEAD_BYTES));
}
