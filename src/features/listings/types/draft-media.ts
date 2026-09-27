/**
 * A file in the listing draft and the state it is in (diagram 00, client part):
 *
 * - services/add-media.ts: Checking → Rejected, or Optimizing → ReadyToUpload;
 * - services/upload-media.ts: ReadyToUpload → Uploading ⇄ Retrying → UploadFailed or Uploaded,
 *   then the server's status until it is READY or FAILED.
 *
 * The draft store keeps the list; the services update a file by its id, so an update for
 * a file the seller removed meanwhile finds nothing and is dropped.
 *
 * An edit starts with the listing's media as files already Uploaded (`draftFromProduct` in components/edit/edit-listing-form.tsx):
 * ListingMedia, with no local `file` and the server's pictures instead.
 */

import { MediaKind, type RejectReason } from '@/features/media/types/media';
import type { ServerMedia, UploadWait } from '@/features/media/types/upload';

export enum DraftMediaStatus {
  Checking = 'CHECKING',
  Rejected = 'REJECTED',
  Optimizing = 'OPTIMIZING',
  ReadyToUpload = 'READY_TO_UPLOAD',
  Uploading = 'UPLOADING',
  Retrying = 'RETRYING',
  UploadFailed = 'UPLOAD_FAILED',
  /** In storage and confirmed; the server's status takes over. */
  Uploaded = 'UPLOADED',
}

/** The picked file as the server's provenance fields describe it (api-spec, upload-urls). */
export interface OriginalFile {
  bytes: number;
  width: number | null;
  height: number | null;
}

/** What gets uploaded: the optimized file, or the one picked. */
export interface UploadSource {
  blob: Blob;
  contentType: string;
  /** False when this is the picked file itself. */
  optimized: boolean;
}

/** A file the seller picked on this phone. */
export interface DraftMedia {
  /** Also the upload's clientFileId. */
  id: string;
  kind: MediaKind;
  file: File;
  status: DraftMediaStatus;
  /** Rejected: why. */
  reason: RejectReason | null;
  /** From Optimizing on. */
  original: OriginalFile | null;
  /** From ReadyToUpload on. */
  upload: UploadSource | null;
  /**
   * Object URL of the optimized photo, or of the picked one when it is already small. Null
   * for a full-size original: decoding one for an <img> is what the worker exists to keep
   * off the main thread.
   */
  previewUrl: string | null;
  /** 0–1: a video's conversion, then the upload; null when there is none to show. */
  progress: number | null;
  /** Retrying: what the upload waits for. */
  waitingFor: UploadWait | null;
  /** UploadFailed: false when retrying cannot help, so only remove is offered. */
  isRetryable: boolean;
  /** Uploaded: the server's id and status. */
  mediaId: string | null;
  server: ServerMedia | null;
  /** Media already on the listing: the server's medium photo, or the video itself. */
  mediumUrl: string | null;
}

/**
 * A tile of a listing being written: a picked file, or, when editing, media already on the
 * listing (no local file). What the store, the services and the form work on.
 */
export interface ListingMedia extends Omit<DraftMedia, 'file'> {
  file: File | null;
}
