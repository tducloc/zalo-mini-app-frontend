import { ProductDetail } from '@/features/products/types/product';

const avatarClass =
  'grid size-[46px] flex-[0_0_46px] place-items-center overflow-hidden rounded-full bg-marketplace-highlight object-cover font-bold text-marketplace-blue';

export default function ProductSellerContact({ product }: { product: ProductDetail }) {
  return (
    <section className="flex items-center gap-3 py-[18px]">
      {product.seller.avatarUrl ? (
        <img className={avatarClass} src={product.seller.avatarUrl} alt="" />
      ) : (
        <span className={avatarClass}>{(product.seller.name ?? 'N')[0]}</span>
      )}
      <h2 className="m-0 text-base leading-[22px]">{product.seller.name ?? 'Người bán Zalo'}</h2>
    </section>
  );
}
