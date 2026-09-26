/**
 * What the create-listing form says: what each field needs, why a file was refused, what an upload waits for or
 * why it failed, why the server refused a file, and how a post ended.
 */

import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/features/listings/constants/listing-fields';
import {
  MIB,
  MAX_IMAGES_PER_LISTING,
  MAX_VIDEOS_PER_LISTING,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_SHORT_EDGE,
} from '@/features/media/constants/limits';
import { RejectReason, type RefusedFile } from '@/features/media/types/media';
import { MediaError, UploadWait } from '@/features/media/types/upload';
import { MAX_PRICE_VND } from '@/features/products/constants/product';
import { formatNumber, formatVnd } from '@/utils/format';

const MEGAPIXEL = 1_000_000;

/** The same words whether the phone or the server finds the clip unplayable. */
const NOT_PLAYABLE = 'Vui lòng chọn video khác: video này không phát được trên mọi điện thoại';

// ---- Fields ----

/** Under each field: what it needs. */
export const listingFormMessages = {
  title: `Vui lòng nhập tiêu đề từ ${TITLE_MIN_LENGTH} đến ${TITLE_MAX_LENGTH} ký tự.`,
  description: `Vui lòng nhập mô tả từ ${DESCRIPTION_MIN_LENGTH} đến ${formatNumber(DESCRIPTION_MAX_LENGTH)} ký tự.`,
  price: 'Vui lòng nhập giá bán là số đồng lớn hơn 0, ví dụ 150.000.',
  priceTooHigh: `Vui lòng nhập giá bán không quá ${formatVnd(MAX_PRICE_VND)}.`,
  categoryId: 'Vui lòng chọn danh mục.',
  condition: 'Vui lòng chọn tình trạng.',
  locationId: 'Vui lòng chọn địa điểm.',
};

// ---- Before uploading ----

/**
 * Why a file was refused, and what to do instead: one sentence each, without its full
 * stop, so the toast can put the file names after it.
 */
const rejectSentences: Record<RejectReason, string> = {
  // Photos
  [RejectReason.UnsupportedImageFormat]: 'Vui lòng chọn ảnh JPG, PNG hoặc WebP',
  [RejectReason.ImageTooLarge]: `Vui lòng chọn ảnh nhỏ hơn ${MAX_IMAGE_BYTES / MIB} MB`,
  [RejectReason.ImageTooManyPixels]: `Vui lòng chọn ảnh không quá ${MAX_IMAGE_PIXELS / MEGAPIXEL} MP`,
  [RejectReason.TooManyImages]: `Vui lòng chọn tối đa ${MAX_IMAGES_PER_LISTING} ảnh cho mỗi tin`,

  // Videos
  [RejectReason.UnsupportedVideoFormat]: 'Vui lòng chọn video MP4 hoặc MOV',
  [RejectReason.TooManyVideos]: `Vui lòng chọn tối đa ${MAX_VIDEOS_PER_LISTING} video cho mỗi tin`,
  [RejectReason.VideoTooLong]: `Vui lòng chọn video không quá ${MAX_VIDEO_SECONDS} giây`,
  [RejectReason.VideoTooLarge]: `Vui lòng chọn video nhỏ hơn ${MAX_VIDEO_BYTES / MIB} MB`,
  [RejectReason.VideoResolution]: `Vui lòng chọn video ${MAX_VIDEO_SHORT_EDGE}p trở xuống`,
  [RejectReason.VideoNotPlayable]: NOT_PLAYABLE,

  // Any file
  [RejectReason.Unreadable]: 'Vui lòng chọn lại tệp này',
};

/** What the viewer says about a file refused after it joined the draft. */
export const rejectMessage = (reason: RejectReason) => `${rejectSentences[reason]}.`;

/**
 * One toast for the files refused when they were picked, a sentence per reason, e.g.
 * "Vui lòng chọn tối đa 10 ảnh cho mỗi tin (a.jpg, b.jpg)."
 */
export function refusedFilesMessage(refused: RefusedFile[]) {
  const namesByReason = new Map<RejectReason, string[]>();
  for (const { name, reason } of refused) {
    namesByReason.set(reason, [...(namesByReason.get(reason) ?? []), name]);
  }
  return [...namesByReason]
    .map(([reason, names]) => `${rejectSentences[reason]} (${listNames(names)}).`)
    .join(' ');
}

/** Two names in full; beyond that, how many more. */
function listNames(names: string[]) {
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} và ${names.length - 2} tệp khác` : shown;
}

/** Under the photos after a tap on Post without one. */
export const missingPhotoMessage = 'Vui lòng thêm ít nhất 1 ảnh: ảnh đầu tiên là ảnh bìa của tin.';

// ---- Uploading and processing ----

/** The short line on a tile; the viewer gives the full sentence. */
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
  retryable: 'Vui lòng kiểm tra mạng rồi bấm Thử lại.',
  permanent: 'Vui lòng chọn tệp khác.',
};

const mediaErrorMessages: Record<MediaError, string> = {
  [MediaError.UnsupportedFormat]: 'Vui lòng chọn tệp khác.',
  [MediaError.FileTooLarge]: 'Vui lòng chọn tệp nhỏ hơn.',
  [MediaError.VideoTooLong]: `Vui lòng chọn video không quá ${MAX_VIDEO_SECONDS} giây.`,
  [MediaError.VideoNotPlayable]: `${NOT_PLAYABLE}.`,
  [MediaError.BlankImage]: 'Vui lòng chọn ảnh khác: ảnh bị trống.',
  [MediaError.ProcessingFailed]: 'Vui lòng chọn lại tệp này.',
  [MediaError.Missing]: 'Vui lòng chọn lại tệp này.',
};

/** Under a file the server failed; every failure asks for another file. */
export const mediaErrorMessage = (code: MediaError | null) =>
  mediaErrorMessages[code ?? MediaError.ProcessingFailed];

// ---- Posting ----

export const postMessages = {
  /** Next to the disabled Post button. */
  working: 'Đang tải ảnh và video lên. Nút Đăng tin sẽ mở khi xong.',
  /** 202: the listing waits for its media. */
  processing: 'Đã đăng tin. Tin sẽ hiện với người mua khi ảnh và video xử lý xong.',
  /** 201: every file was ready. */
  published: 'Đã đăng tin.',
  alreadyPosted: 'Tin này đã được đăng trước đó.',
  fields: 'Vui lòng sửa các mục được đánh dấu đỏ rồi đăng lại.',
  mediaConflict: 'Vui lòng xoá rồi chọn lại ảnh, video: có tệp máy chủ không dùng được.',
  invalid: 'Vui lòng thử lại sau: máy chủ chưa nhận tin này, tin chưa được đăng.',
  failed: 'Vui lòng kiểm tra mạng rồi bấm Đăng tin lại: tin chưa được đăng.',
};
