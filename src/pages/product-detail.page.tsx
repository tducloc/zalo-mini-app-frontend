import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { Button, Icon, Page, useParams } from 'zmp-ui';
import { openPhone, openProfile } from 'zmp-sdk';

import FeedbackState from '@/components/feedback-state.component';
import MobilePageHeader from '@/components/mobile-page-header.component';
import Price from '@/components/price.component';
import { getProductDetail } from '@/features/products/product-detail.api';
import { ProductDetail } from '@/features/products/product-detail.types';
import ProductReportSheet from '@/features/reports/product-report-sheet.component';
import { reportProduct, ReportReason } from '@/features/reports/product-report.api';

const conditionLabel: Record<ProductDetail['condition'], string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  USED: 'Đã dùng',
};

function DetailSkeleton() {
  return (
    <main className="marketplace-content marketplace-content-with-header product-detail-skeleton">
      <div className="product-detail-image-placeholder" />
      <div className="listing-line" />
      <div className="listing-line short" />
      <div className="listing-line" />
    </main>
  );
}

function toErrorMessage(error: unknown) {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  if (status === 409) return 'Bạn đã báo cáo tin này trước đó.';
  if (status === 429) return 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.';
  if (status === 401) return 'Bạn cần xác thực lại trước khi báo cáo.';
  return 'Không thể gửi báo cáo. Vui lòng thử lại.';
}

export default function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const [activeMediaId, setActiveMediaId] = useState<string>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const productQuery = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => getProductDetail(productId),
    enabled: Boolean(productId),
  });
  const reportMutation = useMutation({
    mutationFn: (input: { reason: ReportReason; description?: string }) =>
      reportProduct(productId, input),
    onSuccess: () => {
      setReportOpen(false);
      setReportMessage('Cảm ơn bạn. Báo cáo đã được gửi để kiểm tra.');
    },
    onError: (error) => setReportMessage(toErrorMessage(error)),
  });

  const media = productQuery.data?.media ?? [];
  const activeMedia = useMemo(
    () => media.find((item) => item.id === activeMediaId) ?? media[0],
    [activeMediaId, media],
  );
  const contactSeller = async () => {
    const contact = productQuery.data?.seller.contact;
    if (!contact) return;
    try {
      if (contact.zaloProfileId) {
        await openProfile({ id: contact.zaloProfileId, type: 'user' });
      } else if (contact.phoneNumber) {
        await openPhone({ phoneNumber: contact.phoneNumber });
      }
    } catch {
      setReportMessage('Không thể mở liên hệ trên thiết bị này.');
    }
  };

  if (productQuery.isPending) {
    return (
      <Page className="marketplace-page">
        <MobilePageHeader title="Chi tiết tin" showBack />
        <DetailSkeleton />
      </Page>
    );
  }
  if (!productQuery.data) {
    return (
      <Page className="marketplace-page">
        <MobilePageHeader title="Chi tiết tin" showBack />
        <main className="marketplace-content marketplace-content-with-header">
          <FeedbackState
            type={
              productQuery.error instanceof AxiosError &&
              productQuery.error.response?.status === 404
                ? 'empty'
                : 'error'
            }
            title={
              productQuery.error instanceof AxiosError &&
              productQuery.error.response?.status === 404
                ? 'Tin không còn tồn tại'
                : 'Không tải được tin'
            }
            description="Vui lòng thử lại hoặc quay về danh sách tin đăng."
            onRetry={() => productQuery.refetch()}
          />
        </main>
      </Page>
    );
  }

  const product = productQuery.data;
  const canContact = Boolean(product.seller.contact);
  return (
    <Page className="marketplace-page product-detail-page">
      <MobilePageHeader title="Chi tiết tin" showBack />
      <main className="marketplace-content marketplace-content-with-header">
        {activeMedia ? (
          activeMedia.type === 'VIDEO' ? (
            <video
              className="product-detail-media"
              controls
              poster={activeMedia.thumbnailUrl ?? undefined}
              src={activeMedia.mediumUrl ?? undefined}
            />
          ) : (
            <img
              className="product-detail-media"
              src={activeMedia.mediumUrl ?? activeMedia.thumbnailUrl ?? ''}
              alt={product.title}
            />
          )
        ) : (
          <div className="product-detail-image-placeholder" />
        )}
        {media.length > 1 && (
          <div className="product-detail-thumbnails" aria-label="Ảnh và video sản phẩm">
            {media.map((item) => (
              <button
                aria-label={`Xem ${item.type === 'VIDEO' ? 'video' : 'ảnh'} ${item.sortOrder + 1}`}
                className={item.id === activeMedia?.id ? 'selected' : ''}
                key={item.id}
                onClick={() => setActiveMediaId(item.id)}
              >
                <img src={item.thumbnailUrl ?? item.mediumUrl ?? ''} alt="" />
                {item.type === 'VIDEO' && <Icon icon="zi-play" size={16} />}
              </button>
            ))}
          </div>
        )}
        <p className="product-detail-meta">
          {product.category.name} · {conditionLabel[product.condition]} · {product.location}
        </p>
        <h1 className="product-detail-title">{product.title}</h1>
        <Price value={product.price} />
        <p className="product-detail-meta">
          Đăng {new Date(product.publishedAt ?? product.createdAt).toLocaleDateString('vi-VN')}
        </p>
        <section className="product-detail-description">
          <h2>Mô tả sản phẩm</h2>
          <p>{product.description}</p>
        </section>
        <section className="product-seller-card">
          {product.seller.avatarUrl ? (
            <img src={product.seller.avatarUrl} alt="" />
          ) : (
            <span>{(product.seller.name ?? 'N')[0]}</span>
          )}
          <div>
            <h2>{product.seller.name ?? 'Người bán Zalo'}</h2>
            <p>Người bán trên Chợ Zalo</p>
          </div>
        </section>
        {reportMessage && (
          <p className="product-detail-message" role="status">
            {reportMessage}
          </p>
        )}
        <button className="product-report-trigger" onClick={() => setReportOpen(true)}>
          Báo cáo tin đăng
        </button>
      </main>
      <footer className="product-detail-actions">
        <Button
          fullWidth
          disabled={!canContact || product.status === 'SOLD'}
          onClick={contactSeller}
        >
          {product.status === 'SOLD'
            ? 'Sản phẩm đã bán'
            : canContact
              ? 'Liên hệ người bán'
              : 'Người bán chưa bật liên hệ'}
        </Button>
      </footer>
      <ProductReportSheet
        isPending={reportMutation.isPending}
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={(input) => reportMutation.mutate(input)}
      />
    </Page>
  );
}
