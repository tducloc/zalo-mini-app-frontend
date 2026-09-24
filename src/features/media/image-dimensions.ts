/**
 * Reads an image's pixel size from its header, without decoding it.
 *
 * Decoding is what costs memory (width × height × 4 bytes), so the scheduler needs the
 * size BEFORE it decides whether an image may start. The size is stored in the first few
 * hundred bytes for PNG and WebP; JPEG puts it in the SOF segment, after any EXIF/ICC
 * segments, which is why callers pass a generous head slice.
 *
 * The size is as stored, before EXIF orientation. Rotation swaps width and height but
 * not their product, so it does not change the memory cost.
 */

export type ImageDimensions = { width: number; height: number };

/** Enough for SOF to follow a full 64 KB EXIF segment plus ICC and MPF segments. */
export const IMAGE_HEAD_BYTES = 256 * 1024;

// SOF0–SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
const JPEG_NON_SOF_MARKERS = new Set([0xc4, 0xc8, 0xcc]);

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.subarray(start, start + length)));
}

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
  if (head[0] === 0xff && head[1] === 0xd8) {
    return readJpeg(head);
  }
  if (head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') {
    return readPng(head);
  }
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    return readWebp(head);
  }
  return null;
}
