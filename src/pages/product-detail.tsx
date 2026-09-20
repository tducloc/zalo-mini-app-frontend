import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Page, useParams } from 'zmp-ui';

import FeedbackState from '@/components/feedback-state';
import MobilePageHeader from '@/components/mobile-page-header';
import { useSession } from '@/features/auth/hooks/session';
import { getProductDetail } from '@/features/products/api/detail';
import ProductContactAction from '@/features/products/components/contact-action';
import DetailSkeleton from '@/features/products/components/detail-skeleton';
import ProductInformation from '@/features/products/components/information';
import ProductMediaGallery from '@/features/products/components/media-gallery';
import ProductSellerContact from '@/features/products/components/seller-card';
import { ReportReason, reportProduct } from '@/features/reports/api/create-report';
import ProductReportSheet from '@/features/reports/components/report-sheet';

function toErrorMessage(error: unknown) {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  if (status === 409) return 'Bạn đã báo cáo tin này trước đó.';
  if (status === 429) return 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.';
  if (status === 403) return 'Bạn không thể báo cáo tin đăng của chính mình.';
  if (status === 401) return 'Bạn cần xác thực lại trước khi báo cáo.';
  return 'Không thể gửi báo cáo. Vui lòng thử lại.';
}

export default function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();

  const { session, isBootstrapping } = useSession();

  const [reportOpen, setReportOpen] = useState(false);

  const [reportMessage, setReportMessage] = useState('');

  const productQuery = useQuery({
    queryKey: ['product-detail', productId, session?.user.id],
    queryFn: () => getProductDetail(productId),
    enabled: Boolean(productId) && !isBootstrapping,
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
  const isOwner = session?.user.id === product.seller.id;
  return (
    <Page className="marketplace-page product-detail-page">
      <MobilePageHeader title="Chi tiết tin" showBack />
      <main className="marketplace-content marketplace-content-with-header">
        <ProductMediaGallery media={product.media} productTitle={product.title} />
        <ProductInformation product={product} />
        <ProductSellerContact product={product} />
        {reportMessage && (
          <p className="product-detail-message" role="status">
            {reportMessage}
          </p>
        )}
        {!isOwner && (
          <button className="product-report-trigger" onClick={() => setReportOpen(true)}>
            Báo cáo tin đăng
          </button>
        )}
      </main>
      <ProductContactAction product={product} onContactError={setReportMessage} />
      <ProductReportSheet
        isPending={reportMutation.isPending}
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={(input) => reportMutation.mutate(input)}
      />
    </Page>
  );
}
