/** Questions about one draft file (types/draft-media.ts has its states). */

import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { MediaKind } from '@/features/media/types/media';
import { type ServerMedia, ServerMediaStatus } from '@/features/media/types/upload';

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
});

/**
 * The server is done with the media: READY, or FAILED with its reason. `complete` can
 * answer FAILED without the reason, when an earlier answer was lost; one poll fetches it.
 */
export const isServerSettled = (server: ServerMedia | null) =>
  server?.status === ServerMediaStatus.Ready ||
  (server?.status === ServerMediaStatus.Failed && server.error !== null);

/**
 * A failure the seller has to deal with (retry or remove): refused after it
 * joined the draft, not uploaded, or failed by the server. Waiting for the network is not
 * one: the app goes on by itself.
 */
export const isFailed = (media: DraftMedia) =>
  media.status === DraftMediaStatus.Rejected ||
  media.status === DraftMediaStatus.UploadFailed ||
  media.server?.status === ServerMediaStatus.Failed;
