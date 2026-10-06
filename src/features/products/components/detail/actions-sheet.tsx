import { openShareSheet } from 'zmp-sdk';

import AppSheet from '@/components/app-sheet';
import { sheetActionClass, sheetActionIconClass } from '@/components/layout/styles';
import OwnerActionList from '@/features/my-listings/components/actions/owner-action-list';
import type { ListingAction } from '@/features/my-listings/types/my-listing';
import type { ProductDetail } from '@/features/products/types/product';
import { warnInDev } from '@/utils/dev-log';

// zmp-sdk refuses longer text before Zalo sees it. A listing allows a 120-character title and
// a 5,000-character description.
const SHARE_TITLE_MAX_LENGTH = 100;
const SHARE_DESCRIPTION_MAX_LENGTH = 400;

function shorten(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  // Never leave half of an emoji's surrogate pair before the ellipsis.
  return `${text.slice(0, maxLength - 1).replace(/[\uD800-\uDBFF]$/, '')}…`;
}

const reportActionClass = {
  available: { action: 'text-[#c63737]', icon: 'bg-marketplace-danger-tint' },
  reported: { action: 'cursor-default text-[#6f7f95]', icon: 'bg-[#edf7f1] text-[#25834b]' },
};

export default function ProductActionsSheet({
  product,
  visible,
  isOwner,
  hasReported,
  isReportAvailable,
  isOwnerActionPending,
  onClose,
  onReport,
  onOwnerAction,
  onError,
}: {
  product: ProductDetail;
  visible: boolean;
  isOwner: boolean;
  hasReported: boolean;
  isReportAvailable: boolean;
  /** A status change is on its way: the owner's actions wait for it. */
  isOwnerActionPending: boolean;
  onClose: () => void;
  onReport: () => void;
  onOwnerAction: (action: ListingAction) => void;
  onError: (message: string) => void;
}) {
  const shareProduct = async () => {
    const thumbnail = product.media.find((item) => item.type === 'IMAGE')?.thumbnailUrl;
    if (!thumbnail) {
      onError('Tin đăng chưa có ảnh để chia sẻ.');
      return;
    }

    try {
      await openShareSheet({
        type: 'zmp',
        data: {
          title: shorten(product.title, SHARE_TITLE_MAX_LENGTH),
          description: shorten(product.description, SHARE_DESCRIPTION_MAX_LENGTH),
          thumbnail,
          path: `/products/${product.id}`,
        },
      });
      onClose();
    } catch (error: unknown) {
      warnInDev('share', 'Cannot open the share sheet', error);
      onError('Không thể mở bảng chia sẻ trên thiết bị này.');
    }
  };

  const isShareable = !isOwner || product.status === 'PUBLISHED';
  const reportTone = reportActionClass[hasReported ? 'reported' : 'available'];

  const reportProduct = () => {
    onClose();
    onReport();
  };

  const selectOwnerAction = (action: ListingAction) => {
    onClose();
    onOwnerAction(action);
  };

  return (
    <AppSheet visible={visible} title="Tuỳ chọn" autoHeight onClose={onClose}>
      <div className="px-4 pb-5">
        {isOwner && (
          <OwnerActionList
            status={product.status}
            isDisabled={isOwnerActionPending}
            onSelect={selectOwnerAction}
          />
        )}
        {/* Buyers cannot open an owner's listing that is not shown. */}
        {isShareable && (
          <button className={`${sheetActionClass} text-marketplace-ink`} onClick={shareProduct}>
            <span
              aria-hidden="true"
              className={`${sheetActionIconClass} bg-marketplace-tint text-marketplace-blue`}
            >
              ↗
            </span>
            Chia sẻ tin đăng
          </button>
        )}
        {!isOwner && (
          <button
            className={`${sheetActionClass} ${reportTone.action}`}
            disabled={hasReported || !isReportAvailable}
            onClick={reportProduct}
          >
            <span aria-hidden="true" className={`${sheetActionIconClass} ${reportTone.icon}`}>
              {hasReported ? '✓' : '!'}
            </span>
            {hasReported ? 'Bạn đã báo cáo tin này' : 'Báo cáo tin đăng'}
          </button>
        )}
      </div>
    </AppSheet>
  );
}
