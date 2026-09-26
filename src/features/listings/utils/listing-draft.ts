/**
 * The listing draft as a whole: its idempotency key, and what Post needs from its files
 * (plans/create-listing.md, "Draft that survives navigation").
 */

import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { type DraftFields, PostBlocker } from '@/features/listings/types/listing-draft';
import { isFailed } from '@/features/listings/utils/draft-media';
import { MediaKind } from '@/features/media/types/media';

/** 32 hex digits for `Idempotency-Key`; crypto.randomUUID needs iOS 15.4, the app 15.1. */
export function newIdempotencyKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Null when the files can be posted: all in storage and none failed; still processing is
 * fine, the server publishes the listing when it is done. The fields are the form's check.
 */
export function postBlocker(media: DraftMedia[]): PostBlocker | null {
  if (media.some(isFailed)) {
    return PostBlocker.NeedsAttention;
  }

  if (!media.some((item) => item.kind === MediaKind.Image)) {
    return PostBlocker.NoPhoto;
  }

  if (media.some((item) => item.status !== DraftMediaStatus.Uploaded)) {
    return PostBlocker.Working;
  }

  return null;
}

/**
 * `mediaIds` for `POST /products`: the photos in the draft's order (the first is the
 * cover), then the video; the server wants an image first.
 */
export function mediaIdsForPost(media: DraftMedia[]) {
  const photos = media.filter((item) => item.kind === MediaKind.Image);
  const videos = media.filter((item) => item.kind === MediaKind.Video);
  return [...photos, ...videos].flatMap((item) => (item.mediaId ? [item.mediaId] : []));
}

/** A draft to come back to: a field filled or a file picked. */
export function hasDraft(fields: DraftFields, media: DraftMedia[]) {
  return media.length > 0 || Object.values(fields).some((value) => value.trim() !== '');
}
