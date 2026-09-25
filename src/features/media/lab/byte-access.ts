/**
 * Media-lab helpers for reading raw bytes of a picked video, to measure random access
 * (the part multipart upload depends on). Not used by the create form.
 */

/** Returns the bytes in [start, end). May return fewer at the end of the file. */
export type ByteReader = (start: number, end: number) => Promise<ArrayBuffer>;

/**
 * Reads ranges over HTTP without ever materialising the whole file.
 * Falls back to a full fetch only when the server ignores Range, and reports that so the
 * caller can stop rather than quietly loading hundreds of megabytes.
 */
export async function rangeReaderFor(
  url: string,
): Promise<{ read: ByteReader; size: number; rangeSupported: boolean; contentType: string }> {
  const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
  // An error page's length is not the file's.
  const headOk = head?.ok ? head : null;

  const probe = await fetch(url, { headers: { Range: 'bytes=0-15' } });
  const rangeSupported = probe.status === 206;
  if (!rangeSupported) {
    // A 200 answer is the whole file on its way: stop it before it is all in memory.
    await probe.body?.cancel();
  }
  const size =
    Number(headOk?.headers.get('content-length') ?? 0) ||
    Number(probe.headers.get('content-range')?.split('/')[1] ?? 0);

  const read: ByteReader = async (start, end) => {
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } });
    if (response.status !== 206) {
      await response.body?.cancel();
      throw new Error(`range read answered ${response.status}, not 206`);
    }
    return response.arrayBuffer();
  };

  const contentType =
    headOk?.headers.get('content-type') ?? probe.headers.get('content-type') ?? '';

  return { read, size, rangeSupported, contentType };
}

/** openMediaPicker answers with paths, or with one string that may be a JSON array of them. */
export function pickedPaths(data: string[] | string | undefined): string[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (!data) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(String) : [data];
  } catch {
    return [data];
  }
}

/** Turns a codec name from readVideoMetadata into something a human can act on. */
export function describeCodec(codec: string | null): string {
  switch (codec) {
    case null:
      return 'không thấy';
    case 'avc':
      return 'H.264 - phát được mọi nơi';
    case 'hevc':
      return 'HEVC - Android phát không đều';
    case 'mp4v':
      return 'MPEG-4 Part 2 - có máy không phát được';
    default:
      return codec;
  }
}
