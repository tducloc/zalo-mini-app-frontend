/**
 * The client state of each file in the listing draft (diagram 00, client part), up to
 * "ready to upload". The upload states arrive with the upload manager (L5).
 *
 * Pure: services dispatch what happened, this decides whether it applies. An event for a
 * file that was removed, or that is no longer in the state the event assumes, is ignored;
 * that is how a result arriving after the seller removed the file is dropped.
 */

import type { MediaKind, RejectReason } from '@/features/media/media-limits';

export enum DraftMediaStatus {
  Checking = 'CHECKING',
  Rejected = 'REJECTED',
  Optimizing = 'OPTIMIZING',
  ReadyToUpload = 'READY_TO_UPLOAD',
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

export type DraftMedia =
  | (BaseMedia & { status: DraftMediaStatus.Checking })
  | (BaseMedia & { status: DraftMediaStatus.Rejected; reason: RejectReason })
  | (BaseMedia & {
      status: DraftMediaStatus.Optimizing;
      original: OriginalFile;
      /** 0–1 for a video being converted; null for a photo, which has no progress to show. */
      progress: number | null;
    })
  | (BaseMedia & {
      status: DraftMediaStatus.ReadyToUpload;
      original: OriginalFile;
      upload: UploadSource;
      /**
       * Object URL of the optimized photo. Null for originals: decoding a full-size photo
       * for an <img> is what the worker exists to keep off the main thread, so the tile
       * waits for the server's thumbnail.
       */
      previewUrl: string | null;
    });

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
  | { type: 'removed'; id: string }
  | { type: 'cleared' };

/** Which states each event may leave; anything else is a stale event. */
const LEAVES_FROM: Record<'rejected' | 'optimizing' | 'progressed' | 'ready', DraftMediaStatus[]> =
  {
    rejected: [DraftMediaStatus.Checking, DraftMediaStatus.Optimizing],
    optimizing: [DraftMediaStatus.Checking],
    progressed: [DraftMediaStatus.Optimizing],
    ready: [DraftMediaStatus.Checking, DraftMediaStatus.Optimizing],
  };

function applyEvent(media: DraftMedia, action: MediaAction): DraftMedia {
  const base = { id: media.id, kind: media.kind, file: media.file };

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
