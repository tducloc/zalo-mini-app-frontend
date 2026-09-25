/**
 * The client state of each file in the listing draft (diagram 00, client part). Two flows
 * move a file forward, each with its own actions:
 *
 * - intake (media-intake.ts): Checking → Rejected, or Optimizing → ReadyToUpload;
 * - upload (media-upload.ts): ReadyToUpload → Uploading ⇄ Retrying → UploadFailed or
 *   Uploaded, then the server's status until it is READY or FAILED.
 *
 * Pure: services dispatch what happened, this decides whether it applies. An action for a
 * file that was removed, or that is no longer in a state the action starts from, is
 * ignored; that is how a result arriving after the seller removed the file is dropped.
 */

import { MediaKind, type RejectReason } from '@/features/media/media-utils';
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

type PreparedDraftMedia = Extract<DraftMedia, PreparedMedia>;
export type ReadyDraftMedia = Extract<DraftMedia, { status: DraftMediaStatus.ReadyToUpload }>;
export type UploadedDraftMedia = Extract<DraftMedia, { status: DraftMediaStatus.Uploaded }>;

export enum MediaActionType {
  // The list
  Added = 'ADDED',
  Removed = 'REMOVED',
  Cleared = 'CLEARED',
  /** The seller made this photo the cover: it moves to the front. */
  CoverChosen = 'COVER_CHOSEN',
  /** Another file takes this one's place, cover included. */
  Replaced = 'REPLACED',
  // Intake
  Rejected = 'REJECTED',
  OptimizeStarted = 'OPTIMIZE_STARTED',
  OptimizeProgressed = 'OPTIMIZE_PROGRESSED',
  Ready = 'READY',
  // Upload
  /** Back in the upload queue after the seller tapped Retry. */
  UploadQueued = 'UPLOAD_QUEUED',
  UploadStarted = 'UPLOAD_STARTED',
  UploadProgressed = 'UPLOAD_PROGRESSED',
  UploadWaiting = 'UPLOAD_WAITING',
  /** The next attempt starts after a wait. */
  UploadResumed = 'UPLOAD_RESUMED',
  UploadFailed = 'UPLOAD_FAILED',
  Uploaded = 'UPLOADED',
  ServerUpdated = 'SERVER_UPDATED',
}

type ListAction =
  | { type: MediaActionType.Added; items: BaseMedia[] }
  | { type: MediaActionType.Removed; id: string }
  | { type: MediaActionType.Cleared }
  | { type: MediaActionType.CoverChosen; id: string }
  | { type: MediaActionType.Replaced; id: string; item: BaseMedia };

type IntakeAction =
  | { type: MediaActionType.Rejected; id: string; reason: RejectReason }
  | { type: MediaActionType.OptimizeStarted; id: string; original: OriginalFile }
  | { type: MediaActionType.OptimizeProgressed; id: string; progress: number }
  | {
      type: MediaActionType.Ready;
      id: string;
      original: OriginalFile;
      upload: UploadSource;
      previewUrl: string | null;
    };

type UploadAction =
  | { type: MediaActionType.UploadQueued; id: string }
  | { type: MediaActionType.UploadStarted; id: string }
  | { type: MediaActionType.UploadProgressed; id: string; progress: number }
  | { type: MediaActionType.UploadWaiting; id: string; waitingFor: UploadWait }
  | { type: MediaActionType.UploadResumed; id: string }
  | { type: MediaActionType.UploadFailed; id: string; isRetryable: boolean }
  | { type: MediaActionType.Uploaded; id: string; mediaId: string; server: ServerMedia }
  | { type: MediaActionType.ServerUpdated; id: string; server: ServerMedia };

export type MediaAction = ListAction | IntakeAction | UploadAction;

/**
 * The server is done with the media: READY, or FAILED with its reason. `complete` can answer
 * FAILED without the reason, when an earlier answer was lost; one poll then fetches it.
 */
export const isServerSettled = (server: ServerMedia) =>
  server.status === ServerMediaStatus.Ready ||
  (server.status === ServerMediaStatus.Failed && server.error !== null);

// ---- Intake ----

/** The states each intake action starts from. */
const INTAKE_FROM: Record<IntakeAction['type'], DraftMediaStatus[]> = {
  [MediaActionType.Rejected]: [DraftMediaStatus.Checking, DraftMediaStatus.Optimizing],
  [MediaActionType.OptimizeStarted]: [DraftMediaStatus.Checking],
  [MediaActionType.OptimizeProgressed]: [DraftMediaStatus.Optimizing],
  [MediaActionType.Ready]: [DraftMediaStatus.Checking, DraftMediaStatus.Optimizing],
};

const isIntakeAction = (action: IntakeAction | UploadAction): action is IntakeAction =>
  action.type in INTAKE_FROM;

// Field by field on purpose: spreading `media` would carry the previous state's fields
// (progress, reason, …) into the next one.
const fileOf = ({ id, kind, file }: DraftMedia): BaseMedia => ({ id, kind, file });

function applyIntake(media: DraftMedia, action: IntakeAction): DraftMedia {
  switch (action.type) {
    case MediaActionType.Rejected:
      return { ...fileOf(media), status: DraftMediaStatus.Rejected, reason: action.reason };
    case MediaActionType.OptimizeStarted:
      return {
        ...fileOf(media),
        status: DraftMediaStatus.Optimizing,
        original: action.original,
        progress: null,
      };
    case MediaActionType.OptimizeProgressed:
      return media.status === DraftMediaStatus.Optimizing
        ? { ...media, progress: action.progress }
        : media;
    case MediaActionType.Ready:
      return {
        ...fileOf(media),
        status: DraftMediaStatus.ReadyToUpload,
        original: action.original,
        upload: action.upload,
        previewUrl: action.previewUrl,
      };
  }
}

// ---- Upload ----

const UPLOAD_IN_PROGRESS = [DraftMediaStatus.Uploading, DraftMediaStatus.Retrying];

/** The states each upload action starts from; all of them are past ReadyToUpload. */
const UPLOAD_FROM: Record<UploadAction['type'], DraftMediaStatus[]> = {
  [MediaActionType.UploadQueued]: [DraftMediaStatus.UploadFailed],
  [MediaActionType.UploadStarted]: [DraftMediaStatus.ReadyToUpload],
  [MediaActionType.UploadProgressed]: [DraftMediaStatus.Uploading],
  [MediaActionType.UploadWaiting]: UPLOAD_IN_PROGRESS,
  [MediaActionType.UploadResumed]: [DraftMediaStatus.Retrying],
  [MediaActionType.UploadFailed]: UPLOAD_IN_PROGRESS,
  [MediaActionType.Uploaded]: UPLOAD_IN_PROGRESS,
  [MediaActionType.ServerUpdated]: [DraftMediaStatus.Uploaded],
};

const isPrepared = (media: DraftMedia): media is PreparedDraftMedia => 'upload' in media;

const preparedOf = (media: PreparedDraftMedia): PreparedMedia => ({
  ...fileOf(media),
  original: media.original,
  upload: media.upload,
  previewUrl: media.previewUrl,
});

function applyUpload(media: PreparedDraftMedia, action: UploadAction): DraftMedia {
  const prepared = preparedOf(media);
  // Kept across a retry, so a video that had half its parts in storage does not start at 0.
  const progress = 'progress' in media ? media.progress : 0;

  switch (action.type) {
    case MediaActionType.UploadQueued:
      return { ...prepared, status: DraftMediaStatus.ReadyToUpload };
    case MediaActionType.UploadStarted:
    case MediaActionType.UploadResumed:
      return { ...prepared, status: DraftMediaStatus.Uploading, progress };
    case MediaActionType.UploadProgressed:
      return { ...prepared, status: DraftMediaStatus.Uploading, progress: action.progress };
    case MediaActionType.UploadWaiting:
      return {
        ...prepared,
        status: DraftMediaStatus.Retrying,
        progress,
        waitingFor: action.waitingFor,
      };
    case MediaActionType.UploadFailed:
      return {
        ...prepared,
        status: DraftMediaStatus.UploadFailed,
        isRetryable: action.isRetryable,
      };
    case MediaActionType.Uploaded:
      return {
        ...prepared,
        status: DraftMediaStatus.Uploaded,
        mediaId: action.mediaId,
        server: action.server,
      };
    case MediaActionType.ServerUpdated:
      // A slow poll answering after a newer one must not take a settled tile back.
      return media.status === DraftMediaStatus.Uploaded && !isServerSettled(media.server)
        ? { ...media, server: action.server }
        : media;
  }
}

// ---- The reducer ----

function applyToFile(media: DraftMedia, action: IntakeAction | UploadAction): DraftMedia {
  if (isIntakeAction(action)) {
    return INTAKE_FROM[action.type].includes(media.status) ? applyIntake(media, action) : media;
  }
  return UPLOAD_FROM[action.type].includes(media.status) && isPrepared(media)
    ? applyUpload(media, action)
    : media;
}

/** Only a photo the app kept can be the cover (api-spec: the first media is an image). */
function chooseCover(state: DraftMedia[], id: string) {
  const cover = state.find((media) => media.id === id);
  if (!cover || cover.kind !== MediaKind.Image || cover.status === DraftMediaStatus.Rejected) {
    return state;
  }
  return [cover, ...state.filter((media) => media !== cover)];
}

export function mediaReducer(state: DraftMedia[], action: MediaAction): DraftMedia[] {
  switch (action.type) {
    case MediaActionType.Added:
      return [
        ...state,
        ...action.items.map((item) => ({ ...item, status: DraftMediaStatus.Checking as const })),
      ];
    case MediaActionType.Removed:
      return state.filter((media) => media.id !== action.id);
    case MediaActionType.Cleared:
      return [];
    case MediaActionType.CoverChosen:
      return chooseCover(state, action.id);
    case MediaActionType.Replaced:
      return state.map((media) =>
        media.id === action.id ? { ...action.item, status: DraftMediaStatus.Checking } : media,
      );
    default: {
      const index = state.findIndex((media) => media.id === action.id);
      const next = index < 0 ? undefined : applyToFile(state[index], action);
      // Same array when nothing applied, so the store does not notify for a stale action.
      if (!next || next === state[index]) {
        return state;
      }
      return state.map((media, position) => (position === index ? next : media));
    }
  }
}
