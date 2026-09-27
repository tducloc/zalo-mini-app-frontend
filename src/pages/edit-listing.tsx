import type { ReactNode } from 'react';
import { Page, useNavigate, useParams } from 'zmp-ui';

import FeedbackState from '@/components/feedback/feedback-state';
import Skeleton from '@/components/feedback/skeleton';
import MobilePageHeader from '@/components/layout/mobile-page-header';
import { pageContentClass } from '@/components/layout/styles';
import { useSession } from '@/features/auth/hooks/use-session';
import EditListingForm from '@/features/listings/components/edit/edit-listing-form';
import { isEditableStatus } from '@/features/listings/utils/edit-listing';
import { useProductDetail } from '@/features/products/api/get-product-detail';
import { getApiErrorStatus } from '@/utils/api-error';

const NOT_FOUND_STATUS = 404;
const TILE_PLACEHOLDERS = ['a', 'b', 'c'];
const FIELD_PLACEHOLDERS = ['a', 'b', 'c', 'd'];

// No tab bar under /products/, nor the sell draft's banner: only the safe area.
const editPageClass = 'bg-white pb-[var(--zaui-safe-area-inset-bottom)]';

/**
 * "Sửa tin" (`/products/:productId/edit`): the owner's listing while it is processing,
 * failed or published, in the sell form (api-spec, `PATCH /products/:id`).
 */
export default function EditListingPage() {
  const { productId = '' } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { session, isBootstrapping } = useSession();

  const viewerId = session?.user.id ?? null;
  const productQuery = useProductDetail(productId, viewerId);

  const goBack = () => navigate(-1);

  // The anonymous copy has no owner fields and only READY media: wait for the owner's.
  if (isBootstrapping || productQuery.isPending || productQuery.isPlaceholderData) {
    return (
      <StatePage>
        <FormSkeleton />
      </StatePage>
    );
  }

  if (!productQuery.data) {
    const isGone = getApiErrorStatus(productQuery.error) === NOT_FOUND_STATUS;
    return (
      <StatePage>
        {isGone ? (
          <FeedbackState
            type="empty"
            title="Tin không còn tồn tại"
            description="Tin có thể đã bị gỡ."
            actionLabel="Quay lại"
            onAction={goBack}
          />
        ) : (
          <FeedbackState
            type="error"
            title="Không tải được tin"
            description="Vui lòng kiểm tra kết nối mạng và thử lại."
            onAction={() => productQuery.refetch()}
          />
        )}
      </StatePage>
    );
  }

  const product = productQuery.data;
  if (!product.viewer.isOwner || !isEditableStatus(product.status)) {
    return (
      <StatePage>
        <FeedbackState
          type="empty"
          title="Không thể sửa tin này"
          description={
            product.viewer.isOwner
              ? 'Tin đã bán hoặc đang ẩn nên không sửa được nữa.'
              : 'Chỉ người đăng mới sửa được tin này.'
          }
          actionLabel="Quay lại"
          onAction={goBack}
        />
      </StatePage>
    );
  }

  return (
    <Page className={editPageClass}>
      <EditListingForm key={product.id} product={product} viewerId={viewerId} />
    </Page>
  );
}

/** The page while there is no form to show: loading, failed, or not editable. */
function StatePage({ children }: { children: ReactNode }) {
  return (
    <Page className={editPageClass}>
      <MobilePageHeader title="Sửa tin" showBack />
      <main className={pageContentClass}>{children}</main>
    </Page>
  );
}

/** The form's shape while the listing loads: the photo grid, then the fields. */
function FormSkeleton() {
  return (
    <div role="status" aria-label="Đang tải tin">
      <Skeleton className="mb-4 h-6 w-40 rounded-md" />
      <div className="mb-8 grid grid-cols-4 gap-2.5">
        {TILE_PLACEHOLDERS.map((key) => (
          <Skeleton key={key} className="aspect-square rounded-[10px]" />
        ))}
      </div>
      {FIELD_PLACEHOLDERS.map((key) => (
        <Skeleton key={key} className="mb-5 h-[70px] rounded-[10px]" />
      ))}
    </div>
  );
}
