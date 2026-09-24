/**
 * Minimal MP4 / MOV box reader.
 *
 * blob.type only says "video/mp4", which is the container. HEVC and H.264 both live in
 * MP4, so the container tells us nothing about whether Android can play the file. The
 * codec is a four character code inside moov > trak > mdia > minf > stbl > stsd, so we
 * walk the box tree and read it.
 *
 * Reads through a ByteReader rather than a Blob, so a caller can back it with ranged
 * fetches and never hold the whole video in memory. Pulling a 100 MB video into a Blob
 * is enough on its own to make the WebView run out of memory and reload.
 */

/** Returns the bytes in [start, end). May return fewer at the end of the file. */
export type ByteReader = (start: number, end: number) => Promise<ArrayBuffer>;

export type Mp4Info = {
  brand: string;
  topLevelBoxes: string[];
  /** True when moov comes before mdat, so a player can start before the file finishes. */
  faststart: boolean;
  videoCodecs: string[];
  audioCodecs: string[];
  moovBytes: number;
};

const VIDEO_4CC = new Set(['avc1', 'avc3', 'hvc1', 'hev1', 'vp08', 'vp09', 'av01', 'mp4v']);
const AUDIO_4CC = new Set(['mp4a', 'ac-3', 'ec-3', 'Opus', 'alac', 'sowt', 'twos']);
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);

/** Never load a moov larger than this - something is wrong if it is. */
const MAX_MOOV_BYTES = 24 * 1024 * 1024;

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function readBoxSize(view: DataView, offset: number) {
  let size = view.getUint32(offset);
  let header = 8;
  if (size === 1) {
    // 64-bit size, read as two 32-bit words so the project's lib target does not need
    // BigInt. The high word is 0 for anything under 4 GB.
    size = view.getUint32(offset + 8) * 2 ** 32 + view.getUint32(offset + 12);
    header = 16;
  }
  return { size, header };
}

function walk(
  buffer: ArrayBuffer,
  start: number,
  end: number,
  visit: (type: string, bodyStart: number, bodyEnd: number) => void,
) {
  const view = new DataView(buffer);
  let offset = start;
  while (offset + 8 <= end) {
    const { size, header } = readBoxSize(view, offset);
    const boxSize = size === 0 ? end - offset : size;
    const type = fourCC(view, offset + 4);
    if (boxSize < header || offset + boxSize > end) break;
    visit(type, offset + header, offset + boxSize);
    offset += boxSize;
  }
}

function collectCodecs(buffer: ArrayBuffer, start: number, end: number, out: string[]) {
  walk(buffer, start, end, (type, bodyStart, bodyEnd) => {
    if (CONTAINERS.has(type)) {
      collectCodecs(buffer, bodyStart, bodyEnd, out);
      return;
    }
    if (type !== 'stsd') return;
    // 4 bytes version+flags, 4 bytes entry_count, then sized entries.
    const view = new DataView(buffer);
    let offset = bodyStart + 8;
    while (offset + 8 <= bodyEnd) {
      const entrySize = view.getUint32(offset);
      if (entrySize < 8) break;
      out.push(fourCC(view, offset + 4));
      offset += entrySize;
    }
  });
}

export async function inspectMp4(read: ByteReader, totalSize: number): Promise<Mp4Info> {
  const info: Mp4Info = {
    brand: '',
    topLevelBoxes: [],
    faststart: false,
    videoCodecs: [],
    audioCodecs: [],
    moovBytes: 0,
  };

  let offset = 0;
  let moovRange: [number, number] | null = null;

  // Scan top-level boxes by header only. Each step reads 16 bytes, not the box body.
  while (offset + 16 <= totalSize && info.topLevelBoxes.length < 64) {
    const header = new DataView(await read(offset, offset + 16));
    if (header.byteLength < 16) break;
    const { size, header: headerBytes } = readBoxSize(header, 0);
    const boxSize = size === 0 ? totalSize - offset : size;
    const type = fourCC(header, 4);
    if (boxSize < headerBytes) break;

    info.topLevelBoxes.push(type);
    if (type === 'ftyp') info.brand = fourCC(header, 8);
    if (type === 'moov') moovRange = [offset, offset + boxSize];

    offset += boxSize;
  }

  const moovIndex = info.topLevelBoxes.indexOf('moov');
  const mdatIndex = info.topLevelBoxes.indexOf('mdat');
  info.faststart = moovIndex >= 0 && (mdatIndex < 0 || moovIndex < mdatIndex);

  if (moovRange) {
    const [moovStart, moovEnd] = moovRange;
    info.moovBytes = moovEnd - moovStart;
    if (info.moovBytes <= MAX_MOOV_BYTES) {
      const buffer = await read(moovStart, moovEnd);
      const codecs: string[] = [];
      // The slice starts at the moov header, so its body begins 8 bytes in.
      collectCodecs(buffer, 8, buffer.byteLength, codecs);
      for (const codec of codecs) {
        if (VIDEO_4CC.has(codec)) info.videoCodecs.push(codec);
        else if (AUDIO_4CC.has(codec)) info.audioCodecs.push(codec);
      }
    }
  }

  return info;
}

/**
 * Reads ranges over HTTP without ever materialising the whole file.
 * Falls back to a full fetch only when the server ignores Range, and reports that so the
 * caller can stop rather than quietly loading hundreds of megabytes.
 */
export async function rangeReaderFor(
  url: string,
): Promise<{ read: ByteReader; size: number; rangeSupported: boolean }> {
  const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
  const declared = Number(head?.headers.get('content-length') ?? 0);

  const probe = await fetch(url, { headers: { Range: 'bytes=0-15' } });
  const rangeSupported = probe.status === 206;
  const size =
    declared ||
    Number(probe.headers.get('content-range')?.split('/')[1] ?? 0) ||
    Number(probe.headers.get('content-length') ?? 0);

  const read: ByteReader = async (start, end) => {
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } });
    return response.arrayBuffer();
  };

  return { read, size, rangeSupported };
}

/** Turns the 4CC into something a human can act on. */
export function describeCodec(fourCharCode: string): string {
  switch (fourCharCode) {
    case 'avc1':
    case 'avc3':
      return 'H.264 - plays everywhere';
    case 'hvc1':
    case 'hev1':
      return 'HEVC - Android playback is unreliable';
    case 'av01':
      return 'AV1';
    case 'vp09':
      return 'VP9';
    case 'mp4a':
      return 'AAC';
    default:
      return fourCharCode;
  }
}
