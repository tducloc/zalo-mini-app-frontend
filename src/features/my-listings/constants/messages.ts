import { ListingAction, type StatusChange } from '@/features/my-listings/types/my-listing';

export const actionLabels: Record<ListingAction, string> = {
  [ListingAction.Edit]: 'Sửa tin',
  [ListingAction.MarkSold]: 'Đánh dấu đã bán',
  [ListingAction.Archive]: 'Ẩn tin',
  [ListingAction.Unarchive]: 'Hiện lại',
};

export const statusChangeSuccess: Record<StatusChange, string> = {
  [ListingAction.MarkSold]: 'Đã đánh dấu đã bán',
  [ListingAction.Archive]: 'Đã ẩn tin',
  [ListingAction.Unarchive]: 'Đã hiện lại tin',
};

/** Why a status change was refused, by HTTP status (api-spec, `POST /products/:id/sold`). */
export const statusChangeErrors: Partial<Record<number, string>> = {
  403: 'Bạn không thể thay đổi tin của người khác.',
  404: 'Tin không còn tồn tại.',
  409: 'Tin đã đổi trạng thái. Danh sách đã được cập nhật, vui lòng xem lại.',
};

export const STATUS_CHANGE_FAILED = 'Không thể cập nhật tin. Vui lòng kiểm tra mạng và thử lại.';

export const markSoldMessages = {
  title: 'Đánh dấu đã bán?',
  description: 'Tin sẽ không còn hiện với người mua. Bạn không thể đổi lại sau khi đã bán.',
  cancel: 'Chưa bán',
  confirm: 'Đã bán',
};
