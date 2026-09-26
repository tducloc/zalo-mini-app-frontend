/**
 * Uploads: the shapes of the media endpoints (api-spec.md, "Media"), then what one file's
 * upload (services/file-upload.ts) takes and reports.
 */

import type { MediaKind } from '@/features/media/types/media';

export enum ServerMediaStatus {
  Uploading = 'UPLOADING',
  Processing = 'PROCESSING',
  Ready = 'READY',
  Failed = 'FAILED',
}

/** One file in `POST /media/upload-urls`; the original* fields are provenance only. */
export interface UploadRequestFile {
  clientFileId: string;
  type: MediaKind;
  contentType: string;
  size: number;
  originalBytes: number;
  originalWidth?: number;
  originalHeight?: number;
  optimized: boolean;
}

export interface PresignedPart {
  partNumber: number;
  presignedUrl: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/** Where to upload one file: one URL for a photo, one per part for a video. */
export interface UploadTarget {
  mediaId: string;
  expiresAt: string;
  presignedUrl?: string;
  partSize?: number;
  parts?: PresignedPart[];
}

export interface RegisteredUpload extends UploadTarget {
  clientFileId: string;
}

/** Why the server failed a media (api-spec, `GET /media`), plus one code of the client's. */
export enum MediaError {
  UnsupportedFormat = 'UNSUPPORTED_FORMAT',
  FileTooLarge = 'FILE_TOO_LARGE',
  VideoTooLong = 'VIDEO_TOO_LONG',
  VideoNotPlayable = 'VIDEO_NOT_PLAYABLE',
  BlankImage = 'BLANK_IMAGE',
  ProcessingFailed = 'PROCESSING_FAILED',
  /** Client-side: the server no longer lists the media, e.g. the hourly cleanup removed it. */
  Missing = 'MEDIA_MISSING',
}

/** A media as the app keeps it; see MediaStatusItem for what the server sends. */
export interface ServerMedia {
  status: ServerMediaStatus;
  thumbnailUrl: string | null;
  placeholder: string | null;
  /** Set only when FAILED. */
  error: MediaError | null;
}

/** One item of `GET /media`. */
export interface MediaStatusItem extends Omit<ServerMedia, 'error'> {
  id: string;
  /** A string: a newer server may send a code this app does not know. */
  error: string | null;
}

// ---- One file's upload ----

export interface PutOptions {
  /** Sent as Content-Type; photos must send the declared type, which the URL signs. */
  contentType?: string;
  onProgress?: (sentBytes: number) => void;
  signal?: AbortSignal;
}

export interface UploadTransport {
  /** Not abortable: once the server has created the media, the caller must learn its ID. */
  register: (file: UploadRequestFile) => Promise<UploadTarget>;
  refresh: (
    mediaId: string,
    partNumbers: number[] | undefined,
    signal: AbortSignal,
  ) => Promise<UploadTarget>;
  put: (url: string, body: Blob, options: PutOptions) => Promise<string | null>;
  completeParts: (
    mediaId: string,
    parts: CompletedPart[],
    signal: AbortSignal,
  ) => Promise<ServerMediaStatus>;
  complete: (mediaId: string, signal: AbortSignal) => Promise<ServerMediaStatus>;
  isOnline: () => boolean;
  /** Resolves when the device is back online. */
  waitForNetwork: (signal: AbortSignal) => Promise<void>;
  now: () => number;
}

export enum UploadWait {
  Network = 'NETWORK',
  Retry = 'RETRY',
}

export interface UploadListener {
  /** The server created the media; also after a removal, so it can be deleted. */
  onRegistered: (mediaId: string) => void;
  /** Share of the file's bytes in storage, 0–1. */
  onProgress: (fraction: number) => void;
  onWaiting: (wait: UploadWait) => void;
  /** The next attempt starts after a wait. */
  onResumed: () => void;
}

export type UploadResult =
  | { kind: 'uploaded'; mediaId: string; status: ServerMediaStatus }
  | { kind: 'failed'; failure: FailureKind; isRetryable: boolean };

export enum FailureKind {
  /** No answer: offline, timed out, stalled, or the WebView was paused. */
  Network = 'NETWORK',
  /** The server or storage answered with a temporary error (5xx, 429). */
  Server = 'SERVER',
  /** Storage refused the URL: it expired (S3 answers 403). A fresh URL fixes it. */
  Expired = 'EXPIRED',
  /** The media is gone on the server (404), e.g. the hourly cleanup removed it. */
  Gone = 'GONE',
  /** The server does not allow this step now (409); what it means depends on the step. */
  Conflict = 'CONFLICT',
  /** Refused for good: a wrong size or type, or a CORS setup that hides the ETag. */
  Rejected = 'REJECTED',
}
