/**
 * What the seller reads under a file: why it was refused before uploading, what an upload
 * is waiting for or why it failed, and why the server refused it.
 */

import {
  MAX_IMAGES_PER_LISTING,
  MAX_VIDEOS_PER_LISTING,
  MIB,
  RejectReason,
} from '@/features/media/media-utils';
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  MAX_VIDEO_SHORT_EDGE,
} from '@/features/media/video/video-utils';
import { UploadWait } from '@/features/media/upload/file-upload';
import { MediaError } from '@/features/media/upload/upload-types';

/** The same advice whether the phone or the server finds the clip unplayable. */
const NOT_PLAYABLE =
  'Video này không phát được trên mọi điện thoại. Hãy quay bằng camera của máy rồi chọn lại.';

// ---- Before uploading ----

/** What the seller reads under a refused file: why, and what to do instead. */
export const rejectMessages: Record<RejectReason, string> = {
  // Photos
  [RejectReason.UnsupportedImageFormat]: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.',
  [RejectReason.TooManyImages]: `Mỗi tin có tối đa ${MAX_IMAGES_PER_LISTING} ảnh.`,

  // Videos
  [RejectReason.UnsupportedVideoFormat]: 'Chỉ nhận video MP4 hoặc MOV.',
  [RejectReason.TooManyVideos]: `Mỗi tin có tối đa ${MAX_VIDEOS_PER_LISTING} video.`,
  [RejectReason.VideoTooLong]: `Video dài hơn ${MAX_VIDEO_DURATION_MS / 1000} giây.`,
  [RejectReason.VideoTooLarge]: `Video lớn hơn ${MAX_VIDEO_BYTES / MIB} MB.`,
  [RejectReason.VideoResolution]: `Video trên ${MAX_VIDEO_SHORT_EDGE}p. Hãy quay ở ${MAX_VIDEO_SHORT_EDGE}p rồi chọn lại.`,
  [RejectReason.VideoHevc]:
    'Video ở định dạng HEVC (hiệu quả cao) mà máy này chưa chuyển được. iPhone: Cài đặt > Camera > Định dạng > Tương thích nhất. Android: tắt HEVC trong cài đặt camera. Rồi quay lại.',
  [RejectReason.VideoNotPlayable]: NOT_PLAYABLE,

  // Any file
  [RejectReason.Unreadable]: 'Không đọc được tệp này. Hãy chọn lại.',
};

// ---- Uploading and processing ----

/** What the tile says while an upload waits (diagram 05). */
export const uploadWaitMessages: Record<UploadWait, string> = {
  [UploadWait.Network]: 'Đang chờ có mạng để tải lên tiếp…',
  [UploadWait.Retry]: 'Mạng chập chờn, đang thử lại…',
};

/** After the attempts ran out: retry and remove, or remove only (diagram 05). */
export const uploadFailedMessages = {
  retryable: 'Chưa tải lên được. Kiểm tra mạng rồi bấm Thử lại.',
  permanent: 'Tệp này không tải lên được. Hãy xoá và chọn tệp khác.',
};

const mediaErrorMessages: Record<MediaError, string> = {
  [MediaError.UnsupportedFormat]: 'Máy chủ không đọc được tệp này. Hãy chọn tệp khác.',
  [MediaError.FileTooLarge]: 'Tệp quá lớn. Hãy chọn tệp nhỏ hơn.',
  [MediaError.VideoTooLong]: 'Video quá dài. Hãy cắt ngắn rồi chọn lại.',
  [MediaError.VideoNotPlayable]: NOT_PLAYABLE,
  [MediaError.BlankImage]: 'Ảnh trống hoặc bị che. Hãy chụp lại.',
  [MediaError.ProcessingFailed]: 'Máy chủ chưa xử lý được tệp này. Hãy xoá và chọn lại.',
  [MediaError.Missing]: 'Tệp đã hết hạn trên máy chủ. Hãy xoá và chọn lại.',
};

/** Under a file the server failed; every failure asks for another file. */
export const mediaErrorMessage = (code: MediaError | null) =>
  mediaErrorMessages[code ?? MediaError.ProcessingFailed];
