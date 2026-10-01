import {
  mediaErrorMessage,
  rejectMessage,
  tileLabels,
  uploadFailedMessages,
  uploadWaitMessages,
} from '@/features/listings/constants/messages';
import { DraftMediaStatus, type ListingMedia } from '@/features/listings/types/draft-media';
import { TileTone, type TileView } from '@/features/listings/types/tile-view';
import { RejectReason } from '@/features/media/types/media';
import { ServerMediaStatus, UploadWait } from '@/features/media/types/upload';

/** What a draft file's tile and viewer show; pure, so each state is tested. */
export function tileView(media: ListingMedia): TileView {
  const base = {
    label: null,
    progress: null,
    detail: null,
    canRetry: false,
    // The photo or video still on the phone, else the server's thumbnail once it has one.
    imageUrl: media.previewUrl ?? media.server?.thumbnailUrl ?? null,
    fullUrl: media.mediumUrl,
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
      return {
        ...base,
        tone: TileTone.Working,
        label: tileLabels.uploading,
        progress: media.progress ?? 0,
      };
    case DraftMediaStatus.ReadyToUpload:
      return {
        ...base,
        tone: TileTone.Working,
        label: tileLabels.uploading,
        progress: media.progress ?? 0,
      };
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
      return media.server?.status === ServerMediaStatus.Failed
        ? { ...base, tone: TileTone.Error, detail: mediaErrorMessage(media.server.error) }
        : { ...base, tone: TileTone.Done };
  }
}
