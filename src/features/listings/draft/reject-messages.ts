import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_LISTING,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  MAX_VIDEO_SHORT_EDGE,
  MAX_VIDEOS_PER_LISTING,
  MIB,
  MIN_IMAGE_EDGE,
  RejectReason,
} from '@/features/media/media-limits';

/** What the seller reads under a refused file: why, and what to do instead. */
export const rejectMessages: Record<RejectReason, string> = {
  [RejectReason.UnsupportedFormat]:
    'Chỉ nhận ảnh JPG, PNG, WebP và video MP4, MOV. Ảnh HEIC của iPhone: Cài đặt > Camera > Định dạng > Tương thích nhất.',
  [RejectReason.ImageTooLarge]: `Ảnh lớn hơn ${MAX_IMAGE_BYTES / MIB} MB.`,
  [RejectReason.ImageTooSmall]: `Ảnh quá nhỏ: cạnh ngắn cần từ ${MIN_IMAGE_EDGE} px.`,
  [RejectReason.TooManyImages]: `Mỗi tin có tối đa ${MAX_IMAGES_PER_LISTING} ảnh.`,
  [RejectReason.TooManyVideos]: `Mỗi tin có tối đa ${MAX_VIDEOS_PER_LISTING} video.`,
  [RejectReason.Unreadable]: 'Không đọc được tệp này. Hãy chọn lại.',
  [RejectReason.VideoTooLong]: `Video dài hơn ${MAX_VIDEO_DURATION_MS / 1000} giây.`,
  [RejectReason.VideoTooLarge]: `Video lớn hơn ${MAX_VIDEO_BYTES / MIB} MB.`,
  [RejectReason.VideoResolution]: `Video trên ${MAX_VIDEO_SHORT_EDGE}p. Hãy quay ở ${MAX_VIDEO_SHORT_EDGE}p rồi chọn lại.`,
  [RejectReason.VideoHevc]:
    'Video ở định dạng HEVC (hiệu quả cao) mà máy này chưa chuyển được. iPhone: Cài đặt > Camera > Định dạng > Tương thích nhất. Android: tắt HEVC trong cài đặt camera. Rồi quay lại.',
  [RejectReason.VideoNotPlayable]:
    'Video này không phát được trên mọi điện thoại. Hãy quay bằng camera của máy rồi chọn lại.',
};
