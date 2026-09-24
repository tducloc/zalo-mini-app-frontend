import { describe, expect, it } from 'vitest';

import { inspectMp4 } from '@/features/media/video-probe';

// MP4 files are nested boxes: [4-byte size][4-byte type][body]. The tests build just the
// boxes inspectMp4 reads, so no binary fixture has to live in the repo.

function box(type: string, ...children: Uint8Array[]) {
  const size = 8 + children.reduce((sum, child) => sum + child.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(new TextEncoder().encode(type), 4);
  let offset = 8;
  for (const child of children) {
    out.set(child, offset);
    offset += child.length;
  }
  return out;
}

function bytes(length: number, write: (view: DataView) => void = () => {}) {
  const out = new Uint8Array(length);
  write(new DataView(out.buffer));
  return out;
}

const ascii = (text: string) => new TextEncoder().encode(text);

function mvhd(timescale: number, duration: number, version = 0) {
  // Version 1 widens the creation/modification times and the duration to 64 bits.
  return version === 1
    ? box(
        'mvhd',
        bytes(112, (view) => {
          view.setUint8(0, 1);
          view.setUint32(20, timescale);
          view.setUint32(28, duration);
        }),
      )
    : box(
        'mvhd',
        bytes(100, (view) => {
          view.setUint32(12, timescale);
          view.setUint32(16, duration);
        }),
      );
}

/** Rotation matrix a, b, c, d in 16.16 fixed point, then width and height. */
function tkhd(width: number, height: number, [a, b, c, d] = [1, 0, 0, 1]) {
  return box(
    'tkhd',
    bytes(84, (view) => {
      view.setInt32(40, a * 65536);
      view.setInt32(44, b * 65536);
      view.setInt32(52, c * 65536);
      view.setInt32(56, d * 65536);
      view.setInt32(72, 0x40000000); // the matrix's w term
      view.setUint32(76, width * 65536);
      view.setUint32(80, height * 65536);
    }),
  );
}

function track(handler: 'vide' | 'soun', codec: string, width = 0, height = 0, matrix?: number[]) {
  const hdlr = box('hdlr', bytes(4), bytes(4), ascii(handler), bytes(13));
  const sampleEntry = box(codec, bytes(8));
  const stsd = box(
    'stsd',
    bytes(8, (view) => view.setUint32(4, 1)),
    sampleEntry,
  );
  return box(
    'trak',
    tkhd(width, height, matrix),
    box('mdia', hdlr, box('minf', box('stbl', stsd))),
  );
}

function file(brand: string, moov: Uint8Array, moovFirst: boolean) {
  const ftyp = box('ftyp', ascii(brand), bytes(4));
  const mdat = box('mdat', bytes(64));
  const parts = moovFirst ? [ftyp, moov, mdat] : [ftyp, mdat, moov];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function inspect(mp4: Uint8Array) {
  return inspectMp4(async (start, end) => mp4.slice(start, end).buffer, mp4.length);
}

describe('inspectMp4', () => {
  it('reads a phone portrait clip: rotated 1920×1080 H.264 + AAC, index after the data', async () => {
    const moov = box(
      'moov',
      mvhd(600, 25_200), // 42 s
      track('soun', 'mp4a'),
      track('vide', 'avc1', 1920, 1080, [0, 1, -1, 0]),
    );

    await expect(inspect(file('isom', moov, false))).resolves.toMatchObject({
      brand: 'isom',
      topLevelBoxes: ['ftyp', 'mdat', 'moov'],
      faststart: false,
      videoCodecs: ['avc1'],
      audioCodecs: ['mp4a'],
      durationMs: 42_000,
      width: 1080,
      height: 1920,
      rotation: 90,
    });
  });

  it('reads a MOV with a 64-bit mvhd, no audio and no rotation', async () => {
    const moov = box('moov', mvhd(1000, 1200, 1), track('vide', 'hvc1', 176, 144));

    await expect(inspect(file('qt  ', moov, true))).resolves.toMatchObject({
      brand: 'qt  ',
      faststart: true,
      videoCodecs: ['hvc1'],
      audioCodecs: [],
      durationMs: 1200,
      width: 176,
      height: 144,
      rotation: 0,
    });
  });

  it('leaves length and size unknown when moov does not say', async () => {
    const moov = box('moov', mvhd(0, 0));

    await expect(inspect(file('isom', moov, true))).resolves.toMatchObject({
      durationMs: null,
      width: null,
      height: null,
      videoCodecs: [],
    });
  });
});
