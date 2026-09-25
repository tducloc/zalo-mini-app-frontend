import { UploadWait } from '@/features/media/upload/file-upload';
import { MediaError } from '@/features/media/upload/upload-types';

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
  [MediaError.VideoNotPlayable]:
    'Video này không phát được trên mọi điện thoại. Hãy quay bằng camera của máy rồi chọn lại.',
  [MediaError.ImageTooSmall]: 'Ảnh quá nhỏ. Hãy chọn ảnh rõ hơn.',
  [MediaError.BlankImage]: 'Ảnh trống hoặc bị che. Hãy chụp lại.',
  [MediaError.ProcessingFailed]: 'Máy chủ chưa xử lý được tệp này. Hãy xoá và chọn lại.',
  [MediaError.Missing]: 'Tệp đã hết hạn trên máy chủ. Hãy xoá và chọn lại.',
};

const isMediaError = (code: string): code is MediaError =>
  Object.values<string>(MediaError).includes(code);

/** Under a file the server failed; every failure asks for another file. */
export function mediaErrorMessage(code: string | null) {
  return code && isMediaError(code)
    ? mediaErrorMessages[code]
    : mediaErrorMessages[MediaError.ProcessingFailed];
}
