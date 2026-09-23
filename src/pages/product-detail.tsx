import { AxiosError } from 'axios';
import { useState } from 'react';
import { Page, useParams } from 'zmp-ui';

import FeedbackState from '@/components/feedback-state';
import { useSession } from '@/features/auth/hooks/session';
import { useProductDetail } from '@/features/products/api/get-product-detail';
import ProductActionsSheet from '@/features/products/components/actions-sheet';
import ProductContactAction from '@/features/products/components/contact-action';
import ProductDetailHeader from '@/features/products/components/detail-header';
import DetailSkeleton from '@/features/products/components/detail-skeleton';
import ProductInformation from '@/features/products/components/information';
import ProductMediaGallery from '@/features/products/components/media-gallery';
import ProductSellerContact from '@/features/products/components/seller-card';
import { useCreateReport } from '@/features/reports/api/create-report';
import ProductReportSheet from '@/features/reports/components/report-sheet';
import type { CreateReportInput } from '@/features/reports/types';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorStatus } from '@/utils/api-error';

const reportErrorMessages = {
  401: 'Bạn cần xác thực lại trước khi báo cáo.',
  403: 'Bạn không thể báo cáo tin đăng của chính mình.',
  409: 'Bạn đã báo cáo tin này trước đó.',
  429: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.',
};
const ALREADY_REPORTED_STATUS = 409;

export default function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const { showApiError, showError, showSuccess } = useToast();
  const { session, isBootstrapping } = useSession();

  // sheets
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Public detail loads immediately; once sign-in finishes the viewer changes
  // the key and the owner/report fields are fetched for that user.
  const viewerId = session?.user.id ?? null;
  const productQuery = useProductDetail(productId, viewerId);
  const reportMutation = useCreateReport(productId, viewerId);

  const handleSubmitReport = (input: CreateReportInput) =>
    reportMutation.mutate(input, {
      onSuccess: () => {
        setReportOpen(false);
        showSuccess('Cảm ơn bạn. Báo cáo đã được gửi để kiểm tra.');
      },
      onError: (error) => {
        if (getApiErrorStatus(error) === ALREADY_REPORTED_STATUS) {
          setReportOpen(false);
        }
        showApiError(error, {
          fallbackMessage: 'Không thể gửi báo cáo. Vui lòng thử lại.',
          messages: reportErrorMessages,
        });
      },
    });

  // An owner's unpublished listing is 404 until the signed-in request runs.
  const isWaitingForViewer = productQuery.isError && isBootstrapping;

  if (productQuery.isPending || isWaitingForViewer) {
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
            onAction={() => productQuery.refetch()}
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
        // The anonymous placeholder cannot know whether this viewer reported.
        isReportAvailable={!productQuery.isPlaceholderData}
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
        onSubmit={handleSubmitReport}
      />
    </Page>
  );
}
