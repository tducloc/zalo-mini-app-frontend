import {
  mediaErrorMessage,
  rejectMessage,
  tileLabels,
  uploadFailedMessages,
  uploadWaitMessages,
} from '@/features/listings/constants/messages';
import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { TileTone, type TileView } from '@/features/listings/types/tile-view';
import { MediaKind, RejectReason } from '@/features/media/types/media';
import { ServerMediaStatus, UploadWait } from '@/features/media/types/upload';

/** What a draft file's tile and viewer show; pure, so each state is tested. */
export function tileView(media: DraftMedia): TileView {
  const base = {
    label: null,
    progress: null,
    detail: null,
    canRetry: false,
    // The optimized photo, else the server's thumbnail once it has one.
    imageUrl: media.previewUrl ?? media.server?.thumbnailUrl ?? null,
  };

  switch (media.status) {
    case DraftMediaStatus.Checking:
      return { ...base, tone: TileTone.Working, label: tileLabels.checking };
    case DraftMediaStatus.Rejected:
      return {
        ...base,
        tone: TileTone.Error,
        detail: rejectMessage(media.reason ?? RejectReason.Unreadable),
      };
    case DraftMediaStatus.Optimizing:
      return media.kind === MediaKind.Video
        ? {
            ...base,
            tone: TileTone.Working,
            label: tileLabels.convertingVideo,
            progress: media.progress,
          }
        : { ...base, tone: TileTone.Working, label: tileLabels.optimizingPhoto };
    case DraftMediaStatus.ReadyToUpload:
      return { ...base, tone: TileTone.Working, label: tileLabels.queued };
    case DraftMediaStatus.Uploading:
      return {
        ...base,
        tone: TileTone.Working,
        label: tileLabels.uploading,
        progress: media.progress,
      };
    case DraftMediaStatus.Retrying: {
      const waitingFor = media.waitingFor ?? UploadWait.Retry;
      return {
        ...base,
        tone: TileTone.Waiting,
        label: waitingFor === UploadWait.Network ? tileLabels.waitingNetwork : tileLabels.retrying,
        progress: media.progress,
        detail: uploadWaitMessages[waitingFor],
      };
    }
    case DraftMediaStatus.UploadFailed:
      return {
        ...base,
        tone: TileTone.Error,
        detail: media.isRetryable ? uploadFailedMessages.retryable : uploadFailedMessages.permanent,
        canRetry: media.isRetryable,
      };
    case DraftMediaStatus.Uploaded:
      if (media.server?.status === ServerMediaStatus.Failed) {
        return { ...base, tone: TileTone.Error, detail: mediaErrorMessage(media.server.error) };
      }

      if (media.server?.status === ServerMediaStatus.Ready) {
        return { ...base, tone: TileTone.Done };
      }
      return { ...base, tone: TileTone.Working, label: tileLabels.processing };
  }
}
