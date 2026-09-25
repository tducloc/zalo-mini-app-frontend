import { RejectReason } from '@/features/media/media-limits';

/** What the seller reads under a refused file: why, and what to do instead. */
export const rejectMessages: Record<RejectReason, string> = {
  [RejectReason.UnsupportedFormat]: 'Chỉ nhận ảnh JPG, PNG, WebP và video MP4, MOV.',
  [RejectReason.Heic]:
    'Ảnh HEIC chưa dùng được. Hãy chọn ảnh JPG, hoặc tắt định dạng HEIC/HEIF trong cài đặt camera rồi chụp lại.',
  [RejectReason.ImageTooLarge]: 'Ảnh lớn hơn 15 MB.',
  [RejectReason.ImageTooSmall]: 'Ảnh quá nhỏ: cạnh ngắn cần từ 500 px.',
  [RejectReason.TooManyImages]: 'Mỗi tin có tối đa 10 ảnh.',
  [RejectReason.TooManyVideos]: 'Mỗi tin có tối đa 1 video.',
  [RejectReason.Unreadable]: 'Không đọc được tệp này. Hãy chọn lại.',
  [RejectReason.VideoTooLong]: 'Video dài hơn 60 giây.',
  [RejectReason.VideoTooLarge]: 'Video lớn hơn 150 MB.',
  [RejectReason.VideoResolution]: 'Video trên 1080p. Hãy quay ở 1080p rồi chọn lại.',
  [RejectReason.VideoNotPlayable]:
    'Video này không phát được trên mọi điện thoại. Hãy quay bằng camera mặc định rồi chọn lại.',
};
