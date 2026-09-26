import { ProductDetail } from '@/features/products/types/product';

export default function ProductSellerContact({ product }: { product: ProductDetail }) {
  return (
    <section className="product-seller-card">
      {product.seller.avatarUrl ? (
        <img src={product.seller.avatarUrl} alt="" />
      ) : (
        <span>{(product.seller.name ?? 'N')[0]}</span>
      )}
      <div>
        <h2>{product.seller.name ?? 'Người bán Zalo'}</h2>
        <p>Người bán trên Chợ Zalo</p>
      </div>
    </section>
  );
}
