import { openShareSheet } from 'zmp-sdk';

import AppSheet from '@/components/app-sheet';
import type { ProductDetail } from '@/features/products/types/product';

// The sheet's 20px line height, kept at 16px text.
const actionClass =
  'flex min-h-[52px] w-full items-center gap-3 border-b border-solid border-[#eef2f8] p-0 text-left text-base leading-5';
const actionIconClass = 'grid size-7 place-items-center rounded-full text-lg leading-5';
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
  onClose,
  onReport,
  onError,
}: {
  product: ProductDetail;
  visible: boolean;
  isOwner: boolean;
  hasReported: boolean;
  isReportAvailable: boolean;
  onClose: () => void;
  onReport: () => void;
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
          title: product.title,
          description: product.description,
          thumbnail,
          path: `/products/${product.id}`,
        },
      });
      onClose();
    } catch {
      onError('Không thể mở bảng chia sẻ trên thiết bị này.');
    }
  };

  const reportTone = reportActionClass[hasReported ? 'reported' : 'available'];

  const reportProduct = () => {
    onClose();
    onReport();
  };

  return (
    <AppSheet visible={visible} title="Tuỳ chọn" autoHeight onClose={onClose}>
      <div className="px-4 pb-5">
        <button className={`${actionClass} text-marketplace-ink`} onClick={shareProduct}>
          <span
            aria-hidden="true"
            className={`${actionIconClass} bg-marketplace-tint text-marketplace-blue`}
          >
            ↗
          </span>
          Chia sẻ tin đăng
        </button>
        {!isOwner && (
          <button
            className={`${actionClass} ${reportTone.action}`}
            disabled={hasReported || !isReportAvailable}
            onClick={reportProduct}
          >
            <span aria-hidden="true" className={`${actionIconClass} ${reportTone.icon}`}>
              {hasReported ? '✓' : '!'}
            </span>
            {hasReported ? 'Bạn đã báo cáo tin này' : 'Báo cáo tin đăng'}
          </button>
        )}
      </div>
    </AppSheet>
  );
}
