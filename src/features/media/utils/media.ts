/**
 * What photos and videos share: reading a file's first bytes, and which picked files the
 * listing can take. Photo rules are in image.ts, video rules in video.ts; the numbers in
 * constants/limits.ts.
 */

import { MAX_IMAGES_PER_LISTING, MAX_VIDEOS_PER_LISTING } from '@/features/media/constants/limits';
import { MediaKind, RejectReason, type PickedMedia } from '@/features/media/types/media';

export async function readHead(blob: Blob, bytes: number) {
  return new Uint8Array(await blob.slice(0, bytes).arrayBuffer());
}

export const unsupportedFormat = (kind: MediaKind) =>
  kind === MediaKind.Video
    ? RejectReason.UnsupportedVideoFormat
    : RejectReason.UnsupportedImageFormat;

/**
 * For each picked file, in order, the reason it cannot go on the listing, or null. A file
 * refused for its own sake never takes a slot. `taken` counts the draft's files of each
 * kind: every tile holds its slot until it is removed, a failed one too.
 */
export function refusePicked(picked: PickedMedia[], taken: Record<MediaKind, number>) {
  const counts = { ...taken };
  return picked.map(({ kind, problem }) => {
    if (problem) {
      return problem;
    }

    const isImage = kind === MediaKind.Image;
    if (counts[kind] >= (isImage ? MAX_IMAGES_PER_LISTING : MAX_VIDEOS_PER_LISTING)) {
      return isImage ? RejectReason.TooManyImages : RejectReason.TooManyVideos;
    }
    counts[kind] += 1;
    return null;
  });
}

/**
 * The files the seller just picked. The input is emptied, so picking the same file again
 * fires change again.
 */
export function takePickedFiles(input: HTMLInputElement) {
  const files = Array.from(input.files ?? []);
  input.value = '';
  return files;
}
