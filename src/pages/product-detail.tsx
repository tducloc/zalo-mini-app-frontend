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
import DetailBottomBar from '@/features/products/components/detail/bottom-bar';
import ProductContactAction from '@/features/products/components/detail/contact-action';
import ProductDetailHeader from '@/features/products/components/detail/detail-header';
import DetailSkeleton from '@/features/products/components/detail/detail-skeleton';
import ProductInformation from '@/features/products/components/detail/information';
import ProductOwnerBar from '@/features/products/components/detail/owner-bar';
import ProductMediaGallery from '@/features/products/components/gallery/media-gallery';
import ProductSellerContact from '@/features/products/components/detail/seller-card';
import { useCreateReport } from '@/features/reports/api/create-report';
import ProductReportSheet from '@/features/reports/components/report-sheet';
import type { CreateReportInput } from '@/features/reports/types/report';
import { useGoBack } from '@/hooks/use-go-back';
import { useSwipe } from '@/hooks/use-swipe';
import { useToast } from '@/hooks/use-toast';
import { useToastOffset } from '@/hooks/use-toast-offset';
import { getApiErrorStatus, HttpStatus } from '@/utils/api-error';

const reportErrorMessages: Partial<Record<number, string>> = {
  401: 'Bạn cần xác thực lại trước khi báo cáo.',
  403: 'Bạn không thể báo cáo tin đăng của chính mình.',
  429: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.',
};

const BAR_GAP_PX = 8;

type ProductDetailPageProps =
  | { mode?: 'route' }
  | { mode: 'embedded'; productId: string; canLoadMedia: boolean; onBack: () => void };

export default function ProductDetailPage(props: ProductDetailPageProps = {}) {
  const { productId: routeProductId = '' } = useParams<{ productId: string }>();
  const isEmbedded = props.mode === 'embedded';
  const productId = isEmbedded ? props.productId : routeProductId;
  const onEmbeddedBack = isEmbedded ? props.onBack : undefined;
  const canLoadMedia = isEmbedded ? props.canLoadMedia : true;
  const navigate = useNavigate();
  const { showError, showInfo, showSuccess } = useToast();
  const { session, isBootstrapping } = useSession();

  // sheets
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  useToastOffset(barHeight);

  // Public detail loads immediately; once sign-in finishes the viewer changes
  // the key and the owner/report fields are fetched for that user.
  const viewerId = session?.user.id ?? null;
  const productQuery = useProductDetail(productId, viewerId);
  const reportMutation = useCreateReport(productId, viewerId);
  const ownerActions = useOwnerListingActions();
  const goBack = useGoBack('/');
  const backSwipe = useSwipe((direction) => direction === 'right' && goBack());
  const backSwipeHandlers = isEmbedded ? {} : backSwipe;
  const backSwipeClass = isEmbedded ? '' : 'touch-pan-y';

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
        <ProductDetailHeader onBack={onEmbeddedBack} />
        <DetailSkeleton />
      </Page>
    );
  }

  if (!productQuery.data) {
    const isGone = getApiErrorStatus(productQuery.error) === HttpStatus.NotFound;

    // Nothing to retry once the listing is gone: offer the way back instead.
    return (
      <Page className={pageClass}>
        <ProductDetailHeader isOverMedia={false} onBack={onEmbeddedBack} />
        <main
          className={`${backSwipeClass} px-4 pb-4 pt-[calc(72px_+_var(--zaui-safe-area-inset-top))]`}
          {...backSwipeHandlers}
        >
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
  const bottomBar = (
    <DetailBottomBar position={isEmbedded ? 'absolute' : 'fixed'} onHeightChange={setBarHeight}>
      <DraftBanner className="mb-3" />
      {isOwner ? (
        <ProductOwnerBar
          status={product.status}
          isPending={ownerActions.isPending}
          onAction={(action) => ownerActions.selectAction(product.id, action)}
        />
      ) : (
        <ProductContactAction product={product} onContactError={showError} />
      )}
    </DetailBottomBar>
  );

  // Embedded in Reels, the sheets come after the bar outside the Page. iOS makes the scrolling
  // Page its own stacking context, which keeps anything in it under the bar.
  const overlays = (
    <>
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
    </>
  );

  return (
    <>
      {/* No tab bar: room for the bottom bar, and a gap above it. */}
      <Page className="bg-white" style={{ paddingBottom: barHeight + BAR_GAP_PX }}>
        <ProductDetailHeader onBack={onEmbeddedBack} />
        <main className="bg-white">
          <ProductMediaGallery
            media={product.media}
            productTitle={product.title}
            canLoadMedia={canLoadMedia}
          />
          <section className={`${backSwipeClass} px-4`} {...backSwipeHandlers}>
            <ProductInformation
              product={product}
              onOpenActions={hasActions ? () => setActionsOpen(true) : undefined}
            />
            <ProductSellerContact product={product} />
          </section>
        </main>
        {!isEmbedded && bottomBar}
        {!isEmbedded && overlays}
      </Page>
      {isEmbedded && bottomBar}
      {isEmbedded && overlays}
    </>
  );
}
