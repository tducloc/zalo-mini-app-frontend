/** Questions about one draft file (types/draft-media.ts has its states). */

import {
  DraftMediaStatus,
  type DraftMedia,
  type ListingMedia,
} from '@/features/listings/types/draft-media';
import { MediaKind } from '@/features/media/types/media';
import { ServerMediaStatus } from '@/features/media/types/upload';

/** A file just picked, being checked. */
export const newDraftMedia = (id: string, kind: MediaKind, file: File): DraftMedia => ({
  id,
  kind,
  file,
  status: DraftMediaStatus.Checking,
  reason: null,
  original: null,
  upload: null,
  previewUrl: null,
  progress: null,
  waitingFor: null,
  isRetryable: false,
  mediaId: null,
  server: null,
  mediumUrl: null,
});

/**
 * A failure the seller has to deal with (retry or remove): refused after it
 * joined the draft, not uploaded, or failed by the server. Waiting for the network is not
 * one: the app goes on by itself.
 */
export const isFailed = (media: ListingMedia) =>
  media.status === DraftMediaStatus.Rejected ||
  media.status === DraftMediaStatus.UploadFailed ||
  media.server?.status === ServerMediaStatus.Failed;
