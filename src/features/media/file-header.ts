/**
 * What a picked file is, read from its first bytes, before anything decodes it.
 *
 * - The format: `file.type` cannot be trusted. It is empty for some files on Android,
 *   depends on the file name, and Safari has been seen labelling PNG bytes as the type a
 *   canvas was asked for.
 * - A photo's pixel size: decoding is what costs memory (width × height × 4 bytes), so the
 *   image queue needs the size BEFORE it lets a photo start. PNG and WebP store it in the
 *   first bytes; JPEG in the SOF segment after any EXIF/ICC segments, hence the larger
 *   head. The size is as stored, before EXIF orientation: rotation swaps width and height
 *   but not the memory they cost.
 */

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.subarray(start, start + length)));
}

export async function readHead(blob: Blob, bytes: number) {
  return new Uint8Array(await blob.slice(0, bytes).arrayBuffer());
}

// ---- Format ----

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

export async function sniffBlobFormat(blob: Blob) {
  return sniffFormat(await readHead(blob, FORMAT_HEAD_BYTES));
}

// ---- Photo size ----

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Enough for SOF to follow a full 64 KB EXIF segment plus ICC and MPF segments. */
export const IMAGE_HEAD_BYTES = 256 * 1024;

// SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
const JPEG_NON_SOF_MARKERS = new Set([0xc4, 0xc8, 0xcc]);

function readJpeg(bytes: Uint8Array): ImageDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }

    const marker = bytes[offset + 1];
    // Fill bytes and standalone markers (RSTn, TEM) have no length field.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }

    const segmentLength = view.getUint16(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && !JPEG_NON_SOF_MARKERS.has(marker)) {
      // Segment body: precision (1 byte), height (2), width (2).
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    offset += 2 + segmentLength;
  }

  return null;
}

function readPng(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== 'IHDR') {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readWebp(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  const data = 20;

  if (chunk === 'VP8X') {
    // Flags (4 bytes), then canvas width − 1 and height − 1 as 24-bit little endian.
    return { width: readUint24LE(bytes, data + 4) + 1, height: readUint24LE(bytes, data + 7) + 1 };
  }
  if (chunk === 'VP8L') {
    // Signature 0x2f, then 14 bits of width − 1 and 14 bits of height − 1.
    const bits =
      bytes[data + 1] | (bytes[data + 2] << 8) | (bytes[data + 3] << 16) | (bytes[data + 4] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') {
    // Frame tag (3 bytes), start code 9D 01 2A, then 14-bit width and height.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
      width: view.getUint16(data + 6, true) & 0x3fff,
      height: view.getUint16(data + 8, true) & 0x3fff,
    };
  }
  return null;
}

export function readImageDimensions(head: Uint8Array): ImageDimensions | null {
  switch (sniffFormat(head)) {
    case FileFormat.Jpeg:
      return readJpeg(head);
    case FileFormat.Png:
      return readPng(head);
    case FileFormat.Webp:
      return readWebp(head);
    default:
      return null;
  }
}
