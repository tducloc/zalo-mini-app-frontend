import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Page, useParams } from 'zmp-ui';

import FeedbackState from '@/components/feedback-state';
import { useSession } from '@/features/auth/hooks/session';
import { getProductDetail } from '@/features/products/api/detail';
import ProductActionsSheet from '@/features/products/components/actions-sheet';
import ProductContactAction from '@/features/products/components/contact-action';
import ProductDetailHeader from '@/features/products/components/detail-header';
import DetailSkeleton from '@/features/products/components/detail-skeleton';
import ProductInformation from '@/features/products/components/information';
import ProductMediaGallery from '@/features/products/components/media-gallery';
import ProductSellerContact from '@/features/products/components/seller-card';
import { ProductDetail } from '@/features/products/types';
import { ReportReason, reportProduct } from '@/features/reports/api/create-report';
import ProductReportSheet from '@/features/reports/components/report-sheet';
import { getApiErrorStatus } from '@/lib/api-error';
import { useToast } from '@/hooks/use-toast';

const reportErrorMessages = {
  401: 'Bạn cần xác thực lại trước khi báo cáo.',
  403: 'Bạn không thể báo cáo tin đăng của chính mình.',
  409: 'Bạn đã báo cáo tin này trước đó.',
  429: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.',
};

export default function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();

  const { showApiError, showError, showSuccess } = useToast();

  const queryClient = useQueryClient();

  const { session, isBootstrapping } = useSession();

  const [reportOpen, setReportOpen] = useState(false);

  const [actionsOpen, setActionsOpen] = useState(false);

  const productQueryKey = ['product-detail', productId, session?.user.id] as const;

  const productQuery = useQuery({
    queryKey: productQueryKey,
    queryFn: () => getProductDetail(productId),
    enabled: Boolean(productId) && !isBootstrapping,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const markAsReported = () =>
    queryClient.setQueryData<ProductDetail>(productQueryKey, (current) =>
      current
        ? {
            ...current,
            viewer: { ...current.viewer, hasReported: true },
          }
        : current,
    );

  const reportMutation = useMutation({
    mutationFn: (input: { reason: ReportReason; description?: string }) =>
      reportProduct(productId, input),
    onSuccess: () => {
      markAsReported();
      setReportOpen(false);
      showSuccess('Cảm ơn bạn. Báo cáo đã được gửi để kiểm tra.');
    },
    onError: (error) => {
      if (getApiErrorStatus(error) === 409) {
        markAsReported();
        setReportOpen(false);
      }
      showApiError(error, {
        fallbackMessage: 'Không thể gửi báo cáo. Vui lòng thử lại.',
        messages: reportErrorMessages,
      });
    },
  });

  if (productQuery.isPending) {
    return (
      <Page className="marketplace-page">
        <ProductDetailHeader />
        <DetailSkeleton />
      </Page>
    );
  }

  if (!productQuery.data) {
    return (
      <Page className="marketplace-page">
        <ProductDetailHeader />
        <main className="marketplace-content product-detail-feedback">
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
  const isOwner = product.viewer.isOwner || session?.user.id === product.seller.id;
  return (
    <Page className="marketplace-page product-detail-page">
      <ProductDetailHeader />
      <main className="product-detail-content">
        <ProductMediaGallery media={product.media} productTitle={product.title} />
        <section className="product-detail-body">
          <ProductInformation product={product} onOpenActions={() => setActionsOpen(true)} />
          <ProductSellerContact product={product} />
        </section>
      </main>
      <ProductContactAction product={product} onContactError={showError} />
      <ProductActionsSheet
        isOwner={isOwner}
        hasReported={product.viewer.hasReported}
        product={product}
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onError={showError}
        onReport={() => setReportOpen(true)}
      />
      <ProductReportSheet
        isPending={reportMutation.isPending}
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={(input) => reportMutation.mutate(input)}
      />
    </Page>
  );
}
