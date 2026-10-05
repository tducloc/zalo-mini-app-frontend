import { Button } from 'zmp-ui';

import { actionLabels } from '@/features/my-listings/constants/messages';
import { ListingAction } from '@/features/my-listings/types/my-listing';
import type { ProductStatus } from '@/features/products/types/product';

interface OwnerBarContent {
  /** Where the listing stands for buyers. */
  note: string;
  /** The last one is the main button. The "•••" sheet has these and the rest. */
  actions: ListingAction[];
}

const ownerBarContent: Record<ProductStatus, OwnerBarContent> = {
  PUBLISHED: {
    note: 'Tin của bạn đang hiển thị với người mua.',
    actions: [ListingAction.Edit, ListingAction.MarkSold],
  },
  PROCESSING: {
    note: 'Đang xử lý ảnh, video. Người mua sẽ thấy tin khi xử lý xong.',
    actions: [ListingAction.Edit],
  },
  FAILED: {
    note: 'Xử lý ảnh, video không thành công. Sửa tin để thay tệp bị lỗi.',
    actions: [ListingAction.Edit],
  },
  ARCHIVED: {
    note: 'Tin đang ẩn. Người mua không thấy tin này.',
    actions: [ListingAction.Unarchive],
  },
  SOLD: {
    note: 'Bạn đã bán sản phẩm này. Người mua không còn thấy tin.',
    actions: [],
  },
};

// Two buttons share the bar's width; the sheet's "Đánh dấu đã bán" does not fit a small phone.
const barLabels: Partial<Record<ListingAction, string>> = {
  [ListingAction.MarkSold]: 'Đã bán',
};

/**
 * What the owner sees in place of "Liên hệ người bán" on their own listing: how buyers see
 * it, and what to do next.
 */
export default function ProductOwnerBar({
  status,
  isPending,
  onAction,
}: {
  status: ProductStatus;
  /** A status change is on its way: the buttons wait for it. */
  isPending: boolean;
  onAction: (action: ListingAction) => void;
}) {
  const { note, actions } = ownerBarContent[status];

  return (
    <>
      <p role="status" className="mb-0 mt-0 text-caption leading-[19px] text-marketplace-muted">
        {note}
      </p>
      {actions.length > 0 && (
        <div className="mt-2 flex gap-2">
          {actions.map((action, index) => (
            <Button
              key={action}
              className="h-11 flex-1"
              variant={index === actions.length - 1 ? 'primary' : 'secondary'}
              disabled={isPending}
              onClick={() => onAction(action)}
            >
              {barLabels[action] ?? actionLabels[action]}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}
