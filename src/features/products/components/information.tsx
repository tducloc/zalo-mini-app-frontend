import Price from '@/components/price';

import { ProductDetail } from '../types';

const conditionLabel: Record<ProductDetail['condition'], string> = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  USED: 'Đã dùng',
};

export default function ProductInformation({ product }: { product: ProductDetail }) {
  const publishedDate = new Date(product.publishedAt ?? product.createdAt).toLocaleDateString(
    'vi-VN',
  );

  return (
    <>
      <p className="product-detail-meta">
        {product.category.name} · {conditionLabel[product.condition]} · {product.location}
      </p>
      <h1 className="product-detail-title">{product.title}</h1>
      <Price value={product.price} />
      <p className="product-detail-meta">Đăng {publishedDate}</p>
      <section className="product-detail-description">
        <h2>Mô tả sản phẩm</h2>
        <p>{product.description}</p>
      </section>
    </>
  );
}
