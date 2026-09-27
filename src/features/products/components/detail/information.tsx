import Price from '@/components/price';
import { getCategoryLabel } from '@/features/categories/utils/presentation';
import ProductDescription from '@/features/products/components/detail/description';
import { conditionLabels } from '@/features/products/constants/product';
import { ProductDetail } from '@/features/products/types/product';

const metaClass = 'mb-0 mt-1 text-caption leading-[19px] text-marketplace-muted';

export default function ProductInformation({
  product,
  onOpenActions,
}: {
  product: ProductDetail;
  /** Without it (nothing to offer) there is no "•••" button. */
  onOpenActions?: () => void;
}) {
  const publishedDate = new Date(product.publishedAt ?? product.createdAt).toLocaleDateString(
    'vi-VN',
  );

  return (
    <>
      <div className="flex items-start gap-3">
        <h1 className="mb-0 mt-3 flex-1 text-[22px] leading-[30px] text-marketplace-ink">
          {product.title}
        </h1>
        {onOpenActions && (
          <button
            aria-label="Tuỳ chọn tin đăng"
            className="mt-2.5 size-[34px] flex-[0_0_34px] rounded-full border-0 pb-1 text-base font-semibold leading-none tracking-normal text-marketplace-muted"
            onClick={onOpenActions}
          >
            •••
          </button>
        )}
      </div>
      <p className={metaClass}>
        {getCategoryLabel(product.category)} · {conditionLabels[product.condition]} ·{' '}
        {product.location.name}
      </p>
      <Price className="mb-0 mt-2 text-[28px] leading-[34px]" value={product.price} />
      <p className={metaClass}>Đăng {publishedDate}</p>
      <ProductDescription description={product.description} />
    </>
  );
}
