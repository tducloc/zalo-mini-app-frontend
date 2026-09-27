import { useState } from 'react';
import { Page, useNavigate, useParams } from 'zmp-ui';

import ConfirmDialog from '@/components/feedback/confirm-dialog';
import FeedbackState from '@/components/feedback/feedback-state';
import { pageClass } from '@/components/layout/styles';
import { useSession } from '@/features/auth/hooks/use-session';
import DraftBanner from '@/features/listings/components/draft/draft-banner';
import { useOwnerListingActions } from '@/features/my-listings/hooks/use-owner-listing-actions';
import { useProductDetail } from '@/features/products/api/get-product-detail';
import ProductActionsSheet from '@/features/products/components/detail/actions-sheet';
import ProductContactAction from '@/features/products/components/detail/contact-action';
import ProductDetailHeader from '@/features/products/components/detail/detail-header';
import DetailSkeleton from '@/features/products/components/detail/detail-skeleton';
import ProductInformation from '@/features/products/components/detail/information';
import ProductMediaGallery from '@/features/products/components/gallery/media-gallery';
import ProductSellerContact from '@/features/products/components/detail/seller-card';
import { useCreateReport } from '@/features/reports/api/create-report';
import ProductReportSheet from '@/features/reports/components/report-sheet';
import type { CreateReportInput } from '@/features/reports/types/report';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorStatus, HttpStatus } from '@/utils/api-error';

const reportErrorMessages: Partial<Record<number, string>> = {
  401: 'Bạn cần xác thực lại trước khi báo cáo.',
  403: 'Bạn không thể báo cáo tin đăng của chính mình.',
  429: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.',
};

// No tab bar: room for the contact bar (and the draft banner in it, 52px and 12px).
const detailPageClass =
  'bg-white pb-[calc(76px_+_var(--zaui-safe-area-inset-bottom))] [.has-draft-banner_&]:pb-[calc(140px_+_var(--zaui-safe-area-inset-bottom))]';

export default function ProductDetailPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { showError, showInfo, showSuccess } = useToast();
  const { session, isBootstrapping } = useSession();

  // sheets
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  // Public detail loads immediately; once sign-in finishes the viewer changes
  // the key and the owner/report fields are fetched for that user.
  const viewerId = session?.user.id ?? null;
  const productQuery = useProductDetail(productId, viewerId);
  const reportMutation = useCreateReport(productId, viewerId);
  const ownerActions = useOwnerListingActions();

  const handleSubmitReport = (input: CreateReportInput) =>
    reportMutation.mutate(input, {
      onSuccess: (isNewReport) => {
        setReportOpen(false);
        if (isNewReport) {
          showSuccess('Cảm ơn bạn. Báo cáo đã được gửi để kiểm tra.');
          return;
        }
        showInfo('Bạn đã báo cáo tin này trước đó.');
      },
      onError: (error) => {
        const status = getApiErrorStatus(error);
        const message = status ? reportErrorMessages[status] : undefined;
        showError(message ?? 'Không thể gửi báo cáo. Vui lòng thử lại.');
      },
    });

  // An owner's unpublished listing is 404 until the signed-in request runs.
  const isWaitingForViewer = productQuery.isError && isBootstrapping;

  if (productQuery.isPending || isWaitingForViewer) {
    return (
      <Page className={pageClass}>
        <ProductDetailHeader />
        <DetailSkeleton />
      </Page>
    );
  }

  if (!productQuery.data) {
    const isGone = getApiErrorStatus(productQuery.error) === HttpStatus.NotFound;

    // Nothing to retry once the listing is gone: offer the way back instead.
    return (
      <Page className={pageClass}>
        <ProductDetailHeader isOverMedia={false} />
        <main className="px-4 pb-4 pt-[calc(72px_+_var(--zaui-safe-area-inset-top))]">
          {isGone ? (
            <FeedbackState
              type="empty"
              title="Tin không còn tồn tại"
              description="Tin có thể đã bán hoặc bị gỡ. Xem các tin khác trên trang chủ."
              actionLabel="Về trang chủ"
              onAction={() => navigate('/', { replace: true })}
            />
          ) : (
            <FeedbackState
              type="error"
              title="Không tải được tin"
              description="Vui lòng kiểm tra kết nối mạng và thử lại."
              onAction={() => productQuery.refetch()}
            />
          )}
        </main>
      </Page>
    );
  }

  const product = productQuery.data;
  const isOwner = product.viewer.isOwner || session?.user.id === product.seller.id;
  // A sold listing is final and not shown to buyers: its owner has nothing left to do.
  const hasActions = !isOwner || product.status !== 'SOLD';
  return (
    <Page className={detailPageClass}>
      <ProductDetailHeader />
      <main className="bg-white">
        <ProductMediaGallery media={product.media} productTitle={product.title} />
        <section className="px-4">
          <ProductInformation
            product={product}
            onOpenActions={hasActions ? () => setActionsOpen(true) : undefined}
          />
          <ProductSellerContact product={product} />
        </section>
      </main>
      <ProductContactAction
        key={product.id}
        product={product}
        banner={<DraftBanner className="mb-3" />}
        onContactError={showError}
      />
      <ProductActionsSheet
        isOwner={isOwner}
        hasReported={product.viewer.hasReported}
        // The anonymous placeholder cannot know whether this viewer reported.
        isReportAvailable={!productQuery.isPlaceholderData}
        isOwnerActionPending={ownerActions.isPending}
        product={product}
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onError={showError}
        onOwnerAction={(action) => ownerActions.selectAction(product.id, action)}
        onReport={() => setReportOpen(true)}
      />
      {/* After the sheet: it closes as the dialog opens, and the dialog keeps the scroll lock. */}
      <ConfirmDialog {...ownerActions.markSoldDialog} />
      <ProductReportSheet
        isPending={reportMutation.isPending}
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleSubmitReport}
      />
    </Page>
  );
}
