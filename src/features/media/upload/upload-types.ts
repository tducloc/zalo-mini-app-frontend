/** Shapes of the media upload endpoints (api-spec.md, "Media"). */

import type { MediaKind } from '@/features/media/media-limits';

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
  ImageTooSmall = 'IMAGE_TOO_SMALL',
  BlankImage = 'BLANK_IMAGE',
  ProcessingFailed = 'PROCESSING_FAILED',
  /** Client-side: the server no longer lists the media, e.g. the hourly cleanup removed it. */
  Missing = 'MEDIA_MISSING',
}

export interface ServerMedia {
  status: ServerMediaStatus;
  thumbnailUrl: string | null;
  placeholder: string | null;
  /** Set only when FAILED. A string: a newer server may send a code this app does not know. */
  error: MediaError | string | null;
}

export interface MediaStatusItem extends ServerMedia {
  id: string;
}
