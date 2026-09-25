/**
 * What a tile in the form's media grid shows for a draft file, and what its sheet offers.
 * Pure, so every state is unit-tested; the components only draw it.
 *
 * Only real failures are errors (red border, "!"): a refusal found after the file joined
 * the draft, a failed upload, a file the server refused. Waiting for the network is not:
 * the app retries on its own, and a red tile would alarm the seller for nothing.
 */

import { type DraftMedia, DraftMediaStatus } from '@/features/listings/draft/media-reducer';
import {
  mediaErrorLabel,
  mediaErrorMessage,
  rejectLabels,
  rejectMessages,
  tileLabels,
  uploadFailedLabel,
  uploadFailedMessages,
  uploadWaitMessages,
} from '@/features/listings/draft/media-messages';
import { MediaKind } from '@/features/media/media-utils';
import { UploadWait } from '@/features/media/upload/file-upload';
import { ServerMediaStatus } from '@/features/media/upload/upload-types';

export enum TileTone {
  /** Checking, optimizing, uploading or processing: a spinner or a percentage. */
  Working = 'WORKING',
  /** Paused until the network is back; the app goes on by itself. */
  Waiting = 'WAITING',
  /** Needs the seller: retry, or remove. */
  Error = 'ERROR',
  /** Ready on the server. */
  Done = 'DONE',
}

export interface TileView {
  tone: TileTone;
  /** The short line on the tile (what it is doing, or what went wrong); null when done. */
  label: string | null;
  /** 0–1 when there is a percentage to show. */
  progress: number | null;
  /** The full sentence in the sheet: why it failed, or what it waits for. */
  detail: string | null;
  canRetry: boolean;
  /** The optimized photo, or the server's thumbnail once it has one. */
  imageUrl: string | null;
}

const working = (label: string, progress: number | null = null) => ({
  tone: TileTone.Working,
  label,
  progress,
  detail: null,
  canRetry: false,
});

const failed = (label: string, detail: string, canRetry = false) => ({
  tone: TileTone.Error,
  label,
  progress: null,
  detail,
  canRetry,
});

function statusView(media: DraftMedia): Omit<TileView, 'imageUrl'> {
  switch (media.status) {
    case DraftMediaStatus.Checking:
      return working(tileLabels.checking);
    case DraftMediaStatus.Rejected:
      return failed(rejectLabels[media.reason], rejectMessages[media.reason]);
    case DraftMediaStatus.Optimizing:
      return media.kind === MediaKind.Video
        ? working(tileLabels.convertingVideo, media.progress)
        : working(tileLabels.optimizingPhoto);
    case DraftMediaStatus.ReadyToUpload:
      return working(tileLabels.queued);
    case DraftMediaStatus.Uploading:
      return working(tileLabels.uploading, media.progress);
    case DraftMediaStatus.Retrying:
      return {
        tone: TileTone.Waiting,
        label:
          media.waitingFor === UploadWait.Network ? tileLabels.waitingNetwork : tileLabels.retrying,
        progress: media.progress,
        detail: uploadWaitMessages[media.waitingFor],
        canRetry: false,
      };
    case DraftMediaStatus.UploadFailed:
      return media.isRetryable
        ? failed(uploadFailedLabel, uploadFailedMessages.retryable, true)
        : failed(uploadFailedLabel, uploadFailedMessages.permanent);
    case DraftMediaStatus.Uploaded:
      if (media.server.status === ServerMediaStatus.Failed) {
        return failed(mediaErrorLabel(media.server.error), mediaErrorMessage(media.server.error));
      }
      if (media.server.status === ServerMediaStatus.Ready) {
        return { tone: TileTone.Done, label: null, progress: null, detail: null, canRetry: false };
      }
      return working(tileLabels.processing);
  }
}

export function tileView(media: DraftMedia): TileView {
  const previewUrl = 'previewUrl' in media ? media.previewUrl : null;
  const thumbnailUrl =
    media.status === DraftMediaStatus.Uploaded ? media.server.thumbnailUrl : null;
  return { ...statusView(media), imageUrl: previewUrl ?? thumbnailUrl };
}

/** How many files the seller has to deal with, for the line under the grid. */
export const countNeedingAttention = (media: DraftMedia[]) =>
  media.filter((item) => tileView(item).tone === TileTone.Error).length;
