import Price from '@/components/price';
import { getCategoryLabel } from '@/features/categories/utils/presentation';

import ProductDescription from './description';
import { conditionLabels } from '../constants';
import { ProductDetail } from '../types';

export default function ProductInformation({
  product,
  onOpenActions,
}: {
  product: ProductDetail;
  onOpenActions: () => void;
}) {
  const publishedDate = new Date(product.publishedAt ?? product.createdAt).toLocaleDateString(
    'vi-VN',
  );

  return (
    <>
      <div className="product-detail-title-row">
        <h1 className="product-detail-title">{product.title}</h1>
        <button
          aria-label="Tùy chọn tin đăng"
          className="product-detail-action-menu"
          onClick={onOpenActions}
        >
          •••
        </button>
      </div>
      <p className="product-detail-meta product-detail-summary">
        {getCategoryLabel(product.category)} · {conditionLabels[product.condition]} ·{' '}
        {product.location.name}
      </p>
      <Price className="mb-0 mt-2 text-[28px] leading-[34px]" value={product.price} />
      <p className="product-detail-meta product-detail-published">Đăng {publishedDate}</p>
      <ProductDescription description={product.description} />
    </>
  );
}
