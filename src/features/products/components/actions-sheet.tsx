import { openShareSheet } from 'zmp-sdk';
import { Sheet } from 'zmp-ui';

import type { ProductDetail } from '../types';

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

  const reportProduct = () => {
    onClose();
    onReport();
  };

  return (
    <Sheet visible={visible} title="Tùy chọn" autoHeight onClose={onClose}>
      <div className="product-actions-sheet">
        <button onClick={shareProduct}>
          <span aria-hidden="true">↗</span>
          Chia sẻ tin đăng
        </button>
        {!isOwner && (
          <button
            className={hasReported ? 'reported' : 'danger'}
            disabled={hasReported || !isReportAvailable}
            onClick={reportProduct}
          >
            <span aria-hidden="true">{hasReported ? '✓' : '!'}</span>
            {hasReported ? 'Bạn đã báo cáo tin này' : 'Báo cáo tin đăng'}
          </button>
        )}
      </div>
    </Sheet>
  );
}
