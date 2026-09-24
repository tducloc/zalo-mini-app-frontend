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
  /** From mvhd; null when the file does not say (e.g. fragmented MP4). */
  durationMs: number | null;
  /** Size as displayed, after the rotation in the video track's matrix. */
  width: number | null;
  height: number | null;
  /** Clockwise degrees the player turns the picture: 0, 90, 180 or 270. */
  rotation: number;
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

const FIXED_16_16 = 65536;

/** mvhd: duration / timescale. Version 1 widens the times and duration to 64 bits. */
function readMovieDuration(view: DataView, bodyStart: number) {
  const version = view.getUint8(bodyStart);
  const timescale = view.getUint32(bodyStart + (version === 1 ? 20 : 12));
  const duration =
    version === 1
      ? view.getUint32(bodyStart + 24) * 2 ** 32 + view.getUint32(bodyStart + 28)
      : view.getUint32(bodyStart + 16);
  return timescale > 0 && duration > 0 ? Math.round((duration / timescale) * 1000) : null;
}

/** tkhd: the display matrix and the 16.16 fixed-point width and height. */
function readTrackHeader(view: DataView, bodyStart: number) {
  const matrixStart = bodyStart + (view.getUint8(bodyStart) === 1 ? 52 : 40);
  const a = view.getInt32(matrixStart) / FIXED_16_16;
  const b = view.getInt32(matrixStart + 4) / FIXED_16_16;
  const degrees = Math.round((Math.atan2(b, a) * 180) / Math.PI);
  return {
    width: Math.round(view.getUint32(matrixStart + 36) / FIXED_16_16),
    height: Math.round(view.getUint32(matrixStart + 40) / FIXED_16_16),
    rotation: ((degrees % 360) + 360) % 360,
  };
}

type TrackHeader = ReturnType<typeof readTrackHeader>;

/** The track's header if its handler is 'vide' (hdlr: version+flags, pre_defined, handler_type). */
function readVideoTrack(buffer: ArrayBuffer, trakStart: number, trakEnd: number): TrackHeader | null {
  const view = new DataView(buffer);
  const found: { header: TrackHeader | null; isVideo: boolean } = { header: null, isVideo: false };
  walk(buffer, trakStart, trakEnd, (type, bodyStart, bodyEnd) => {
    if (type === 'tkhd') found.header = readTrackHeader(view, bodyStart);
    if (type === 'mdia') {
      walk(buffer, bodyStart, bodyEnd, (child, childStart) => {
        if (child === 'hdlr') found.isVideo = fourCC(view, childStart + 8) === 'vide';
      });
    }
  });
  return found.isVideo ? found.header : null;
}

/**
 * Length and picture size straight from the moov box. iOS WebKit will not load a
 * <video> outside a user gesture, so this is the only way to read them there, and it
 * costs nothing: the moov bytes are already in memory for the codec scan.
 */
function readShape(buffer: ArrayBuffer, info: Mp4Info) {
  const view = new DataView(buffer);
  walk(buffer, 8, buffer.byteLength, (type, bodyStart, bodyEnd) => {
    if (type === 'mvhd') info.durationMs = readMovieDuration(view, bodyStart);
    if (type !== 'trak' || info.width !== null) return;
    const track = readVideoTrack(buffer, bodyStart, bodyEnd);
    if (!track) return;
    const turned = track.rotation === 90 || track.rotation === 270;
    info.width = turned ? track.height : track.width;
    info.height = turned ? track.width : track.height;
    info.rotation = track.rotation;
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
    durationMs: null,
    width: null,
    height: null,
    rotation: 0,
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
      readShape(buffer, info);
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
): Promise<{ read: ByteReader; size: number; rangeSupported: boolean; contentType: string }> {
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

  const contentType =
    head?.headers.get('content-type') ?? probe.headers.get('content-type') ?? '';

  return { read, size, rangeSupported, contentType };
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
