/**
 * The client state of each file in the listing draft (diagram 00, client part): checking and
 * optimizing (media-intake.ts), then uploading (media-upload.ts), then the server's status.
 *
 * Pure: services dispatch what happened, this decides whether it applies. An event for a
 * file that was removed, or that is no longer in the state the event assumes, is ignored;
 * that is how a result arriving after the seller removed the file is dropped.
 */

import type { MediaKind, RejectReason } from '@/features/media/media-limits';
import { type ServerMedia, ServerMediaStatus } from '@/features/media/upload/upload-types';
import type { UploadWait } from '@/features/media/upload/file-upload';

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

/** What the upload manager sends. */
export interface UploadSource {
  blob: Blob;
  contentType: string;
  /** False when this is the picked file itself. */
  optimized: boolean;
}

interface BaseMedia {
  /** Also the upload's clientFileId. */
  id: string;
  kind: MediaKind;
  file: File;
}

/** What a file carries from ready-to-upload on. */
interface PreparedMedia extends BaseMedia {
  original: OriginalFile;
  upload: UploadSource;
  /**
   * Object URL of the optimized photo. Null for originals: decoding a full-size photo
   * for an <img> is what the worker exists to keep off the main thread, so the tile
   * waits for the server's thumbnail.
   */
  previewUrl: string | null;
}

export type DraftMedia =
  | (BaseMedia & { status: DraftMediaStatus.Checking })
  | (BaseMedia & { status: DraftMediaStatus.Rejected; reason: RejectReason })
  | (BaseMedia & {
      status: DraftMediaStatus.Optimizing;
      original: OriginalFile;
      /** 0–1 for a video being converted; null for a photo, which has no progress to show. */
      progress: number | null;
    })
  | (PreparedMedia & { status: DraftMediaStatus.ReadyToUpload })
  | (PreparedMedia & {
      status: DraftMediaStatus.Uploading;
      /** Share of the bytes in storage, 0–1. */
      progress: number;
    })
  | (PreparedMedia & {
      status: DraftMediaStatus.Retrying;
      progress: number;
      waitingFor: UploadWait;
    })
  | (PreparedMedia & {
      status: DraftMediaStatus.UploadFailed;
      /** False when retrying cannot help, so the seller is offered remove only (diagram 05). */
      isRetryable: boolean;
    })
  | (PreparedMedia & { status: DraftMediaStatus.Uploaded; mediaId: string; server: ServerMedia });

export type PreparedDraftMedia = Extract<DraftMedia, PreparedMedia>;
export type ReadyDraftMedia = Extract<DraftMedia, { status: DraftMediaStatus.ReadyToUpload }>;
export type UploadedDraftMedia = Extract<DraftMedia, { status: DraftMediaStatus.Uploaded }>;

export type MediaAction =
  | { type: 'added'; items: BaseMedia[] }
  | { type: 'rejected'; id: string; reason: RejectReason }
  | { type: 'optimizing'; id: string; original: OriginalFile }
  | { type: 'progressed'; id: string; progress: number }
  | {
      type: 'ready';
      id: string;
      original: OriginalFile;
      upload: UploadSource;
      previewUrl: string | null;
    }
  | { type: 'uploadStarted'; id: string }
  | { type: 'uploadWaiting'; id: string; waitingFor: UploadWait }
  /** The next attempt starts after a wait. */
  | { type: 'uploadResumed'; id: string }
  | { type: 'uploadFailed'; id: string; isRetryable: boolean }
  | { type: 'uploaded'; id: string; mediaId: string; server: ServerMedia }
  | { type: 'serverUpdated'; id: string; server: ServerMedia }
  | { type: 'removed'; id: string }
  | { type: 'cleared' };

/**
 * The server is done with the media: READY, or FAILED with its reason. `complete` can answer
 * FAILED without the reason, when an earlier answer was lost; one poll then fetches it.
 */
export const isServerSettled = (server: ServerMedia) =>
  server.status === ServerMediaStatus.Ready ||
  (server.status === ServerMediaStatus.Failed && server.error !== null);

type FileEvent = Exclude<MediaAction, { type: 'added' | 'removed' | 'cleared' }>;

const UPLOAD_IN_PROGRESS = [DraftMediaStatus.Uploading, DraftMediaStatus.Retrying];

/** Which states each event may leave; anything else is a stale event. */
const LEAVES_FROM: Record<FileEvent['type'], DraftMediaStatus[]> = {
  rejected: [DraftMediaStatus.Checking, DraftMediaStatus.Optimizing],
  optimizing: [DraftMediaStatus.Checking],
  progressed: [DraftMediaStatus.Optimizing, DraftMediaStatus.Uploading],
  ready: [DraftMediaStatus.Checking, DraftMediaStatus.Optimizing],
  uploadStarted: [DraftMediaStatus.ReadyToUpload, DraftMediaStatus.UploadFailed],
  uploadWaiting: UPLOAD_IN_PROGRESS,
  uploadResumed: [DraftMediaStatus.Retrying],
  uploadFailed: UPLOAD_IN_PROGRESS,
  uploaded: UPLOAD_IN_PROGRESS,
  serverUpdated: [DraftMediaStatus.Uploaded],
};

const isPrepared = (media: DraftMedia): media is PreparedDraftMedia => 'upload' in media;

/** Upload events, for a file past ready-to-upload (LEAVES_FROM guarantees it). */
function applyUploadEvent(media: PreparedDraftMedia, action: FileEvent): DraftMedia {
  // Field by field on purpose: spreading `media` would carry the previous state's fields
  // (progress, isRetryable, …) into the next one.
  const prepared = {
    id: media.id,
    kind: media.kind,
    file: media.file,
    original: media.original,
    upload: media.upload,
    previewUrl: media.previewUrl,
  };
  // Kept across a retry, so a video that had half its parts in storage does not start at 0.
  const progress = 'progress' in media ? media.progress : 0;

  switch (action.type) {
    case 'uploadStarted':
    case 'uploadResumed':
      return { ...prepared, status: DraftMediaStatus.Uploading, progress };
    case 'progressed':
      return { ...prepared, status: DraftMediaStatus.Uploading, progress: action.progress };
    case 'uploadWaiting':
      return {
        ...prepared,
        status: DraftMediaStatus.Retrying,
        progress,
        waitingFor: action.waitingFor,
      };
    case 'uploadFailed':
      return {
        ...prepared,
        status: DraftMediaStatus.UploadFailed,
        isRetryable: action.isRetryable,
      };
    case 'uploaded':
      return {
        ...prepared,
        status: DraftMediaStatus.Uploaded,
        mediaId: action.mediaId,
        server: action.server,
      };
    case 'serverUpdated':
      // A slow poll answering after a newer one must not take a settled tile back.
      return media.status === DraftMediaStatus.Uploaded && !isServerSettled(media.server)
        ? { ...media, server: action.server }
        : media;
    default:
      return media;
  }
}

function applyEvent(media: DraftMedia, action: FileEvent): DraftMedia {
  const base = { id: media.id, kind: media.kind, file: media.file };

  if (isPrepared(media)) {
    return applyUploadEvent(media, action);
  }

  switch (action.type) {
    case 'rejected':
      return { ...base, status: DraftMediaStatus.Rejected, reason: action.reason };
    case 'optimizing':
      return {
        ...base,
        status: DraftMediaStatus.Optimizing,
        original: action.original,
        progress: null,
      };
    case 'progressed':
      return media.status === DraftMediaStatus.Optimizing
        ? { ...media, progress: action.progress }
        : media;
    case 'ready':
      return {
        ...base,
        status: DraftMediaStatus.ReadyToUpload,
        original: action.original,
        upload: action.upload,
        previewUrl: action.previewUrl,
      };
    default:
      return media;
  }
}

export function mediaReducer(state: DraftMedia[], action: MediaAction): DraftMedia[] {
  switch (action.type) {
    case 'added':
      return [
        ...state,
        ...action.items.map((item) => ({ ...item, status: DraftMediaStatus.Checking as const })),
      ];
    case 'removed':
      return state.filter((media) => media.id !== action.id);
    case 'cleared':
      return [];
    default: {
      const index = state.findIndex((media) => media.id === action.id);
      if (index < 0 || !LEAVES_FROM[action.type].includes(state[index].status)) {
        return state;
      }
      return state.map((media, position) =>
        position === index ? applyEvent(media, action) : media,
      );
    }
  }
}
