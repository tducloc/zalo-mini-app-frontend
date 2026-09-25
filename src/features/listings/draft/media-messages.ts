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
import { MAX_IMAGE_BYTES } from '@/features/media/image/image-utils';
import { UploadWait } from '@/features/media/upload/file-upload';
import { MediaError } from '@/features/media/upload/upload-types';

/** The same advice whether the phone or the server finds the clip unplayable. */
const NOT_PLAYABLE =
  'Vui lòng quay video bằng camera của máy rồi chọn lại: video này không phát được trên mọi điện thoại.';

// ---- Before uploading ----

/** What the seller reads under a refused file: why, and what to do instead. */
export const rejectMessages: Record<RejectReason, string> = {
  // Photos
  [RejectReason.UnsupportedImageFormat]: 'Vui lòng chọn ảnh JPG, PNG hoặc WebP.',
  [RejectReason.ImageTooLarge]: `Vui lòng chọn ảnh nhỏ hơn ${MAX_IMAGE_BYTES / MIB} MB.`,
  [RejectReason.TooManyImages]: `Vui lòng chọn tối đa ${MAX_IMAGES_PER_LISTING} ảnh cho mỗi tin.`,

  // Videos
  [RejectReason.UnsupportedVideoFormat]: 'Vui lòng chọn video MP4 hoặc MOV.',
  [RejectReason.TooManyVideos]: `Vui lòng chọn tối đa ${MAX_VIDEOS_PER_LISTING} video cho mỗi tin.`,
  [RejectReason.VideoTooLong]: `Vui lòng chọn video không quá ${MAX_VIDEO_DURATION_MS / 1000} giây.`,
  [RejectReason.VideoTooLarge]: `Vui lòng chọn video nhỏ hơn ${MAX_VIDEO_BYTES / MIB} MB.`,
  [RejectReason.VideoResolution]: `Vui lòng quay video ở ${MAX_VIDEO_SHORT_EDGE}p trở xuống rồi chọn lại.`,
  [RejectReason.VideoHevc]:
    'Vui lòng quay lại video ở định dạng Tương thích nhất (iPhone: Cài đặt > Camera > Định dạng; Android: tắt HEVC trong cài đặt camera): máy này chưa chuyển được video HEVC.',
  [RejectReason.VideoNotPlayable]: NOT_PLAYABLE,

  // Any file
  [RejectReason.Unreadable]: 'Vui lòng chọn lại tệp: máy không đọc được tệp này.',
};

// ---- Uploading and processing ----

/**
 * One toast for the files refused when they were picked, a sentence per reason, e.g.
 * "Vui lòng chọn tối đa 10 ảnh cho mỗi tin (a.jpg, b.jpg)."
 */
export function refusedFilesMessage(refused: { name: string; reason: RejectReason }[]) {
  const namesByReason = new Map<RejectReason, string[]>();
  for (const { name, reason } of refused) {
    namesByReason.set(reason, [...(namesByReason.get(reason) ?? []), name]);
  }
  return [...namesByReason]
    .map(([reason, names]) => `${rejectMessages[reason].replace(/\.$/, '')} (${listNames(names)}).`)
    .join(' ');
}

/** Two names in full; beyond that, how many more. */
function listNames(names: string[]) {
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} và ${names.length - 2} tệp khác` : shown;
}

/** The short line on a tile; the sheet gives the full sentence. */
export const tileLabels = {
  checking: 'Đang kiểm tra',
  optimizingPhoto: 'Đang tối ưu',
  convertingVideo: 'Đang chuyển 720p',
  queued: 'Chờ tải lên',
  uploading: 'Đang tải lên',
  waitingNetwork: 'Chờ mạng',
  retrying: 'Đang thử lại',
  processing: 'Đang xử lý',
};

/** What the tile says while an upload waits (diagram 05). */
export const uploadWaitMessages: Record<UploadWait, string> = {
  [UploadWait.Network]: 'Đang chờ có mạng để tải lên tiếp…',
  [UploadWait.Retry]: 'Mạng chập chờn, đang thử lại…',
};

/** After the attempts ran out: retry and remove, or remove only (diagram 05). */
export const uploadFailedMessages = {
  retryable: 'Vui lòng kiểm tra mạng rồi bấm Thử lại: tệp chưa tải lên được.',
  permanent: 'Vui lòng xoá và chọn tệp khác: tệp này không tải lên được.',
};

const mediaErrorMessages: Record<MediaError, string> = {
  [MediaError.UnsupportedFormat]: 'Vui lòng chọn tệp khác: máy chủ không đọc được tệp này.',
  [MediaError.FileTooLarge]: 'Vui lòng chọn tệp nhỏ hơn: tệp này quá lớn.',
  [MediaError.VideoTooLong]: `Vui lòng cắt video không quá ${MAX_VIDEO_DURATION_MS / 1000} giây rồi chọn lại.`,
  [MediaError.VideoNotPlayable]: NOT_PLAYABLE,
  [MediaError.BlankImage]: 'Vui lòng chụp lại: ảnh trống hoặc bị che.',
  [MediaError.ProcessingFailed]: 'Vui lòng xoá và chọn lại tệp: máy chủ chưa xử lý được.',
  [MediaError.Missing]: 'Vui lòng xoá và chọn lại tệp: tệp đã hết hạn trên máy chủ.',
};

/** Under a file the server failed; every failure asks for another file. */
export const mediaErrorMessage = (code: MediaError | null) =>
  mediaErrorMessages[code ?? MediaError.ProcessingFailed];
