import Price from '@/components/price';

import ProductDescription from './description';
import { ProductDetail } from '../types';

const conditionLabel: Record<ProductDetail['condition'], string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  USED: 'Đã dùng',
};

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
        {product.category.name} · {conditionLabel[product.condition]} · {product.location}
      </p>
      <div className="product-detail-price">
        <Price value={product.price} />
      </div>
      <p className="product-detail-meta product-detail-published">Đăng {publishedDate}</p>
      <ProductDescription description={product.description} />
    </>
  );
}
