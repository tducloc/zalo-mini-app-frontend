/**
 * The listing draft beyond each file's state: the form's fields as typed, and what the
 * form and the tab bar work out from the whole draft (plans/create-listing.md, "Draft that
 * survives navigation"). Pure, so each rule is unit-tested.
 */

import {
  type DraftMedia,
  DraftMediaStatus,
  type UploadedDraftMedia,
} from '@/features/listings/draft/media-reducer';
import { MediaKind } from '@/features/media/media-utils';
import { ServerMediaStatus } from '@/features/media/upload/upload-types';
import type { ProductCondition } from '@/features/products/types';

/** The form's values as the seller typed them; the form schema checks and converts them. */
export interface DraftFields {
  title: string;
  description: string;
  /** Digits as typed; a number only once the schema accepts it. */
  price: string;
  categoryId: string;
  condition: ProductCondition | '';
  locationId: string;
}

export const EMPTY_FIELDS: DraftFields = {
  title: '',
  description: '',
  price: '',
  categoryId: '',
  condition: '',
  locationId: '',
};

/** 32 hex digits for `Idempotency-Key`; crypto.randomUUID needs iOS 15.4, the app 15.1. */
export function newIdempotencyKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The seller has something to lose: a field filled in, or a file picked. */
export function hasDraft(fields: DraftFields, media: DraftMedia[]) {
  return media.length > 0 || Object.values(fields).some((value) => value.trim() !== '');
}

/** Why Post is disabled; the form says it next to the button. */
export enum PostBlocker {
  /** A file failed to upload or the server refused it: retry, replace or remove it. */
  NeedsAttention = 'NEEDS_ATTENTION',
  /** The cover is required (the listing card shows it). */
  NoPhoto = 'NO_PHOTO',
  /** Files are still being checked, optimized or uploaded. */
  Working = 'WORKING',
}

const needsAttention = (media: DraftMedia) =>
  media.status === DraftMediaStatus.UploadFailed ||
  (media.status === DraftMediaStatus.Uploaded && media.server.status === ServerMediaStatus.Failed);

/**
 * Null when the draft's files can be posted: every file the app kept is in storage and
 * the server has not failed it; still processing is fine, the server publishes the
 * listing when it is done. Refused files are not sent, so they block nothing. The fields
 * are the form's own check.
 */
export function postBlocker(media: DraftMedia[]): PostBlocker | null {
  const kept = media.filter((item) => item.status !== DraftMediaStatus.Rejected);
  if (kept.some(needsAttention)) {
    return PostBlocker.NeedsAttention;
  }
  if (!kept.some((item) => item.kind === MediaKind.Image)) {
    return PostBlocker.NoPhoto;
  }
  if (kept.some((item) => item.status !== DraftMediaStatus.Uploaded)) {
    return PostBlocker.Working;
  }
  return null;
}

/**
 * `mediaIds` for `POST /products`: the first photo is the cover, then the other photos in
 * the draft's order, then the video (the server wants an image first).
 */
export function mediaIdsForPost(media: DraftMedia[]) {
  const uploaded = media.filter(
    (item): item is UploadedDraftMedia => item.status === DraftMediaStatus.Uploaded,
  );
  const photos = uploaded.filter((item) => item.kind === MediaKind.Image);
  const videos = uploaded.filter((item) => item.kind === MediaKind.Video);
  return [...photos, ...videos].map((item) => item.mediaId);
}
