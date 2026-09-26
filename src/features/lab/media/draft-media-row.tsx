import { Button } from 'zmp-ui';

import {
  mediaErrorMessage,
  rejectMessage,
  uploadFailedMessages,
  uploadWaitMessages,
} from '@/features/listings/constants/messages';
import { removeDraftMedia } from '@/features/listings/services/add-media';
import { retryUpload } from '@/features/listings/services/upload-media';
import { DraftMediaStatus, type DraftMedia } from '@/features/listings/types/draft-media';
import { isFailed } from '@/features/listings/utils/draft-media';
import { MIB } from '@/features/media/constants/limits';
import { MediaKind, RejectReason } from '@/features/media/types/media';
import { ServerMediaStatus, UploadWait } from '@/features/media/types/upload';

export interface RowTimes {
  /** Seconds from picking to ready to upload. */
  preparing: string | null;
  /** Seconds from the first upload byte to the server's confirmation. */
  uploading: string | null;
}

const percent = (fraction: number | null) => `${Math.round((fraction ?? 0) * 100)}%`;

function describeServer(media: DraftMedia) {
  switch (media.server?.status) {
    case ServerMediaStatus.Ready:
      return 'Máy chủ xử lý xong';
    case ServerMediaStatus.Failed:
      return `Máy chủ từ chối: ${mediaErrorMessage(media.server.error)}`;
    default:
      return 'Đã tải lên · máy chủ đang xử lý';
  }
}

function describeStatus(media: DraftMedia) {
  switch (media.status) {
    case DraftMediaStatus.Checking:
      return 'Đang kiểm tra';
    case DraftMediaStatus.Rejected:
      return `Từ chối: ${rejectMessage(media.reason ?? RejectReason.Unreadable)}`;
    case DraftMediaStatus.Optimizing:
      return media.progress === null
        ? 'Đang tối ưu'
        : `Đang chuyển 720p ${percent(media.progress)}`;
    case DraftMediaStatus.ReadyToUpload: {
      const { upload } = media;
      if (!upload) {
        return 'Chờ tải lên';
      }
      const size = `${(upload.blob.size / MIB).toFixed(2)} MB ${upload.contentType}`;
      return `Chờ tải lên · ${size} · ${upload.optimized ? 'đã tối ưu' : 'bản gốc'}`;
    }
    case DraftMediaStatus.Uploading:
      return `Đang tải lên ${percent(media.progress)}`;
    case DraftMediaStatus.Retrying:
      return `${uploadWaitMessages[media.waitingFor ?? UploadWait.Retry]} (${percent(media.progress)})`;
    case DraftMediaStatus.UploadFailed:
      return media.isRetryable ? uploadFailedMessages.retryable : uploadFailedMessages.permanent;
    case DraftMediaStatus.Uploaded:
      return describeServer(media);
  }
}

export default function DraftMediaRow({ media, times }: { media: DraftMedia; times: RowTimes }) {
  const previewUrl = media.server?.thumbnailUrl ?? media.previewUrl;
  const { original } = media;
  const canRetry = media.status === DraftMediaStatus.UploadFailed && media.isRetryable;

  return (
    <li className="flex items-start gap-2 border-t border-slate-100 py-2 text-xs">
      <div className="h-12 w-12 flex-none overflow-hidden rounded bg-slate-100">
        {previewUrl && <img src={previewUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 break-all font-semibold">
          {media.kind === MediaKind.Video ? 'Video' : 'Ảnh'} · {media.file.name}
        </p>
        <p className="m-0 text-slate-500">
          Gốc {(media.file.size / MIB).toFixed(2)} MB
          {!!original?.width && ` · ${original.width}×${original.height}`}
          {times.preparing && ` · chuẩn bị ${times.preparing} s`}
          {times.uploading && ` · tải lên ${times.uploading} s`}
        </p>
        <p className={isFailed(media) ? 'm-0 text-red-600' : 'm-0'}>{describeStatus(media)}</p>
        {media.status === DraftMediaStatus.Uploaded && (
          <p className="m-0 break-all text-slate-400">{media.mediaId}</p>
        )}
      </div>
      <div className="flex flex-none flex-col gap-1">
        {canRetry && (
          <Button size="small" variant="secondary" onClick={() => retryUpload(media.id)}>
            Thử lại
          </Button>
        )}
        <Button size="small" variant="tertiary" onClick={() => removeDraftMedia(media.id)}>
          Xoá
        </Button>
      </div>
    </li>
  );
}
